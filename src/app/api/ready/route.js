import { NextResponse } from "next/server";
import { db, firestoreHelpers } from "@/lib/firebase";

const { doc, collection, updateDoc, serverTimestamp } = firestoreHelpers;

export async function PATCH(request) {
  try {
    const body = await request.json();
    const id = body.id;
    const dateKey = body.dateKey;
    const status = body.status;

    if (!id || !dateKey || !status) {
      return NextResponse.json(
        { error: "id, dateKey and status are required" },
        { status: 400 }
      );
    }

    const allowed = ["waiting", "ready"];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    const dayRef = doc(db, "queues", dateKey);
    const ticketRef = doc(collection(dayRef, "tickets"), id);

    await updateDoc(ticketRef, {
      status,
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ id, dateKey, status }, { status: 200 });
  } catch (err) {
    console.error("Error in /api/ready PATCH:", err);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 }
    );
  }
}




