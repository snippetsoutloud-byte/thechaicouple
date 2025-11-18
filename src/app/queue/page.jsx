"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";

import { getTodayKey } from "@/lib/firebase";
import { getCachedPricing, setCachedPricing } from "@/lib/pricing-cache";
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

const MENU = [
  { key: "chai", label: "Irani Chai" },
  { key: "bun", label: "Bun" },
];

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
});

export default function QueuePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [quantities, setQuantities] = useState({ chai: 0, bun: 0 });
  const [pricing, setPricing] = useState({ chaiPrice: 0, bunPrice: 0 });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => {
    let ignore = false;
    const cached = getCachedPricing();
    if (cached?.data) {
      setPricing(cached.data);
      if (cached.fresh) {
        return;
      }
    }

    async function loadPricing() {
      try {
        const res = await fetch("/api/pricing");
        if (!res.ok) return;
        const data = await res.json();
        const next = {
          chaiPrice: Number(data.chaiPrice) || 0,
          bunPrice: Number(data.bunPrice) || 0,
        };
        if (!ignore) {
          setPricing(next);
        }
        setCachedPricing(next);
      } catch {
        // ignore
      }
    }
    loadPricing();
    return () => {
      ignore = true;
    };
  }, []);

  const orderItems = useMemo(
    () =>
      MENU.map((item) => ({
        name: item.label,
        key: item.key,
        qty: quantities[item.key] || 0,
        price: item.key === "chai" ? pricing.chaiPrice : pricing.bunPrice,
      })).filter((item) => item.qty > 0),
    [quantities, pricing]
  );

  const total = orderItems.reduce(
    (sum, item) => sum + (item.price || 0) * item.qty,
    0
  );

  const canSubmit =
    name.trim().length > 0 && orderItems.length > 0 && !submitting;

  function updateQuantity(key, delta) {
    setQuantities((prev) => {
      const next = Math.max(0, (prev[key] || 0) + delta);
      return { ...prev, [key]: next };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const items = orderItems.map(({ name, qty }) => ({ name, qty }));
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
            <CardDescription>
              Tell us your name, choose your snacks, and get a live token instantly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Alan John"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                {MENU.map((item) => {
                  const price =
                    item.key === "chai" ? pricing.chaiPrice : pricing.bunPrice;
                  const qty = quantities[item.key] || 0;
                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {price ? currency.format(price) : "Pricing pending"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => updateQuantity(item.key, -1)}
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
                          onClick={() => updateQuantity(item.key, 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
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
                        key={item.key}
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
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {submitting ? "Adding you to the line..." : "Get My Token"}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              Today&apos;s queue resets automatically at midnight. Keep this tab open to follow your position.
            </p>
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>Need help? Ask a staff member to rescan the QR.</span>
            <Badge variant="outline">Service hours 4pm – 11pm</Badge>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}

