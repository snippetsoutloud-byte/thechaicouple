import { NextResponse } from "next/server";
import { db, getTodayKey, firestoreHelpers } from "@/lib/firebase";

const {
  doc,
  collection,
  runTransaction,
  setDoc,
  serverTimestamp,
} = firestoreHelpers;

export async function POST(request) {
  try {
    const body = await request.json();
    const name = (body.name || "").trim();
    const items = Array.isArray(body.items) ? body.items : [];

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

    const result = await runTransaction(db, async (tx) => {
      const daySnap = await tx.get(dayRef);
      const current = daySnap.exists()
        ? daySnap.data().nextPosition || 0
        : 0;
      const nextPosition = current + 1;

      tx.set(
        dayRef,
        {
          nextPosition,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

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
      };

      tx.set(ticketRef, ticket);

      return { id: ticketRef.id, position: nextPosition, dateKey };
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




