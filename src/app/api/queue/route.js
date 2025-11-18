import { NextResponse } from "next/server";
import { db, getTodayKey, firestoreHelpers } from "@/lib/firebase";

const {
  doc,
  collection,
  getDocs,
  deleteDoc,
  orderBy,
  query,
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

    const snapshot = await getDocs(ticketsCol);

    const deletions = [];
    snapshot.forEach((docSnap) => {
      deletions.push(deleteDoc(docSnap.ref));
    });

    await Promise.all(deletions);

    return NextResponse.json({ dateKey, cleared: true }, { status: 200 });
  } catch (err) {
    console.error("Error in /api/queue DELETE:", err);
    return NextResponse.json(
      { error: "Failed to clear queue" },
      { status: 500 }
    );
  }
}




