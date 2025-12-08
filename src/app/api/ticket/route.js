import { NextResponse } from "next/server";
import { db, firestoreHelpers } from "@/lib/firebase";
import { ITEM_NAMES, isChai, isBun, isTiramisu, isMilkBun } from "@/lib/item-names";
import { logFirestoreRead, logFirestoreWrite, logFirestoreDelete } from "@/lib/firebase-monitor";

const { doc, collection, deleteDoc, getDoc, setDoc, updateDoc, serverTimestamp, runTransaction } = firestoreHelpers;

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateKey = searchParams.get("date");
    const id = searchParams.get("id");

    if (!dateKey || !id) {
      return NextResponse.json(
        { error: "date and id are required" },
        { status: 400 }
      );
    }

    const dayRef = doc(db, "queues", dateKey);
    const ticketRef = doc(collection(dayRef, "tickets"), id);
    const settingsRef = doc(db, "config", "app-settings");

    // Atomic transaction: delete ticket AND restore inventory
    try {
      await runTransaction(db, async (tx) => {
        // Read ticket
        const ticketSnap = await tx.get(ticketRef);
        logFirestoreRead(1, { endpoint: '/api/ticket', document: 'ticket', method: 'DELETE' });
        if (!ticketSnap.exists()) {
          throw new Error("Ticket not found");
        }

        const ticketData = ticketSnap.data();
        const items = Array.isArray(ticketData.items) ? ticketData.items : [];
        
        // Restore inventory for both "waiting" and "ready" status tickets
        const shouldRestoreInventory = ticketData.status === "waiting" || ticketData.status === "ready";

        // ALL READS MUST BE DONE FIRST
        // Read settings BEFORE any writes (Firestore requirement)
        let settingsSnap = null;
        if (shouldRestoreInventory) {
          settingsSnap = await tx.get(settingsRef);
          logFirestoreRead(1, { endpoint: '/api/ticket', document: 'settings', method: 'DELETE' });
        }

        // NOW DO ALL WRITES
        // Delete the ticket
        tx.delete(ticketRef);
        logFirestoreDelete(1, { endpoint: '/api/ticket', document: 'ticket', method: 'DELETE' });

        // Restore inventory if needed
        if (shouldRestoreInventory && settingsSnap && settingsSnap.exists()) {
          const currentSettings = settingsSnap.data();
          const currentInventory = currentSettings.inventory || { chai: 0, bun: 0, tiramisu: 0, milkBun: 0 };
          
          // Calculate inventory to restore
          let chaiRestore = 0;
          let bunRestore = 0;
          let tiramisuRestore = 0;
          let milkBunRestore = 0;
          
          items.forEach((item) => {
            const qty = Number(item.qty) || 0;
            if (isChai(item.name)) {
              chaiRestore += qty;
            } else if (isBun(item.name)) {
              bunRestore += qty;
            } else if (isTiramisu(item.name)) {
              tiramisuRestore += qty;
            } else if (isMilkBun(item.name)) {
              milkBunRestore += qty;
            }
          });

          // Restore inventory atomically
          tx.update(settingsRef, {
            "inventory.chai": (currentInventory.chai || 0) + chaiRestore,
            "inventory.bun": (currentInventory.bun || 0) + bunRestore,
            "inventory.tiramisu": (currentInventory.tiramisu || 0) + tiramisuRestore,
            "inventory.milkBun": (currentInventory.milkBun || 0) + milkBunRestore,
            updatedAt: serverTimestamp(),
          });
          logFirestoreWrite(1, { endpoint: '/api/ticket', document: 'settings', method: 'DELETE' });
        }
      });
    } catch (err) {
      if (err.message === "Ticket not found") {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      }
      throw err;
    }

    return NextResponse.json({ id, dateKey, deleted: true }, { status: 200 });
  } catch (err) {
    console.error("Error in /api/ticket DELETE:", err);
    return NextResponse.json(
      { error: "Failed to delete ticket" },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const id = body.id;
    const dateKey = body.dateKey;
    const items = body.items;

    if (!id || !dateKey || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "id, dateKey and items array are required" },
        { status: 400 }
      );
    }

    const dayRef = doc(db, "queues", dateKey);
    const ticketRef = doc(collection(dayRef, "tickets"), id);
    const settingsRef = doc(db, "config", "app-settings");

    // Calculate new quantities (to decrement)
    let newChaiQty = 0;
    let newBunQty = 0;
    let newTiramisuQty = 0;
    let newMilkBunQty = 0;
    items.forEach((item) => {
      const qty = Number(item.qty) || 0;
      if (isChai(item.name)) {
        newChaiQty += qty;
      } else if (isBun(item.name)) {
        newBunQty += qty;
      } else if (isTiramisu(item.name)) {
        newTiramisuQty += qty;
      } else if (isMilkBun(item.name)) {
        newMilkBunQty += qty;
      }
    });

    // Atomic transaction: update ticket AND inventory
    try {
      await runTransaction(db, async (tx) => {
        // Read ticket
        const ticketSnap = await tx.get(ticketRef);
        logFirestoreRead(1, { endpoint: '/api/ticket', document: 'ticket', method: 'PATCH' });
        if (!ticketSnap.exists()) {
          throw new Error("Ticket not found");
        }

        const ticketData = ticketSnap.data();
        if (ticketData.status !== "waiting") {
          throw new Error("Can only edit waiting tickets");
        }

        const oldItems = Array.isArray(ticketData.items) ? ticketData.items : [];
        
        // Calculate old quantities (to restore)
        let oldChaiQty = 0;
        let oldBunQty = 0;
        let oldTiramisuQty = 0;
        let oldMilkBunQty = 0;
        oldItems.forEach((item) => {
          const qty = Number(item.qty) || 0;
          if (isChai(item.name)) {
            oldChaiQty += qty;
          } else if (isBun(item.name)) {
            oldBunQty += qty;
          } else if (isTiramisu(item.name)) {
            oldTiramisuQty += qty;
          } else if (isMilkBun(item.name)) {
            oldMilkBunQty += qty;
          }
        });

        // Read settings
        const settingsSnap = await tx.get(settingsRef);
        logFirestoreRead(1, { endpoint: '/api/ticket', document: 'settings', method: 'PATCH' });
        if (!settingsSnap.exists()) {
          throw new Error("Settings not found");
        }

        const currentSettings = settingsSnap.data();
        const currentInventory = currentSettings.inventory || { chai: 0, bun: 0, tiramisu: 0, milkBun: 0 };

        // Calculate net change (positive = need more, negative = need less)
        const chaiChange = newChaiQty - oldChaiQty;
        const bunChange = newBunQty - oldBunQty;
        const tiramisuChange = newTiramisuQty - oldTiramisuQty;
        const milkBunChange = newMilkBunQty - oldMilkBunQty;

        // Calculate new inventory: current + old (restore) - new (decrement)
        // This ensures we restore what was taken and then take what's needed
        const newChaiInventory = (currentInventory.chai || 0) + oldChaiQty - newChaiQty;
        const newBunInventory = (currentInventory.bun || 0) + oldBunQty - newBunQty;
        const newTiramisuInventory = (currentInventory.tiramisu || 0) + oldTiramisuQty - newTiramisuQty;
        const newMilkBunInventory = (currentInventory.milkBun || 0) + oldMilkBunQty - newMilkBunQty;

        // Check if new quantities exceed available inventory
        if (newChaiInventory < 0 || newBunInventory < 0 || newTiramisuInventory < 0 || newMilkBunInventory < 0) {
          throw new Error("Stock exceeded");
        }

        // Update ticket FIRST
        tx.update(ticketRef, {
          items,
          updatedAt: serverTimestamp(),
        });
        logFirestoreWrite(1, { endpoint: '/api/ticket', document: 'ticket', method: 'PATCH' });

        // Update inventory atomically
        tx.update(settingsRef, {
          "inventory.chai": newChaiInventory,
          "inventory.bun": newBunInventory,
          "inventory.tiramisu": newTiramisuInventory,
          "inventory.milkBun": newMilkBunInventory,
          updatedAt: serverTimestamp(),
        });
        logFirestoreWrite(1, { endpoint: '/api/ticket', document: 'settings', method: 'PATCH' });
      });
    } catch (err) {
      if (err.message === "Ticket not found") {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      }
      if (err.message === "Can only edit waiting tickets") {
        return NextResponse.json(
          { error: "Can only edit waiting tickets" },
          { status: 400 }
        );
      }
      if (err.message === "Settings not found") {
        return NextResponse.json({ error: "Settings not found" }, { status: 404 });
      }
      if (err.message === "Stock exceeded") {
        return NextResponse.json(
          { error: "Stock exceeded" },
          { status: 400 }
        );
      }
      throw err;
    }

    return NextResponse.json({ id, dateKey, items }, { status: 200 });
  } catch (err) {
    console.error("Error in /api/ticket PATCH:", err);
    return NextResponse.json(
      { error: "Failed to update ticket" },
      { status: 500 }
    );
  }
}


