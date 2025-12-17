import { NextResponse } from "next/server";
import { db, getTodayKey, firestoreHelpers } from "@/lib/firebase";
import { isChai, isBun, isTiramisu, isMilkBun, isHotChocolate } from "@/lib/item-names";
//import { logFirestoreRead, logFirestoreWrite } from "@/lib/firebase-monitor";

const {
  doc,
  collection,
  runTransaction,
  getDocs,
  query,
  where,
  serverTimestamp,
} = firestoreHelpers;

export async function POST(request) {
  try {
    const body = await request.json();
    const name = (body.name || "").trim();
    const items = Array.isArray(body.items) ? body.items : [];
    
    // Get idempotency key from headers
    const idempotencyKey = request.headers.get("X-Idempotency-Key");

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const hasQuantity = items.some((item) => item.qty && item.qty > 0);
    if (!hasQuantity) {
      return NextResponse.json(
        { error: "At least one item with quantity is required" },
        { status: 400 }
      );
    }

    const dateKey = getTodayKey();
    const dayRef = doc(db, "queues", dateKey);
    const settingsRef = doc(db, "config", "app-settings");

    // Check if a ticket with this idempotency key already exists
    if (idempotencyKey) {
      try {
        const ticketsCol = collection(dayRef, "tickets");
        const existingQuery = query(ticketsCol, where("idempotencyKey", "==", idempotencyKey));
        const existingSnapshot = await getDocs(existingQuery);
        
        if (!existingSnapshot.empty) {
          // Check if the existing ticket is still in "waiting" status
          const existingTicket = existingSnapshot.docs[0];
          const ticketData = existingTicket.data();
          
          // Only return existing ticket if it's still waiting
          if (ticketData.status === "waiting") {
            return NextResponse.json({
              id: existingTicket.id,
              position: ticketData.basePosition,
              dateKey: ticketData.dateKey,
              items: ticketData.items,
              existing: true // Flag to indicate this is an existing ticket
            }, { status: 200 });
          }
          // If ticket is not waiting (ready, served, etc.), allow creating a new ticket
          // The old idempotency key is essentially expired
        }
      } catch (err) {
        console.error("Error checking idempotency key:", err);
        // Continue to create new ticket if check fails
      }
    }

    // Calculate inventory changes
    let chaiDecrement = 0;
    let bunDecrement = 0;
    let tiramisuDecrement = 0;
    let milkBunDecrement = 0;
    let hotChocolateDecrement = 0;
    
    items.forEach((item) => {
      const qty = Number(item.qty) || 0;
      if (isChai(item.name)) {
        chaiDecrement += qty;
      } else if (isBun(item.name)) {
        bunDecrement += qty;
      } else if (isTiramisu(item.name)) {
        tiramisuDecrement += qty;
      } else if (isMilkBun(item.name)) {
        milkBunDecrement += qty;
      } else if (isHotChocolate(item.name)) {
        hotChocolateDecrement += qty;
      }
    });

    // Atomic transaction: create ticket AND decrement inventory
    const result = await runTransaction(db, async (tx) => {
      // Read queue day document
      const daySnap = await tx.get(dayRef);
      //logFirestoreRead(1, { endpoint: '/api/join', document: 'queue-day' });
      const current = daySnap.exists()
        ? daySnap.data().nextPosition || 0
        : 0;
      const nextPosition = current + 1;

      // Read settings document for inventory
      const settingsSnap = await tx.get(settingsRef);
      //logFirestoreRead(1, { endpoint: '/api/join', document: 'settings' });
      if (!settingsSnap.exists()) {
        throw new Error("Settings document not found");
      }

      const currentSettings = settingsSnap.data();
      const currentInventory = currentSettings.inventory || { chai: 0, bun: 0, tiramisu: 0, milkBun: 0, hotChocolate: 0 };

      // Calculate new inventory (prevent negative)
      const newChaiInventory = Math.max(0, (currentInventory.chai || 0) - chaiDecrement);
      const newBunInventory = Math.max(0, (currentInventory.bun || 0) - bunDecrement);
      const newTiramisuInventory = Math.max(0, (currentInventory.tiramisu || 0) - tiramisuDecrement);
      const newMilkBunInventory = Math.max(0, (currentInventory.milkBun || 0) - milkBunDecrement);
      const newHotChocolateInventory = Math.max(0, (currentInventory.hotChocolate || 0) - hotChocolateDecrement);

      // Update queue day document
      tx.set(
        dayRef,
        {
          nextPosition,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
     // logFirestoreWrite(1, { endpoint: '/api/join', document: 'queue-day' });

      // Create ticket
      const ticketsCol = collection(dayRef, "tickets");
      const ticketRef = doc(ticketsCol);
      const ticket = {
        name,
        items,
        status: "waiting",
        basePosition: nextPosition,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        dateKey,
        idempotencyKey: idempotencyKey || null, // Store the idempotency key
      };
      tx.set(ticketRef, ticket);
     // logFirestoreWrite(1, { endpoint: '/api/join', document: 'ticket' });

      // Update inventory atomically
      tx.update(settingsRef, {
        "inventory.chai": newChaiInventory,
        "inventory.bun": newBunInventory,
        "inventory.tiramisu": newTiramisuInventory,
        "inventory.milkBun": newMilkBunInventory,
        "inventory.hotChocolate": newHotChocolateInventory,
        updatedAt: serverTimestamp(),
      });
     // logFirestoreWrite(1, { endpoint: '/api/join', document: 'settings' });

      return { id: ticketRef.id, position: nextPosition, dateKey, items };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("Error in /api/join:", err);
    return NextResponse.json(
      { error: "Failed to join queue" },
      { status: 500 }
    );
  }
}




