"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LogOut, Ticket, Receipt, Loader2 } from "lucide-react";
import { getTodayKey } from "@/lib/firebase";
import { getCachedPricing, setCachedPricing } from "@/lib/pricing-cache";
import { isChai, isTiramisu, isBun, isMilkBun } from "@/lib/item-names";

export default function ChristmasStatus() {
  const { id } = useParams();
  const router = useRouter();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState({ chaiPrice: 0, bunPrice: 0, tiramisuPrice: 0, milkBunPrice: 0 });
  const [streamSettings, setStreamSettings] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [exiting, setExiting] = useState(false);

  // SSE for real-time updates
  useEffect(() => {
    if (!id) return;
    const dateKey = getTodayKey();
    let source = null;
    let reconnectTimeout = null;
    let isMounted = true;
    let hasSeenTicket = false;

    function connect() {
      if (!isMounted) return;
      source = new EventSource(`/api/queue/stream?date=${dateKey}`);

      source.onopen = () => {
        if (isMounted) setConnectionStatus("connected");
      };

      source.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.settings) setStreamSettings(payload.settings);
          
          const tickets = Array.isArray(payload.tickets) ? payload.tickets : [];
          const ticket = tickets.find((t) => t.id === id);

          if (!ticket) {
            if (hasSeenTicket) {
              if (typeof window !== "undefined") {
                window.localStorage.removeItem("queueTicket");
                window.localStorage.removeItem("idempotencyKey");
              }
              router.replace("/q");
              return;
            } else {
              setLoading(true);
            }
            return;
          }

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
          if (isMounted) setConnectionStatus("error");
        }
      };

      source.onerror = () => {
        if (!isMounted) return;
        setConnectionStatus("disconnected");
        if (source) source.close();
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
      if (source) source.close();
      setConnectionStatus("disconnected");
    };
  }, [id, router]);

  // Load initial ticket
  useEffect(() => {
    if (!id) return;

    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("queueTicket");
      if (!stored) {
        window.localStorage.setItem("queueTicket", JSON.stringify({ id, dateKey: getTodayKey() }));
      }
    }

    let ignore = false;

    async function loadInitialTicket() {
      try {
        let dateKey = getTodayKey();
        if (typeof window !== "undefined") {
          const stored = window.localStorage.getItem("queueTicket");
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              if (parsed?.id === id && parsed.dateKey) dateKey = parsed.dateKey;
            } catch {}
          }
        }

        const res = await fetch(`/api/position?id=${encodeURIComponent(id)}&date=${encodeURIComponent(dateKey)}`);
        if (!res.ok) {
          if (res.status === 404) {
            if (typeof window !== "undefined") {
              window.localStorage.removeItem("queueTicket");
              window.localStorage.removeItem("idempotencyKey");
            }
            router.replace("/q");
          }
          return;
        }

        const ticket = await res.json();
        if (ignore) return;
        setData({ ...ticket, dateKey });
        setLoading(false);
      } catch {}
    }

    loadInitialTicket();
    return () => { ignore = true; };
  }, [id, router]);

  // Load pricing
  useEffect(() => {
    let ignore = false;
    const cached = getCachedPricing();
    if (cached?.data) {
      setPricing(cached.data);
      if (cached.fresh) return;
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
        };
        if (!ignore) setPricing(next);
        setCachedPricing(next);
      } catch {}
    }
    loadPricing();
    return () => { ignore = true; };
  }, []);

  const orderSummary = useMemo(() => {
    if (!data?.items) return [];
    return data.items
      .filter((item) => item.qty > 0)
      .map((item) => {
        let price = pricing.bunPrice;
        if (isChai(item.name)) price = pricing.chaiPrice;
        else if (isTiramisu(item.name)) price = pricing.tiramisuPrice;
        else if (isMilkBun(item.name)) price = pricing.milkBunPrice;
        const subtotal = (price || 0) * item.qty;
        return { name: item.name, qty: item.qty, price, subtotal };
      });
  }, [data, pricing]);

  const orderTotal = useMemo(() => orderSummary.reduce((sum, item) => sum + item.subtotal, 0), [orderSummary]);

  async function handleExitQueue() {
    setExiting(true);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("queueTicket");
      window.localStorage.removeItem("idempotencyKey");
    }
    try {
      const dateKey = data?.dateKey || getTodayKey();
      await fetch(`/api/ticket?id=${encodeURIComponent(id)}&date=${encodeURIComponent(dateKey)}`, { method: "DELETE" });
    } catch {}
    finally {
      setExitDialogOpen(false);
      setExiting(false);
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

  // Redirect when ready
  useEffect(() => {
    if (status !== "ready") return;
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("queueTicket");
      window.localStorage.removeItem("idempotencyKey");
    }
    router.replace(`/served/${id}`);
  }, [status, router, id]);

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Mountains+of+Christmas:wght@700&display=swap');
        
        .font-holiday { font-family: 'Mountains of Christmas', cursive; }
        
        .light-cable {
          position: absolute; top: -15px; left: 0; width: 100%; height: 40px;
          border-bottom: 2px solid #333; border-radius: 50%; z-index: 20; pointer-events: none;
        }
        .light {
          position: absolute; top: 24px; width: 12px; height: 12px; border-radius: 50%; z-index: 21;
          box-shadow: 0px 5px 20px 2px rgba(255,255,255,0.5); animation: glow 1.5s infinite alternate;
        }
        .snowflake {
          position: absolute; color: #fff; pointer-events: none; z-index: 1; animation: fall linear infinite;
        }
        @keyframes fall {
          0% { transform: translateY(-10vh) translateX(-10px); opacity: 0; }
          20% { opacity: 0.6; }
          100% { transform: translateY(110vh) translateX(10px); opacity: 0; }
        }
        @keyframes glow {
          0% { opacity: 0.7; transform: scale(1); }
          100% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes swing {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }
        .animate-swing { animation: swing 3s ease-in-out infinite; }
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .animate-pulse-slow { animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      `}</style>

      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden text-gray-800" style={{ backgroundColor: '#0A1A12' }}>
        {/* String Lights */}
        <div className="fixed top-0 w-full h-20 z-20 pointer-events-none">
          <div className="light-cable"></div>
          <div className="light left-[10%]" style={{ backgroundColor: '#ef4444', animationDelay: '0s' }}></div>
          <div className="light left-[30%]" style={{ backgroundColor: '#facc15', animationDelay: '0.5s' }}></div>
          <div className="light left-[50%]" style={{ backgroundColor: '#22c55e', animationDelay: '0.2s' }}></div>
          <div className="light left-[70%]" style={{ backgroundColor: '#60a5fa', animationDelay: '0.7s' }}></div>
          <div className="light left-[90%]" style={{ backgroundColor: '#ef4444', animationDelay: '0.1s' }}></div>
        </div>

        {/* Background Blurs */}
        <div className="fixed top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none" style={{ backgroundColor: '#D42426', filter: 'blur(120px)', opacity: 0.2 }}></div>
        <div className="fixed bottom-0 right-0 w-full h-64 pointer-events-none" style={{ background: 'linear-gradient(to top, #14452F, transparent)', opacity: 0.4 }}></div>

        {/* Snow */}
        <SnowContainer />

        <div className="w-full max-w-[400px] relative z-10 mt-8">
          {/* Hanging Ornament */}
          <div className="absolute -top-10 right-6 z-0 flex flex-col items-center animate-swing origin-top">
            <div className="h-12 w-0.5" style={{ backgroundColor: 'rgba(244, 202, 93, 0.5)' }}></div>
            <div className="w-8 h-8 rounded-full shadow-lg border border-white flex items-center justify-center" style={{ backgroundColor: '#F4CA5D' }}>
              <span className="text-[10px]">✨</span>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden relative border-4 border-white/20 pb-6">
            {/* Snow Wave SVG */}
            <svg className="absolute top-0 left-0 w-full z-0 drop-shadow-sm" viewBox="0 0 1440 320" preserveAspectRatio="none" height="60" style={{ fill: '#F0F8FF' }}>
              <path fillOpacity="1" d="M0,64L48,80C96,96,192,128,288,128C384,128,480,96,576,85.3C672,75,768,85,864,112C960,139,1056,181,1152,181.3C1248,181,1344,139,1392,117.3L1440,96L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"></path>
            </svg>

            {/* Token Badge */}
            {tokenNumber && (
              <div className="absolute top-4 left-4 z-20">
                <div className="backdrop-blur-sm px-3 py-1 rounded-lg shadow-sm flex items-center gap-1.5" style={{ backgroundColor: 'rgba(244, 202, 93, 0.2)', border: '1px solid rgba(244, 202, 93, 0.5)', color: '#92400e' }}>
                  <Ticket className="w-3 h-3" />
                  <span className="text-xs font-bold uppercase tracking-wider">Token #{tokenNumber}</span>
                </div>
              </div>
            )}

            {/* Connection Status */}
            <div className="absolute top-4 right-4 z-20">
              <div
                className={`h-2 w-2 rounded-full ${
                  connectionStatus === "connected"
                    ? "bg-green-500 animate-pulse"
                    : connectionStatus === "connecting"
                    ? "bg-yellow-500 animate-pulse"
                    : "bg-red-500"
                }`}
                title={connectionStatus === "connected" ? "Live" : connectionStatus === "connecting" ? "Connecting..." : "Reconnecting..."}
              />
            </div>

            <div className="p-6 pt-12 relative z-10 text-center">
              {/* Logo */}
              <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center border-4 shadow-md relative mb-4" style={{ borderColor: '#14452F' }}>
                <span className="text-3xl">☕</span>
                <div className="absolute -bottom-2 w-20 h-4 rounded-sm shadow-sm text-[8px] text-white flex items-center justify-center font-bold tracking-widest uppercase" style={{ backgroundColor: '#D42426' }}>
                  Chai Couple
                </div>
              </div>

              <h1 className="font-holiday text-4xl text-gray-900 drop-shadow-sm">Your Token</h1>
              <p className="text-xs text-gray-500 mt-2 font-medium">
                Keep this page open—elves are updating your status!
              </p>

              {loading ? (
                <div className="mt-8 flex flex-col items-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  <p className="text-sm text-gray-400">Loading your token...</p>
                </div>
              ) : data && (
                <>
                  {/* Guest Name */}
                  <div className="mt-8 mb-2">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Guest Name</p>
                    <h2 className="text-2xl font-serif font-bold tracking-wide" style={{ color: '#0A1A12' }}>{data.name}</h2>
                  </div>

                  {/* Queue Position */}
                  <div className="my-6">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-2">Queue Position</p>
                    <div className="relative inline-block">
                      <span className="font-holiday text-7xl relative z-10" style={{ color: '#D42426' }}>
                        {data.position === null ? "-" : data.position}
                      </span>
                      <div className="absolute inset-0 blur-xl rounded-full z-0" style={{ backgroundColor: 'rgba(244, 202, 93, 0.3)' }}></div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="mb-8">
                    {isSoldOut ? (
                      <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border text-sm font-bold" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#dc2626' }}>
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span>Item Sold Out</span>
                      </div>
                    ) : status === "ready" ? (
                      <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border shadow-sm" style={{ backgroundColor: '#dcfce7', borderColor: '#bbf7d0', color: '#166534' }}>
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="font-bold text-sm">Ready for Pickup!</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border shadow-sm animate-pulse-slow" style={{ backgroundColor: '#fefce8', borderColor: '#fef08a', color: '#a16207' }}>
                        <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#eab308' }}></div>
                        <span className="font-bold text-sm">Waiting</span>
                      </div>
                    )}
                  </div>

                  {/* Sold Out Warning */}
                  {isSoldOut && (
                    <div className="mb-4 p-3 rounded-xl text-sm font-medium text-left" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                      One or more items in your order are now sold out. Please exit the queue and rejoin when items are available again.
                    </div>
                  )}

                  {/* Order Summary */}
                  {orderSummary.length > 0 && (
                    <div className="border rounded-xl overflow-hidden text-left relative shadow-inner" style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
                      <div className="p-4">
                        <p className="text-[10px] uppercase text-gray-400 font-bold mb-3 border-b border-gray-200 pb-2 flex justify-between">
                          <span>Your Wishlist</span>
                          <Receipt className="w-3 h-3" />
                        </p>
                        
                        {orderSummary.map((item) => {
                          const isItemSoldOut = streamSettings?.availability && (
                            (isChai(item.name) && !streamSettings.availability.chai) ||
                            (isBun(item.name) && !streamSettings.availability.bun)
                          );
                          return (
                            <div key={item.name} className="flex justify-between items-center text-sm font-medium text-gray-700 mb-2">
                              <span className="flex items-center gap-2">
                                {item.name} × {item.qty}
                                {isItemSoldOut && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
                                    Sold out
                                  </span>
                                )}
                              </span>
                              <span>₹{item.subtotal}</span>
                            </div>
                          );
                        })}
                        
                        <div className="border-t border-dashed border-gray-300 my-2 pt-2 flex justify-between items-center">
                          <span className="font-bold text-gray-900">Total</span>
                          <span className="font-bold text-lg" style={{ color: '#D42426' }}>₹{orderTotal}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Exit Button */}
                  <button
                    onClick={() => setExitDialogOpen(true)}
                    className="mt-6 flex items-center justify-center gap-2 text-gray-400 text-sm font-medium hover:text-red-600 transition-colors group w-full py-2"
                  >
                    <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Exit Queue
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="text-center mt-4 pb-4">
            <p className="text-[10px] uppercase tracking-widest font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Developed by <span style={{ color: 'rgba(255,255,255,0.6)' }}>Devou Solutions</span>
            </p>
          </div>
        </div>

        {/* Exit Dialog */}
        {exitDialogOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Exit queue?</h3>
              <p className="text-gray-500 text-sm mb-6">
                Your current token will be removed and you&apos;ll lose your place in line.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setExitDialogOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  disabled={exiting}
                >
                  Stay in queue
                </button>
                <button
                  onClick={handleExitQueue}
                  disabled={exiting}
                  className="flex-1 py-2.5 px-4 rounded-xl text-white font-medium transition-colors"
                  style={{ backgroundColor: '#dc2626' }}
                >
                  {exiting ? "Exiting..." : "Yes, exit"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// Snow animation component
function SnowContainer() {
  const [flakes, setFlakes] = useState([]);

  useEffect(() => {
    const snowflakes = [];
    for (let i = 0; i < 30; i++) {
      snowflakes.push({
        id: i,
        left: Math.random() * 100,
        text: Math.random() > 0.5 ? '❄' : '•',
        fontSize: Math.random() * 20 + 10,
        duration: Math.random() * 3 + 4,
        delay: Math.random() * 5,
      });
    }
    setFlakes(snowflakes);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      {flakes.map((flake) => (
        <div
          key={flake.id}
          className="snowflake"
          style={{
            left: `${flake.left}vw`,
            fontSize: `${flake.fontSize}px`,
            animationDuration: `${flake.duration}s`,
            animationDelay: `${flake.delay}s`,
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          {flake.text}
        </div>
      ))}
    </div>
  );
}

