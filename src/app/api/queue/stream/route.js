import { NextResponse } from "next/server";
import { db, getTodayKey, firestoreHelpers } from "@/lib/firebase";

const { doc, collection, query, orderBy, onSnapshot } = firestoreHelpers;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const requestedDate = searchParams.get("date") || getTodayKey();

  const ticketsQuery = query(
    collection(doc(db, "queues", requestedDate), "tickets"),
    orderBy("basePosition", "asc")
  );

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const unsubscribe = onSnapshot(
        ticketsQuery,
        (snapshot) => {
          const tickets = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ dateKey: requestedDate, tickets })}\n\n`)
          );
        },
        (error) => {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`
            )
          );
        }
      );

      const close = () => {
        unsubscribe();
        controller.close();
      };

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}


