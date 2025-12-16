"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Check, CheckCircle2, CupSoda, Loader2, Home } from "lucide-react";
import { getTodayKey } from "@/lib/firebase";
import { getCachedPricing, setCachedPricing } from "@/lib/pricing-cache";
import { isChai, isTiramisu, isMilkBun } from "@/lib/item-names";

export default function ChristmasServed() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pricing, setPricing] = useState({ chaiPrice: 0, bunPrice: 0, tiramisuPrice: 0, milkBunPrice: 0 });

  // Load ticket and play sound
  useEffect(() => {
    if (!id) return;

    // Play sound effect
    const audio = new Audio("/Order-up-bell-sound-effect.mp3");
    audio.play().catch(() => {});

    async function loadTicket() {
      try {
        const dateKey = getTodayKey();
        const res = await fetch(`/api/position?id=${encodeURIComponent(id)}&date=${encodeURIComponent(dateKey)}`);
        if (!res.ok) {
          const json = await res.json();
          setError(json.error || "Failed to load order");
          setLoading(false);
          return;
        }
        const ticketData = await res.json();
        setData(ticketData);
        setLoading(false);
      } catch {
        setError("Failed to load order");
        setLoading(false);
      }
    }

    loadTicket();
  }, [id]);

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
  const tokenNumber = data?.basePosition ?? null;

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Mountains+of+Christmas:wght@700&display=swap');
        
        .font-holiday { font-family: 'Mountains of Christmas', cursive; }
        
        .light-cable {
          position: absolute; top: -15px; left: 0; width: 100%; height: 40px;
          border-bottom: 2px solid #333; border-radius: 50%; z-index: 20; pointer-events: none;
        }
        .light {
          position: absolute; top: 24px; width: 12px; height: 12px; border-radius: 50%; z-index: 21;
          box-shadow: 0px 5px 20px 2px rgba(255,255,255,0.5);
        }
        .snowflake {
          position: absolute; color: #fff; pointer-events: none; z-index: 1; animation: fall linear infinite;
        }
        @keyframes fall {
          0% { transform: translateY(-10vh) translateX(-10px); opacity: 0; }
          20% { opacity: 0.6; }
          100% { transform: translateY(110vh) translateX(10px); opacity: 0; }
        }
        @keyframes pop {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-pop { animation: pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .bg-candy-cane {
          background: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255, 255, 255, 0.2) 10px, rgba(255, 255, 255, 0.2) 20px);
        }
        .receipt-b {
          position: relative;
        }
        .receipt-b::after {
          content: "";
          position: absolute;
          bottom: -8px;
          left: 0;
          width: 100%;
          height: 16px;
          background: linear-gradient(135deg, transparent 50%, #f9fafb 50%), linear-gradient(45deg, #f9fafb 50%, transparent 50%);
          background-size: 16px 16px;
          background-repeat: repeat-x;
        }
      `}</style>

      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden text-gray-800" style={{ backgroundColor: '#0A1A12' }}>
        {/* String Lights */}
        <div className="fixed top-0 w-full h-20 z-20 pointer-events-none">
          <div className="light-cable"></div>
          <div className="light left-[15%] animate-pulse" style={{ backgroundColor: '#ef4444' }}></div>
          <div className="light left-[35%] animate-pulse" style={{ backgroundColor: '#22c55e', animationDelay: '0.3s' }}></div>
          <div className="light left-[55%] animate-pulse" style={{ backgroundColor: '#facc15', animationDelay: '0.6s' }}></div>
          <div className="light left-[75%] animate-pulse" style={{ backgroundColor: '#ef4444', animationDelay: '0.9s' }}></div>
        </div>

        {/* Background Blurs */}
        <div className="fixed top-1/4 right-1/4 w-96 h-96 rounded-full pointer-events-none" style={{ backgroundColor: '#14452F', filter: 'blur(120px)', opacity: 0.2 }}></div>
        <div className="fixed bottom-0 left-0 w-full h-64 pointer-events-none" style={{ background: 'linear-gradient(to top, #D42426, transparent)', opacity: 0.2 }}></div>

        {/* Snow */}
        <SnowContainer />

        <div className="w-full max-w-[420px] relative z-10 mt-6">
          {/* Celebration Emojis */}
          <div className="absolute -top-12 left-0 w-full flex justify-between px-10 pointer-events-none z-0">
            <span className="text-4xl animate-bounce">🎉</span>
            <span className="text-4xl animate-bounce" style={{ animationDelay: '0.5s' }}>✨</span>
          </div>

          {loading ? (
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-12 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-gray-400 mx-auto" />
              <p className="mt-4 text-gray-500">Loading your order...</p>
            </div>
          ) : error || !data ? (
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 text-center">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Order Not Found</h2>
              <p className="text-gray-500 mb-6">{error || "Unable to load order details"}</p>
              <Link
                href="/q"
                className="inline-block px-6 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Back to Queue
              </Link>
            </div>
          ) : (
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden relative border-4 border-white/20 pb-8 animate-pop">
              {/* Snow Wave SVG */}
              <svg className="absolute top-0 left-0 w-full z-0" viewBox="0 0 1440 320" preserveAspectRatio="none" height="60" style={{ fill: '#F0F8FF' }}>
                <path fillOpacity="1" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,149.3C1248,139,1344,85,1392,58.7L1440,32L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"></path>
              </svg>

              <div className="p-6 pt-10 relative z-10 text-center">
                {/* Logo with Check */}
                <div className="relative inline-block mb-4">
                  <div className="w-24 h-24 mx-auto bg-white rounded-full flex items-center justify-center border-4 shadow-lg relative" style={{ borderColor: '#F4CA5D' }}>
                    <span className="text-4xl">☕</span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white border-2 border-white shadow-md">
                    <Check className="w-5 h-5 font-bold" />
                  </div>
                </div>

                {/* Badges */}
                <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
                  <span className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1" style={{ backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
                    <CheckCircle2 className="w-3 h-3" /> Order Complete
                  </span>
                  {tokenNumber && (
                    <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-500 text-xs font-bold shadow-sm">
                      Token #{tokenNumber}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h1 className="font-holiday text-3xl mb-2 drop-shadow-sm leading-tight" style={{ color: '#D42426' }}>
                  Ho Ho Ho! <br /> Your Food is Ready.
                </h1>
                <p className="text-xs text-gray-500 max-w-[260px] mx-auto leading-relaxed">
                  Show this screen to the elves at the counter, collect your order, and enjoy!
                </p>

                {/* Customer Name */}
                {data.name && (
                  <div className="mt-6">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Order For</p>
                    <h2 className="text-2xl font-serif font-bold text-gray-900">{data.name}</h2>
                  </div>
                )}

                {/* Order Summary */}
                {orderSummary.length > 0 && (
                  <div className="mt-6 mx-2">
                    <div className="rounded-t-xl border-x border-t p-5 shadow-inner receipt-b" style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] uppercase font-bold text-gray-400">Order Summary</span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ backgroundColor: '#e5e7eb', color: '#4b5563' }}>
                          {orderSummary.reduce((sum, item) => sum + item.qty, 0)} Item{orderSummary.reduce((sum, item) => sum + item.qty, 0) > 1 ? 's' : ''}
                        </span>
                      </div>
                      
                      {orderSummary.map((item, index) => (
                        <div key={index} className="flex justify-between items-start text-sm text-gray-800 font-medium mb-2">
                          <span>{item.name} × {item.qty}</span>
                          <span>₹{item.subtotal}</span>
                        </div>
                      ))}
                      
                      <div className="border-t border-dashed border-gray-300 pt-3 flex justify-between items-center">
                        <span className="font-bold text-gray-900">Total Paid</span>
                        <span className="font-bold text-xl" style={{ color: '#D42426' }}>₹{orderTotal}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Info Text */}
                <p className="mt-8 text-[10px] text-gray-400 px-4 leading-normal">
                  We&apos;ve cleared your token from the queue. If you&apos;d like another chai or bun, feel free to rejoin!
                </p>

                {/* Action Buttons */}
                <div className="mt-6 space-y-3 px-2">
                  <Link
                    href="/q"
                    className="group w-full py-3.5 rounded-xl font-bold text-base shadow-lg relative overflow-hidden text-white transition-transform hover:scale-[1.02] flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#14452F' }}
                  >
                    <div className="absolute inset-0 bg-candy-cane opacity-10 group-hover:opacity-20 transition-opacity"></div>
                    <CupSoda className="w-5 h-5 relative z-10" />
                    <span className="relative z-10">Order Another Round</span>
                  </Link>
                  
                  <Link
                    href="/q"
                    className="w-full py-3.5 rounded-xl font-semibold text-sm text-gray-500 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 hover:text-gray-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <Home className="w-4 h-4" />
                    Back to Home
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className="text-center mt-6 pb-6">
            <p className="text-[10px] uppercase tracking-widest font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Developed by <span style={{ color: 'rgba(255,255,255,0.6)' }} className="font-bold">Devou Solutions</span>
            </p>
          </div>
        </div>
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

