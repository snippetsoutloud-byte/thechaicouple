import { NextResponse } from "next/server";
import { db, firestoreHelpers } from "@/lib/firebase";

const { doc, collection, deleteDoc } = firestoreHelpers;

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
    await deleteDoc(ticketRef);

    return NextResponse.json({ id, dateKey, deleted: true }, { status: 200 });
  } catch (err) {
    console.error("Error in /api/ticket DELETE:", err);
    return NextResponse.json(
      { error: "Failed to delete ticket" },
      { status: 500 }
    );
  }
}


