import { NextResponse } from "next/server";
import { db, getTodayKey, firestoreHelpers } from "@/lib/firebase";

const {
  doc,
  collection,
  runTransaction,
  getDocs,
  query,
  where,
  serverTimestamp,
  getDoc,
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
    const productsRef = doc(db, "config", "products");

    // Check if a ticket with this idempotency key already exists
    if (idempotencyKey) {
      try {
        const ticketsCol = collection(dayRef, "tickets");
        const existingQuery = query(ticketsCol, where("idempotencyKey", "==", idempotencyKey));
        const existingSnapshot = await getDocs(existingQuery);
        
        if (!existingSnapshot.empty) {
          const existingTicket = existingSnapshot.docs[0];
          const ticketData = existingTicket.data();
          
          if (ticketData.status === "waiting") {
            return NextResponse.json({
              id: existingTicket.id,
              position: ticketData.basePosition,
              dateKey: ticketData.dateKey,
              items: ticketData.items,
              existing: true
            }, { status: 200 });
          }
        }
      } catch (err) {
        console.error("Error checking idempotency key:", err);
      }
    }

    // Build inventory decrements by productId
    const decrements = {};
    items.forEach((item) => {
      const qty = Number(item.qty) || 0;
      const productId = item.productId;
      if (productId && qty > 0) {
        decrements[productId] = (decrements[productId] || 0) + qty;
      }
    });

    // Atomic transaction: create ticket AND decrement inventory
    const result = await runTransaction(db, async (tx) => {
      // Read queue day document
      const daySnap = await tx.get(dayRef);
      const current = daySnap.exists()
        ? daySnap.data().nextPosition || 0
        : 0;
      const nextPosition = current + 1;

      // Read products document
      const productsSnap = await tx.get(productsRef);
      let products = [];
      if (productsSnap.exists()) {
        products = productsSnap.data().products || [];
      }

      // Validate inventory and calculate new values
      const updatedProducts = products.map((product) => {
        if (decrements[product.id]) {
          const newInventory = Math.max(0, product.inventory - decrements[product.id]);
          return { ...product, inventory: newInventory };
        }
        return product;
      });

      // Update queue day document
      tx.set(
        dayRef,
        {
          nextPosition,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

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
        idempotencyKey: idempotencyKey || null,
      };
      tx.set(ticketRef, ticket);

      // Update products inventory atomically
      if (Object.keys(decrements).length > 0) {
        tx.set(productsRef, {
          products: updatedProducts,
          updatedAt: serverTimestamp(),
        });
      }

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
