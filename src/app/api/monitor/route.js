import { NextResponse } from "next/server";
import { getFirestoreSummary, getFirestoreLog } from "@/lib/firebase-monitor";

export async function GET() {
  try {
    // Only allow in development or if explicitly enabled
    const isEnabled = process.env.NODE_ENV === 'development' || process.env.ENABLE_FIREBASE_MONITORING === 'true';
    
    if (!isEnabled) {
      return NextResponse.json(
        { error: "Monitoring is only available in development mode" },
        { status: 403 }
      );
    }

    const summary = getFirestoreSummary();
    const log = getFirestoreLog();

    return NextResponse.json(
      {
        summary,
        recentOperations: log.recentOperations,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in /api/monitor GET:", err);
    return NextResponse.json(
      { error: "Failed to get monitoring data" },
      { status: 500 }
    );
  }
}



