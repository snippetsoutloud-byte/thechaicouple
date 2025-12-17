"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LogOut, RotateCw } from "lucide-react";

import { getTodayKey } from "@/lib/firebase";
import { getCachedPricing, setCachedPricing } from "@/lib/pricing-cache";
import { isChai, isTiramisu, isBun, isMilkBun, isHotChocolate } from "@/lib/item-names";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
});

export default function StatusPage() {
  const { id } = useParams();
  const router = useRouter();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState({ chaiPrice: 0, bunPrice: 0, tiramisuPrice: 0, milkBunPrice: 0, hotChocolatePrice: 0 });
  const [streamSettings, setStreamSettings] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("connecting"); // "connected", "disconnected", "error", "connecting"
  const [exitDialogOpen, setExitDialogOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    const dateKey = getTodayKey();
    let source = null;
    let reconnectTimeout = null;
    let isMounted = true;
    
    // Track if we've seen the ticket at least once
    let hasSeenTicket = false;
    
    function connect() {
      if (!isMounted) return;
      
      source = new EventSource(`/api/queue/stream?date=${dateKey}`);
      
      source.onopen = () => {
        if (isMounted) {
          setConnectionStatus("connected");
        }
      };
      
      source.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.settings) {
            setStreamSettings(payload.settings);
          }
          const tickets = Array.isArray(payload.tickets) ? payload.tickets : [];
          const ticket = tickets.find((t) => t.id === id);
          
          if (!ticket) {
            // Ticket not found - check if we've seen it before
            if (hasSeenTicket) {
              // Ticket was removed or doesn't exist anymore - redirect to queue
              if (typeof window !== "undefined") {
                window.localStorage.removeItem("queueTicket");
                window.localStorage.removeItem("idempotencyKey"); // Clear idempotency key
              }
              // Redirect to queue page
              router.replace("/q");
              return;
            } else {
              // First check - ticket might not exist yet, keep loading
              setLoading(true);
            }
            return;
          }
          
          // Ticket found
          hasSeenTicket = true;
          const waitingTickets = tickets.filter((t) => t.status === "waiting");
          const waitingIndex = waitingTickets.findIndex((t) => t.id === id);
          setData({
            ...ticket,
            position: waitingIndex === -1 ? null : waitingIndex + 1,
            dateKey: payload.dateKey,
          });
          setLoading(false);
          setConnectionStatus("connected");
        } catch {
          // Keep loading state, don't show error
          if (isMounted) {
            setConnectionStatus("error");
          }
        }
      };
      
      source.onerror = () => {
        if (!isMounted) return;
        setConnectionStatus("disconnected");
        if (source) {
          source.close();
        }
        
        // Try to reconnect after a delay
        reconnectTimeout = setTimeout(() => {
          if (isMounted) {
            setConnectionStatus("connecting");
            connect();
          }
        }, 3000);
      };
    }
    
    connect();
    
    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (source) {
        source.close();
      }
      setConnectionStatus("disconnected");
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;

    // Ensure ticket is stored locally for resume flow
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("queueTicket");
      if (!stored) {
        window.localStorage.setItem(
          "queueTicket",
          JSON.stringify({ id, dateKey: getTodayKey() })
        );
      }
    }

    let ignore = false;

    async function loadInitialTicket() {
      try {
        // Prefer dateKey from localStorage if it matches this id
        let dateKey = getTodayKey();
        if (typeof window !== "undefined") {
          const stored = window.localStorage.getItem("queueTicket");
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              if (parsed?.id === id && parsed.dateKey) {
                dateKey = parsed.dateKey;
              }
            } catch {
              // ignore parse errors
            }
          }
        }

        const res = await fetch(
          `/api/position?id=${encodeURIComponent(id)}&date=${encodeURIComponent(
            dateKey
          )}`
        );

        if (!res.ok) {
          // If ticket truly doesn't exist, send user back to queue
          if (res.status === 404) {
            if (typeof window !== "undefined") {
              window.localStorage.removeItem("queueTicket");
              window.localStorage.removeItem("idempotencyKey"); // Clear idempotency key
            }
            router.replace("/q");
          }
          return;
        }

        const ticket = await res.json();
        if (ignore) return;

        setData({
          ...ticket,
          dateKey,
        });
        setLoading(false);
      } catch {
        // If this fails, we still have the stream as a fallback
      }
    }

    loadInitialTicket();

    return () => {
      ignore = true;
    };
  }, [id, router]);

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
          tiramisuPrice: Number(data.tiramisuPrice) || 0,
          milkBunPrice: Number(data.milkBunPrice) || 0,
          hotChocolatePrice: Number(data.hotChocolatePrice) || 0,
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

  const orderSummary = useMemo(() => {
    if (!data?.items) return [];
        return data.items
      .filter((item) => item.qty > 0)
      .map((item) => {
        let price = pricing.bunPrice;
        if (isChai(item.name)) {
          price = pricing.chaiPrice;
        } else if (isTiramisu(item.name)) {
          price = pricing.tiramisuPrice;
        } else if (isMilkBun(item.name)) {
          price = pricing.milkBunPrice;
        } else if (isHotChocolate(item.name)) {
          price = pricing.hotChocolatePrice;
        }
        const subtotal = (price || 0) * item.qty;
        return { name: item.name, qty: item.qty, price, subtotal };
      });
  }, [data, pricing]);

  const orderTotal = useMemo(
    () => orderSummary.reduce((sum, item) => sum + item.subtotal, 0),
    [orderSummary]
  );

  async function handleExitQueue() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("queueTicket");
      window.localStorage.removeItem("idempotencyKey"); // Clear idempotency key
    }
    try {
      const dateKey = data?.dateKey || getTodayKey();
      await fetch(
        `/api/ticket?id=${encodeURIComponent(id)}&date=${encodeURIComponent(
          dateKey
        )}`,
        { method: "DELETE" }
      );
    } catch {
      // ignore
    } finally {
      setExitDialogOpen(false);
      router.replace("/q");
    }
  }

  const status = data?.status || "waiting";
  const tokenNumber = data?.basePosition ?? null;

  const isSoldOut = useMemo(() => {
    if (!data?.items || !streamSettings?.availability) return false;
    const availability = streamSettings.availability;
    return data.items.some((item) => {
      if (item.qty <= 0) return false;
      if (isChai(item.name) && !availability.chai) return true;
      if (isBun(item.name) && !availability.bun) return true;
      return false;
    });
  }, [data, streamSettings]);

  useEffect(() => {
    if (status !== "ready") return;
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("queueTicket");
      window.localStorage.removeItem("idempotencyKey"); // Clear idempotency key when order is ready
    }
    router.replace(`/served/${id}`);
  }, [status, router, id]);

  return (
    <main className="min-h-screen bg-muted/40 py-10">
      <div className="container max-w-xl">
        <Card className="border-none shadow-lg">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              {tokenNumber && (
                <Badge className="bg-amber-100 text-amber-900 text-base px-4 py-1">
                  Token #{tokenNumber}
                </Badge>
              )}
            </div>
            <div className="text-center space-y-4">
            <div className="mx-auto h-28 w-28 overflow-hidden rounded-full border-4 border-white shadow">
              <Image
                src="/thechaicouple.jpg"
                alt="Chai being served"
                width={160}
                height={160}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <div className="flex items-center justify-center gap-2">
              <CardTitle className="text-3xl">Your Token</CardTitle>
              <div className="flex items-center gap-1.5">
                <div
                  className={`h-2 w-2 rounded-full ${
                    connectionStatus === "connected"
                      ? "bg-green-500 animate-pulse"
                      : connectionStatus === "connecting"
                      ? "bg-yellow-500 animate-pulse"
                      : "bg-red-500"
                  }`}
                  title={
                    connectionStatus === "connected"
                      ? "Live"
                      : connectionStatus === "connecting"
                      ? "Connecting..."
                      : "Reconnecting..."
                  }
                />
              </div>
            </div>
            <CardDescription>
              Keep this page open—your position updates every few seconds.
            </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-24 mx-auto" />
                <Skeleton className="h-10 w-32 mx-auto" />
                <Skeleton className="h-24 rounded-2xl" />
              </div>
            ) : (
              data && (
                <div className="space-y-5 text-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="text-2xl font-semibold">{data.name}</p>
                  </div>
                  {/* {tokenNumber && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Token number
                      </p>
                      <div className="inline-flex items-center justify-center rounded-full border border-primary/30 bg-primary/5 px-4 py-1 text-lg font-semibold text-primary">
                        #{tokenNumber}
                      </div>
                    </div>
                  )} */}
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Current Queue Position
                    </p>
                    <p className="text-4xl font-bold">
                      {data.position === null ? "-" : data.position}
                    </p>
                  </div>
                  {isSoldOut ? (
                    <Alert variant="destructive" className="text-center">
                      <AlertDescription className="font-semibold">
                        One or more items in your order are now sold out. Please exit the queue and rejoin when items are available again.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Badge
                      variant={status === "ready" ? "secondary" : "outline"}
                      className={`px-5 py-1.5 text-base ${
                        status === "ready"
                          ? "bg-green-50 text-green-900 border-green-100"
                          : "border-yellow-300 text-yellow-700"
                      }`}
                    >
                      {status === "ready" ? "Ready for pickup" : "Waiting"}
                    </Badge>
                  )}

                  {orderSummary.length > 0 && (
                    <div className="rounded-2xl border bg-card p-4 text-left">
                      <p className="text-sm text-muted-foreground mb-2">
                        Order
                      </p>
                      <div className="space-y-2 text-sm">
                        {orderSummary.map((item) => {
                          const isItemSoldOut =
                            streamSettings?.availability &&
                            ((isChai(item.name) &&
                              !streamSettings.availability.chai) ||
                              (isBun(item.name) &&
                                !streamSettings.availability.bun));
                          return (
                            <div
                              key={item.name}
                              className="flex items-center justify-between text-muted-foreground"
                            >
                              <span className="flex items-center gap-2">
                                {item.name} × {item.qty}
                                {isItemSoldOut && (
                                  <Badge
                                    variant="destructive"
                                    className="text-xs"
                                  >
                                    Sold out
                                  </Badge>
                                )}
                              </span>
                              <span>{currency.format(item.subtotal)}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-3 flex items-center justify-between font-semibold">
                        <span>Total</span>
                        <span>{currency.format(orderTotal)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setExitDialogOpen(true)}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Exit Queue
              </Button>
            </div>
            <Dialog open={exitDialogOpen} onOpenChange={setExitDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Exit queue?</DialogTitle>
                  <DialogDescription>
                    Your current token will be removed and you&apos;ll lose your place in line.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setExitDialogOpen(false)}
                  >
                    Stay in queue
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full sm:w-auto"
                    onClick={handleExitQueue}
                  >
                    Yes, exit queue
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {/* <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Tokens reset nightly.</span>
              <span>Need help? Visit the counter.</span>
            </div> */}
          </CardFooter>
        </Card>
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

