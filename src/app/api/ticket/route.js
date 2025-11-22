import { NextResponse } from "next/server";
import { db, firestoreHelpers } from "@/lib/firebase";
import { ITEM_NAMES, isChai, isBun, isTiramisu } from "@/lib/item-names";

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
        if (!ticketSnap.exists()) {
          throw new Error("Ticket not found");
        }

        const ticketData = ticketSnap.data();
        const items = Array.isArray(ticketData.items) ? ticketData.items : [];
        
        // Only restore inventory if ticket status is "waiting"
        const shouldRestoreInventory = ticketData.status === "waiting";

        // Delete the ticket
        tx.delete(ticketRef);

        // Restore inventory if needed
        if (shouldRestoreInventory) {
          // Read settings
          const settingsSnap = await tx.get(settingsRef);
          if (!settingsSnap.exists()) {
            return; // Settings not found, skip restore
          }

          const currentSettings = settingsSnap.data();
          const currentInventory = currentSettings.inventory || { chai: 0, bun: 0, tiramisu: 0 };
          
          // Calculate inventory to restore
          let chaiRestore = 0;
          let bunRestore = 0;
          let tiramisuRestore = 0;
          
          items.forEach((item) => {
            const qty = Number(item.qty) || 0;
            if (isChai(item.name)) {
              chaiRestore += qty;
            } else if (isBun(item.name)) {
              bunRestore += qty;
            } else if (isTiramisu(item.name)) {
              tiramisuRestore += qty;
            }
          });

          // Restore inventory atomically
          tx.update(settingsRef, {
            "inventory.chai": (currentInventory.chai || 0) + chaiRestore,
            "inventory.bun": (currentInventory.bun || 0) + bunRestore,
            "inventory.tiramisu": (currentInventory.tiramisu || 0) + tiramisuRestore,
            updatedAt: serverTimestamp(),
          });
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
    items.forEach((item) => {
      const qty = Number(item.qty) || 0;
      if (isChai(item.name)) {
        newChaiQty += qty;
      } else if (isBun(item.name)) {
        newBunQty += qty;
      } else if (isTiramisu(item.name)) {
        newTiramisuQty += qty;
      }
    });

    // Atomic transaction: update ticket AND inventory
    try {
      await runTransaction(db, async (tx) => {
        // Read ticket
        const ticketSnap = await tx.get(ticketRef);
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
        oldItems.forEach((item) => {
          const qty = Number(item.qty) || 0;
          if (isChai(item.name)) {
            oldChaiQty += qty;
          } else if (isBun(item.name)) {
            oldBunQty += qty;
          } else if (isTiramisu(item.name)) {
            oldTiramisuQty += qty;
          }
        });

        // Read settings
        const settingsSnap = await tx.get(settingsRef);
        if (!settingsSnap.exists()) {
          throw new Error("Settings not found");
        }

        const currentSettings = settingsSnap.data();
        const currentInventory = currentSettings.inventory || { chai: 0, bun: 0, tiramisu: 0 };

        // Calculate net change
        const chaiChange = newChaiQty - oldChaiQty;
        const bunChange = newBunQty - oldBunQty;
        const tiramisuChange = newTiramisuQty - oldTiramisuQty;

        // Check if new quantities exceed available inventory
        const availableChai = (currentInventory.chai || 0) - chaiChange;
        const availableBun = (currentInventory.bun || 0) - bunChange;
        const availableTiramisu = (currentInventory.tiramisu || 0) - tiramisuChange;

        if (availableChai < 0 || availableBun < 0 || availableTiramisu < 0) {
          throw new Error("Stock exceeded");
        }

        // Update ticket
        tx.update(ticketRef, {
          items,
          updatedAt: serverTimestamp(),
        });

        // Update inventory atomically
        tx.update(settingsRef, {
          "inventory.chai": availableChai,
          "inventory.bun": availableBun,
          "inventory.tiramisu": availableTiramisu,
          updatedAt: serverTimestamp(),
        });
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


