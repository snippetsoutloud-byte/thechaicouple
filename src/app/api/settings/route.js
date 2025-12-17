import { NextResponse } from "next/server";
import { db, firestoreHelpers } from "@/lib/firebase";
import { logFirestoreRead, logFirestoreWrite } from "@/lib/firebase-monitor";

const { doc, getDoc, setDoc, serverTimestamp } = firestoreHelpers;

const SETTINGS_DOC = doc(db, "config", "app-settings");

const DEFAULT_SETTINGS = {
  serviceStart: "06:00",
  serviceEnd: "23:00",
  closedMessage: "Queue is currently closed. Please check back during service hours.",
  inventory: {
    chai: 0,
    bun: 0,
    tiramisu: 0,
    milkBun: 0,
    hotChocolate: 0,
  },
  buffer: {
    chai: 10,
    bun: 10,
    tiramisu: 10,
    milkBun: 10,
    hotChocolate: 10,
  },
};

export async function GET() {
  try {
    const snap = await getDoc(SETTINGS_DOC);
    logFirestoreRead(1, { endpoint: '/api/settings', document: 'settings', method: 'GET' });
    if (!snap.exists()) {
      return NextResponse.json(DEFAULT_SETTINGS, { status: 200 });
    }
    const data = snap.data();
    // Properly merge nested objects (inventory and buffer) to ensure all fields are present
    const mergedData = {
      ...DEFAULT_SETTINGS,
      ...data,
      inventory: {
        ...DEFAULT_SETTINGS.inventory,
        ...(data.inventory || {}),
      },
      buffer: {
        ...DEFAULT_SETTINGS.buffer,
        ...(data.buffer || {}),
      },
    };
    return NextResponse.json(mergedData, { status: 200 });
  } catch (err) {
    console.error("Error in /api/settings GET:", err);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Read existing settings to preserve values not being updated
    const existingSnap = await getDoc(SETTINGS_DOC);
    const existingData = existingSnap.exists() ? existingSnap.data() : {};
    
    const serviceStart = body.serviceStart ?? existingData.serviceStart ?? DEFAULT_SETTINGS.serviceStart;
    const serviceEnd = body.serviceEnd ?? existingData.serviceEnd ?? DEFAULT_SETTINGS.serviceEnd;
    const closedMessage = body.closedMessage ?? existingData.closedMessage ?? DEFAULT_SETTINGS.closedMessage;
    
    // Handle inventory: use provided value, fallback to existing, then default
    const inventory = {
      chai: body.inventory?.chai != null ? Number(body.inventory.chai) || 0 : (existingData.inventory?.chai ?? DEFAULT_SETTINGS.inventory.chai),
      bun: body.inventory?.bun != null ? Number(body.inventory.bun) || 0 : (existingData.inventory?.bun ?? DEFAULT_SETTINGS.inventory.bun),
      tiramisu: body.inventory?.tiramisu != null ? Number(body.inventory.tiramisu) || 0 : (existingData.inventory?.tiramisu ?? DEFAULT_SETTINGS.inventory.tiramisu),
      milkBun: body.inventory?.milkBun != null ? Number(body.inventory.milkBun) || 0 : (existingData.inventory?.milkBun ?? DEFAULT_SETTINGS.inventory.milkBun),
      hotChocolate: body.inventory?.hotChocolate != null ? Number(body.inventory.hotChocolate) || 0 : (existingData.inventory?.hotChocolate ?? DEFAULT_SETTINGS.inventory.hotChocolate),
    };
    
    // Handle buffer: use provided value, fallback to existing, then default
    const buffer = {
      chai: body.buffer?.chai != null ? Number(body.buffer.chai) || 0 : (existingData.buffer?.chai ?? DEFAULT_SETTINGS.buffer.chai),
      bun: body.buffer?.bun != null ? Number(body.buffer.bun) || 0 : (existingData.buffer?.bun ?? DEFAULT_SETTINGS.buffer.bun),
      tiramisu: body.buffer?.tiramisu != null ? Number(body.buffer.tiramisu) || 0 : (existingData.buffer?.tiramisu ?? DEFAULT_SETTINGS.buffer.tiramisu),
      milkBun: body.buffer?.milkBun != null ? Number(body.buffer.milkBun) || 0 : (existingData.buffer?.milkBun ?? DEFAULT_SETTINGS.buffer.milkBun),
      hotChocolate: body.buffer?.hotChocolate != null ? Number(body.buffer.hotChocolate) || 0 : (existingData.buffer?.hotChocolate ?? DEFAULT_SETTINGS.buffer.hotChocolate),
    };

    await setDoc(
      SETTINGS_DOC,
      {
        serviceStart,
        serviceEnd,
        closedMessage,
        inventory,
        buffer,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    logFirestoreWrite(1, { endpoint: '/api/settings', document: 'settings', method: 'POST' });

    return NextResponse.json(
      { serviceStart, serviceEnd, closedMessage, inventory, buffer },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in /api/settings POST:", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}


