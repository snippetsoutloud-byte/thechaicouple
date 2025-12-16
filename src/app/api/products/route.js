import { NextResponse } from "next/server";
import { db, firestoreHelpers } from "@/lib/firebase";
import { logFirestoreRead, logFirestoreWrite } from "@/lib/firebase-monitor";

const { doc, getDoc, setDoc, serverTimestamp } = firestoreHelpers;

const PRODUCTS_DOC = doc(db, "config", "products");

// Default products (for migration from old system)
const DEFAULT_PRODUCTS = [
  { id: "chai", name: "Special Chai", price: 20, inventory: 0, buffer: 10, order: 0 },
  { id: "bun", name: "Bun Maska", price: 30, inventory: 0, buffer: 10, order: 1 },
  { id: "tiramisu", name: "Tiramisu", price: 170, inventory: 0, buffer: 10, order: 2 },
  { id: "milkBun", name: "Milk Bun", price: 60, inventory: 0, buffer: 10, order: 3 },
];

// GET - Fetch all products
export async function GET() {
  try {
    const snap = await getDoc(PRODUCTS_DOC);
    logFirestoreRead(1, { endpoint: '/api/products', method: 'GET' });

    if (!snap.exists()) {
      // Return default products if none exist
      return NextResponse.json({ products: DEFAULT_PRODUCTS }, { status: 200 });
    }

    const data = snap.data();
    const products = Array.isArray(data.products) ? data.products : DEFAULT_PRODUCTS;
    
    // Sort by order field
    products.sort((a, b) => (a.order || 0) - (b.order || 0));

    return NextResponse.json({ products }, { status: 200 });
  } catch (err) {
    console.error("Error in /api/products GET:", err);
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
}

// POST - Save all products (full replace)
export async function POST(request) {
  try {
    const body = await request.json();
    const products = body.products;

    if (!Array.isArray(products)) {
      return NextResponse.json({ error: "Products must be an array" }, { status: 400 });
    }

    // Validate each product
    const validatedProducts = products.map((p, index) => {
      if (!p.id || typeof p.id !== "string") {
        throw new Error(`Product at index ${index} must have a valid id`);
      }
      if (!p.name || typeof p.name !== "string") {
        throw new Error(`Product at index ${index} must have a valid name`);
      }
      
      return {
        id: p.id.trim().toLowerCase().replace(/\s+/g, "_"),
        name: p.name.trim(),
        price: Math.max(0, Number(p.price) || 0),
        inventory: Math.max(0, Math.floor(Number(p.inventory) || 0)),
        buffer: Math.max(0, Math.floor(Number(p.buffer) || 10)),
        order: typeof p.order === "number" ? p.order : index,
      };
    });

    // Check for duplicate IDs
    const ids = validatedProducts.map(p => p.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicates.length > 0) {
      return NextResponse.json({ error: `Duplicate product IDs: ${duplicates.join(", ")}` }, { status: 400 });
    }

    await setDoc(PRODUCTS_DOC, {
      products: validatedProducts,
      updatedAt: serverTimestamp(),
    });
    logFirestoreWrite(1, { endpoint: '/api/products', method: 'POST' });

    return NextResponse.json({ products: validatedProducts }, { status: 200 });
  } catch (err) {
    console.error("Error in /api/products POST:", err);
    return NextResponse.json({ error: err.message || "Failed to save products" }, { status: 500 });
  }
}

// PATCH - Update inventory for specific products (used during orders)
export async function PATCH(request) {
  try {
    const body = await request.json();
    const updates = body.updates; // { productId: newInventory, ... }

    if (!updates || typeof updates !== "object") {
      return NextResponse.json({ error: "Updates object required" }, { status: 400 });
    }

    const snap = await getDoc(PRODUCTS_DOC);
    logFirestoreRead(1, { endpoint: '/api/products', method: 'PATCH' });

    if (!snap.exists()) {
      return NextResponse.json({ error: "No products found" }, { status: 404 });
    }

    const data = snap.data();
    const products = Array.isArray(data.products) ? [...data.products] : [];

    // Apply updates
    for (const [productId, newInventory] of Object.entries(updates)) {
      const productIndex = products.findIndex(p => p.id === productId);
      if (productIndex !== -1) {
        products[productIndex] = {
          ...products[productIndex],
          inventory: Math.max(0, Math.floor(Number(newInventory) || 0)),
        };
      }
    }

    await setDoc(PRODUCTS_DOC, {
      products,
      updatedAt: serverTimestamp(),
    });
    logFirestoreWrite(1, { endpoint: '/api/products', method: 'PATCH' });

    return NextResponse.json({ products }, { status: 200 });
  } catch (err) {
    console.error("Error in /api/products PATCH:", err);
    return NextResponse.json({ error: "Failed to update products" }, { status: 500 });
  }
}

