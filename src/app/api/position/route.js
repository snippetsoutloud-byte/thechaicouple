import { NextResponse } from "next/server";
import { db, firestoreHelpers } from "@/lib/firebase";

const {
  doc,
  collection,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} = firestoreHelpers;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const dateKey = searchParams.get("date");

    if (!id || !dateKey) {
      return NextResponse.json(
        { error: "id and date are required" },
        { status: 400 }
      );
    }

    const dayRef = doc(db, "queues", dateKey);
    const ticketRef = doc(collection(dayRef, "tickets"), id);
    const ticketSnap = await getDoc(ticketRef);

    if (!ticketSnap.exists()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = ticketSnap.data();
    const status = data.status;
    const basePosition = data.basePosition || 0;

    if (status === "served" || status === "removed" || status === "ready") {
      return NextResponse.json(
        {
          id,
          status,
          position: null,
          basePosition,
          name: data.name || "",
          items: data.items || [],
        },
        { status: 200 }
      );
    }

    const ticketsCol = collection(dayRef, "tickets");
    const q = query(
      ticketsCol,
      where("status", "==", "waiting"),
      orderBy("basePosition", "asc")
    );
    const snapshot = await getDocs(q);

    let queuePosition = null;
    let index = 0;
    snapshot.forEach((docSnap) => {
      if (docSnap.id === id) {
        queuePosition = index + 1;
      }
      index += 1;
    });

    return NextResponse.json(
      {
        id,
        status,
        position: queuePosition,
        basePosition,
        name: data.name || "",
        items: data.items || [],
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in /api/position:", err);
    return NextResponse.json(
      { error: "Failed to get position" },
      { status: 500 }
    );
  }
}




