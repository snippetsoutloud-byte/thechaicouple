"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Loader2 } from "lucide-react";

import { getTodayKey } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import ChristmasQueue from "@/components/ChristmasQueue";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
});

export default function QueuePage() {
  const [useChristmasTheme, setUseChristmasTheme] = useState(null);

  // Load theme preference from settings
  useEffect(() => {
    async function loadTheme() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          setUseChristmasTheme(data.christmasTheme === true);
        } else {
          setUseChristmasTheme(false);
        }
      } catch {
        setUseChristmasTheme(false);
      }
    }
    loadTheme();
  }, []);

  // Show loading state while determining theme
  if (useChristmasTheme === null) {
    return (
      <main className="min-h-screen bg-muted/40 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    );
  }

  // Render Christmas theme if enabled
  if (useChristmasTheme) {
    return <ChristmasQueue />;
  }

  // Render default theme
  return <DefaultQueuePage />;
}

function DefaultQueuePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [products, setProducts] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState(null);
  const [settingsError, setSettingsError] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);

  // Redirect if already has ticket
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("queueTicket");
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (parsed?.id && parsed.dateKey === getTodayKey()) {
        router.replace(`/status/${parsed.id}`);
      }
    } catch {
      // ignore
    }
  }, [router]);

  // Generate idempotency key for preventing duplicate submissions
  function generateIdempotencyKey() {
    return `idem_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  // Load products
  useEffect(() => {
    let ignore = false;

    async function loadProducts() {
      try {
        const res = await fetch("/api/products");
        if (!res.ok) return;
        const data = await res.json();
        if (!ignore && data.products) {
          setProducts(data.products);
          // Initialize quantities for each product
          const initialQuantities = {};
          data.products.forEach((p) => {
            initialQuantities[p.id] = 0;
          });
          setQuantities(initialQuantities);
        }
      } catch {
        // ignore
      } finally {
        if (!ignore) setProductsLoading(false);
      }
    }
    loadProducts();
    return () => {
      ignore = true;
    };
  }, []);

  // SSE for real-time product updates
  useEffect(() => {
    // Poll for product updates every 30 seconds
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/products");
        if (res.ok) {
          const data = await res.json();
          if (data.products) {
            setProducts(data.products);
            // Auto-adjust quantities if inventory drops below selected quantities
            setQuantities((prev) => {
              const updated = { ...prev };
              data.products.forEach((p) => {
                if (updated[p.id] === undefined) {
                  updated[p.id] = 0;
                } else if (updated[p.id] > p.inventory) {
                  updated[p.id] = p.inventory;
                }
              });
              return updated;
            });
          }
        }
      } catch {
        // ignore
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Load settings for service hours
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const dateKey = getTodayKey();
    const source = new EventSource(`/api/queue/stream?date=${dateKey}`);
    
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.settings) {
          setSettings(payload.settings);
          setSettingsLoading(false);
          setSettingsError("");
        }
      } catch {
        setSettingsError("Failed to process settings update");
        setSettingsLoading(false);
      }
    };
    
    return () => {
      source.close();
    };
  }, []);

  // Filter to only show products with inventory > 0
  const availableProducts = useMemo(
    () => products.filter((p) => p.inventory > 0),
    [products]
  );

  const orderItems = useMemo(
    () =>
      products
        .map((product) => ({
          name: product.name,
          id: product.id,
          qty: quantities[product.id] || 0,
          price: product.price,
        }))
        .filter((item) => item.qty > 0),
    [products, quantities]
  );

  const total = orderItems.reduce(
    (sum, item) => sum + (item.price || 0) * item.qty,
    0
  );

  const isWithinServiceWindow = useMemo(() => {
    if (!settings) return true;
    if (!settings.serviceStart || !settings.serviceEnd) return true;
    const toMinutes = (time) => {
      const [hours = "0", minutes = "0"] = String(time).split(":");
      return Number(hours) * 60 + Number(minutes);
    };
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = toMinutes(settings.serviceStart);
    const endMinutes = toMinutes(settings.serviceEnd);
    if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes)) return true;
    if (startMinutes <= endMinutes) {
      return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
    }
    return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
  }, [settings]);

  const hasAnyAvailable = availableProducts.length > 0;
  const queueOpen = isWithinServiceWindow && hasAnyAvailable;

  const canSubmit =
    queueOpen && name.trim().length > 0 && orderItems.length > 0 && !submitting;

  function updateQuantity(productId, delta) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    setQuantities((prev) => {
      const current = prev[productId] || 0;
      const maxQty = product.inventory;
      if (delta > 0 && current >= maxQty) {
        return prev;
      }
      const next = Math.max(0, Math.min(current + delta, maxQty));
      return { ...prev, [productId]: next };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      // Get or generate idempotency key
      let idempotencyKey;
      if (typeof window !== "undefined") {
        idempotencyKey = window.localStorage.getItem("idempotencyKey");
        if (!idempotencyKey) {
          idempotencyKey = generateIdempotencyKey();
          window.localStorage.setItem("idempotencyKey", idempotencyKey);
        }
      }

      const items = orderItems.map(({ name, qty, id }) => ({ name, qty, productId: id }));
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey || ""
        },
        body: JSON.stringify({ name: name.trim(), items }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to join queue");
        setSubmitting(false);
        return;
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "queueTicket",
          JSON.stringify({ id: data.id, dateKey: data.dateKey })
        );
      }
      router.push(`/status/${data.id}`);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const isLoading = productsLoading || settingsLoading;

  return (
    <main className="min-h-screen bg-muted/40 py-10">
      <div className="container max-w-2xl">
        <Card className="border-none shadow-lg">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto h-28 w-28 overflow-hidden rounded-full border-4 border-white shadow">
              <Image
                src="/thechaicouple.jpg"
                alt="Fresh Irani chai and bun"
                width={160}
                height={160}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <CardTitle className="text-3xl">Join the Queue</CardTitle>
           
            {settings && settings.serviceStart && settings.serviceEnd && (
              <Badge variant="outline" className="mt-2">
                Service hours: {(() => {
                  const formatTime = (timeStr) => {
                    if (!timeStr) return "";
                    const [hours, minutes] = String(timeStr).split(":");
                    const h = Number(hours) || 0;
                    const m = Number(minutes) || 0;
                    const period = h >= 12 ? "PM" : "AM";
                    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
                    return `${displayHour}:${String(m).padStart(2, "0")} ${period}`;
                  };
                  return `${formatTime(settings.serviceStart)} – ${formatTime(settings.serviceEnd)}`;
                })()}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {!queueOpen && !settingsLoading && (
              <Alert variant="destructive">
                <AlertDescription>
                  {settings?.closedMessage ||
                    "Queue is currently closed. Please visit us during service hours."}
                </AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Your Full Name "
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!queueOpen}
                  required
                />
              </div>

              <div className="space-y-3">
                {productsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : availableProducts.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <p>No products available at the moment.</p>
                  </div>
                ) : (
                  availableProducts.map((product) => {
                    const qty = quantities[product.id] || 0;
                    const isLowStock = product.inventory > 0 && product.inventory <= product.buffer;
                    
                    return (
                      <div
                        key={product.id}
                        className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3"
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{product.name}</p>
                            {isLowStock && (
                              <Badge variant="default" className="text-xs bg-amber-500 hover:bg-amber-600">
                                Low Stock ({product.inventory} left)
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {currency.format(product.price)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => updateQuantity(product.id, -1)}
                            disabled={qty === 0}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center text-lg font-semibold">
                            {qty}
                          </span>
                          <Button
                            type="button"
                            size="icon"
                            onClick={() => updateQuantity(product.id, 1)}
                            disabled={!queueOpen || qty >= product.inventory}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {orderItems.length > 0 && (
                <div className="rounded-2xl border bg-muted/40 p-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Summary</span>
                    <Badge variant="secondary">{orderItems.length} items</Badge>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm">
                    {orderItems.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between text-muted-foreground"
                      >
                        <span>
                          {item.name} × {item.qty}
                        </span>
                        <span>{currency.format((item.price || 0) * item.qty)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex items-center justify-between font-semibold">
                    <span>Total</span>
                    <span>{currency.format(total)}</span>
                  </div>
                  {/* {total > 0 && (
                    <div className="mt-4 flex justify-center">
                      <a
                        href="https://www.upi.me/pay?pa=alanjohnchacko.live-1@okicici&am=20"
                        className="inline-block rounded-lg bg-black px-5 py-2.5 text-white no-underline transition-opacity hover:opacity-90"
                        style={{ padding: "10px 20px", background: "black", color: "white", borderRadius: "8px", textDecoration: "none" }}
                      >
                        Pay with GPay
                      </a>
                    </div>
                  )} */}
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {submitting ? "Adding you to the Queue..." : "Join Queue"}
              </Button>
            </form>

           
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>Need help? Ask a staff member to rescan the QR.</span>
           
          </CardFooter>
        </Card>
        {settingsError && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{settingsError}</AlertDescription>
          </Alert>
        )}
      </div>
      <footer className="w-full py-4 text-center text-sm text-muted-foreground">
        Developed by{" "}
        <a
          href="https://devou.in"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground hover:underline"
        >
          Devou Solutions
        </a>
      </footer>
    </main>
  );
}

