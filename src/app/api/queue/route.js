import { NextResponse } from "next/server";
import { db, getTodayKey, firestoreHelpers } from "@/lib/firebase";
import { isChai, isBun, isTiramisu } from "@/lib/item-names";

const {
  doc,
  collection,
  getDocs,
  deleteDoc,
  orderBy,
  query,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  runTransaction,
} = firestoreHelpers;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedDate = searchParams.get("date");
    const dateKey = requestedDate || getTodayKey();
    const dayRef = doc(db, "queues", dateKey);
    const ticketsCol = collection(dayRef, "tickets");

    const q = query(ticketsCol, orderBy("basePosition", "asc"));
    const snapshot = await getDocs(q);

    const tickets = [];
    snapshot.forEach((docSnap) => {
      tickets.push({ id: docSnap.id, ...docSnap.data() });
    });

    return NextResponse.json({ dateKey, tickets }, { status: 200 });
  } catch (err) {
    console.error("Error in /api/queue GET:", err);
    return NextResponse.json(
      { error: "Failed to fetch queue" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const dateKey = getTodayKey();
    const dayRef = doc(db, "queues", dateKey);
    const ticketsCol = collection(dayRef, "tickets");
    const settingsRef = doc(db, "config", "app-settings");

    // First, get all tickets to calculate restore amounts
    const snapshot = await getDocs(ticketsCol);
    
    let totalChaiRestore = 0;
    let totalBunRestore = 0;
    let totalTiramisuRestore = 0;
    const ticketRefsToDelete = [];

    snapshot.forEach((docSnap) => {
      const ticketData = docSnap.data();
      if (ticketData.status === "waiting") {
        ticketRefsToDelete.push(docSnap.ref);
        
        const items = Array.isArray(ticketData.items) ? ticketData.items : [];
        items.forEach((item) => {
          const qty = Number(item.qty) || 0;
          if (isChai(item.name)) {
            totalChaiRestore += qty;
          } else if (isBun(item.name)) {
            totalBunRestore += qty;
          } else if (isTiramisu(item.name)) {
            totalTiramisuRestore += qty;
          }
        });
      }
    });

    // Atomic transaction: delete all tickets AND restore inventory
    if (ticketRefsToDelete.length > 0) {
      await runTransaction(db, async (tx) => {
        // Read settings
        const settingsSnap = await tx.get(settingsRef);
        if (!settingsSnap.exists()) {
          // If settings don't exist, just delete tickets
          ticketRefsToDelete.forEach(ref => tx.delete(ref));
          return;
        }

        const currentSettings = settingsSnap.data();
        const currentInventory = currentSettings.inventory || { chai: 0, bun: 0, tiramisu: 0 };

        // Delete all tickets
        ticketRefsToDelete.forEach(ref => tx.delete(ref));

        // Restore inventory atomically
        tx.update(settingsRef, {
          "inventory.chai": (currentInventory.chai || 0) + totalChaiRestore,
          "inventory.bun": (currentInventory.bun || 0) + totalBunRestore,
          "inventory.tiramisu": (currentInventory.tiramisu || 0) + totalTiramisuRestore,
          updatedAt: serverTimestamp(),
        });
      });
    }

    return NextResponse.json({ 
      dateKey, 
      cleared: true,
      ticketsDeleted: ticketRefsToDelete.length,
      restored: {
        chai: totalChaiRestore,
        bun: totalBunRestore,
        tiramisu: totalTiramisuRestore
      }
    }, { status: 200 });
  } catch (err) {
    console.error("Error in /api/queue DELETE:", err);
    return NextResponse.json(
      { error: "Failed to clear queue" },
      { status: 500 }
    );
  }
}




