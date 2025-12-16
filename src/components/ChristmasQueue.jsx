"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Loader2, Clock, Gift, Snowflake } from "lucide-react";
import { getTodayKey } from "@/lib/firebase";

export default function ChristmasQueue() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [products, setProducts] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState(null);
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

  // Generate idempotency key
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
    return () => { ignore = true; };
  }, []);

  // Poll for product updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/products");
        if (res.ok) {
          const data = await res.json();
          if (data.products) {
            setProducts(data.products);
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

  // SSE for settings
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
        }
      } catch {
        setSettingsLoading(false);
      }
    };
    
    return () => source.close();
  }, []);

  // Filter to only show products with inventory > 0
  const availableProducts = useMemo(
    () => products.filter((p) => p.inventory > 0),
    [products]
  );

  const orderItems = useMemo(
    () => products
      .map((product) => ({
        name: product.name,
        id: product.id,
        qty: quantities[product.id] || 0,
        price: product.price,
      }))
      .filter((item) => item.qty > 0),
    [products, quantities]
  );

  const total = orderItems.reduce((sum, item) => sum + (item.price || 0) * item.qty, 0);
  const totalCount = orderItems.reduce((sum, item) => sum + item.qty, 0);

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

  const canSubmit = queueOpen && name.trim().length > 0 && orderItems.length > 0 && !submitting;

  function updateQuantity(productId, delta) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    setQuantities((prev) => {
      const current = prev[productId] || 0;
      const maxQty = product.inventory;
      if (delta > 0 && current >= maxQty) return prev;
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

  // Format time for display
  const formatServiceHours = () => {
    if (!settings?.serviceStart || !settings?.serviceEnd) return null;
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
  };

  const isLoading = productsLoading || settingsLoading;

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Mountains+of+Christmas:wght@700&display=swap');
        
        .font-holiday { font-family: 'Mountains of Christmas', cursive; }
        
        .snowflake {
          position: absolute;
          color: #fff;
          pointer-events: none;
          z-index: 1;
          animation: fall linear infinite;
        }
        @keyframes fall {
          0% { transform: translateY(-10vh) translateX(-10px); opacity: 0; }
          20% { opacity: 0.8; }
          100% { transform: translateY(110vh) translateX(10px); opacity: 0; }
        }
        
        .light-cable {
          position: absolute;
          top: -15px;
          left: 0;
          width: 100%;
          height: 40px;
          border-bottom: 2px solid #333;
          border-radius: 50%;
          z-index: 20;
          pointer-events: none;
        }
        
        .light {
          position: absolute;
          top: 24px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          z-index: 21;
          box-shadow: 0px 5px 20px 2px rgba(255,255,255,0.5);
          animation: glow 1.5s infinite alternate;
        }
        
        @keyframes glow {
          0% { opacity: 0.7; transform: scale(1); }
          100% { opacity: 1; transform: scale(1.1); }
        }
        
        @keyframes swing {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }
        .animate-swing { animation: swing 3s ease-in-out infinite; }
        
        .bg-candy-cane {
          background: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255, 255, 255, 0.2) 10px, rgba(255, 255, 255, 0.2) 20px);
        }
        
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #D42426; border-radius: 4px; }
      `}</style>

      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden text-gray-800" style={{ backgroundColor: '#0A1A12' }}>
        {/* String Lights */}
        <div className="fixed top-0 w-full h-20 z-20 pointer-events-none">
          <div className="light-cable"></div>
          <div className="light left-[10%]" style={{ backgroundColor: '#ef4444', animationDelay: '0s' }}></div>
          <div className="light left-[25%]" style={{ backgroundColor: '#facc15', animationDelay: '0.5s' }}></div>
          <div className="light left-[40%]" style={{ backgroundColor: '#22c55e', animationDelay: '0.2s' }}></div>
          <div className="light left-[55%]" style={{ backgroundColor: '#60a5fa', animationDelay: '0.7s' }}></div>
          <div className="light left-[70%]" style={{ backgroundColor: '#ef4444', animationDelay: '0.1s' }}></div>
          <div className="light left-[85%]" style={{ backgroundColor: '#facc15', animationDelay: '0.4s' }}></div>
        </div>

        {/* Background Blurs */}
        <div className="fixed top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none" style={{ backgroundColor: '#D42426', filter: 'blur(120px)', opacity: 0.2 }}></div>
        <div className="fixed bottom-0 right-0 w-full h-64 pointer-events-none" style={{ background: 'linear-gradient(to top, #14452F, transparent)', opacity: 0.4 }}></div>

        {/* Snow */}
        <SnowContainer />

        <div className="w-full max-w-[400px] relative z-10 mt-8">
          {/* Hanging Ornament */}
          <div className="absolute -top-16 right-8 z-30 flex flex-col items-center animate-swing origin-top">
            <div className="h-16 w-0.5" style={{ backgroundColor: 'rgba(244, 202, 93, 0.5)' }}></div>
            <div className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, #ef4444, #b91c1c)', border: '2px solid #F4CA5D' }}>
              <Snowflake className="text-white w-6 h-6" />
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden relative border-4 border-white/20">
            {/* Snow Wave SVG */}
            <svg className="absolute top-0 left-0 w-full z-0 drop-shadow-sm" viewBox="0 0 1440 320" preserveAspectRatio="none" height="80" style={{ fill: '#F0F8FF' }}>
              <path fillOpacity="1" d="M0,64L48,80C96,96,192,128,288,128C384,128,480,96,576,85.3C672,75,768,85,864,112C960,139,1056,181,1152,181.3C1248,181,1344,139,1392,117.3L1440,96L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"></path>
            </svg>

            <div className="p-6 relative z-10">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="inline-block relative">
                  <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center border-4 shadow-md relative" style={{ borderColor: '#14452F' }}>
                    <span className="text-3xl">☕</span>
                    <div className="absolute -bottom-2 w-8 h-8 rounded-full flex items-center justify-center text-xs shadow-md" style={{ backgroundColor: '#dc2626' }}>🎀</div>
                  </div>
                </div>
                
                <h1 className="font-holiday text-4xl mt-3 drop-shadow-sm" style={{ color: '#D42426' }}>Holiday Menu</h1>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">The Chai Couple</p>
                
                {settings && formatServiceHours() && (
                  <div className="mt-3 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5" style={{ backgroundColor: '#dcfce7', color: '#14452F', border: '1px solid #bbf7d0' }}>
                    <Clock className="w-3 h-3" />
                    {formatServiceHours()}
                  </div>
                )}
              </div>

              {/* Closed Alert */}
              {!queueOpen && !isLoading && (
                <div className="mb-4 p-3 rounded-xl text-sm font-medium" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                  {settings?.closedMessage || "Queue is currently closed. Please visit us during service hours."}
                </div>
              )}

              {/* Name Input */}
              <div className="mb-6">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <span className="text-xl">🎅</span>
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter Name for Queue..."
                    disabled={!queueOpen}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-green-700 focus:ring-1 focus:ring-green-700 outline-none transition-all text-sm font-semibold placeholder-gray-400"
                  />
                </div>
              </div>

              {/* Menu Items */}
              <div className="space-y-3">
                {productsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : availableProducts.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <p>No products available at the moment.</p>
                  </div>
                ) : (
                  availableProducts.map((product) => {
                    const qty = quantities[product.id] || 0;
                    const isLowStock = product.inventory > 0 && product.inventory <= product.buffer;

                    return (
                      <div
                        key={product.id}
                        className="flex items-center justify-between p-3 rounded-xl border-b border-gray-50 last:border-0 hover:bg-green-50/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-800">{product.name}</h3>
                            {isLowStock && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border" style={{ backgroundColor: '#fef9c3', color: '#a16207', borderColor: '#fde047' }}>
                                Only {product.inventory}!
                              </span>
                            )}
                          </div>
                          <p className="font-bold mt-1 text-sm" style={{ color: '#D42426' }}>₹{product.price}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(product.id, -1)}
                            disabled={qty === 0}
                            className="w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-400 flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          
                          <span className={`w-6 text-center font-bold ${qty > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                            {qty}
                          </span>

                          <button
                            onClick={() => updateQuantity(product.id, 1)}
                            disabled={!queueOpen || qty >= product.inventory}
                            className="group w-8 h-8 rounded-full text-white flex items-center justify-center shadow-md active:scale-90 transition-transform relative overflow-hidden disabled:opacity-50"
                            style={{ backgroundColor: '#14452F' }}
                          >
                            <div className="absolute inset-0 bg-candy-cane opacity-0 group-hover:opacity-20 transition-opacity"></div>
                            <Plus className="w-3 h-3 relative z-10" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Order Summary */}
              {orderItems.length > 0 && (
                <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: '#f9fafb' }}>
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                    <span>Summary</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: '#e5e7eb' }}>{totalCount} items</span>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {orderItems.map((item) => (
                      <li key={item.id} className="flex items-center justify-between text-gray-500">
                        <span>{item.name} × {item.qty}</span>
                        <span>₹{(item.price || 0) * item.qty}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between font-bold">
                    <span>Total</span>
                    <span>₹{total}</span>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mt-4 p-3 rounded-xl text-sm font-medium" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <div className="mt-6 pt-4 border-t border-dashed border-gray-200">
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="w-full py-4 rounded-xl font-bold text-lg shadow-xl relative overflow-hidden group transition-all duration-300 transform disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-200 text-white"
                  style={{ backgroundColor: canSubmit ? '#D42426' : '#e5e7eb' }}
                >
                  <div className="absolute inset-0 bg-candy-cane opacity-10 group-hover:opacity-20 transition-opacity"></div>
                  
                  <div className="relative flex items-center justify-center gap-2">
                    <Gift className="w-5 h-5" />
                    <span>{submitting ? "Adding to Queue..." : totalCount > 0 ? `Join Queue` : "Join Queue"}</span>
                  </div>
                </button>
                
                <div className="text-center mt-3">
                  <p className="text-[10px] text-gray-400 font-medium">✨ Wishing you a Merry Christmas ✨</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-center mt-4">
            <p className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Powered by{" "}
              <a href="https://devou.in" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Devou
              </a>
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
    for (let i = 0; i < 40; i++) {
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
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          {flake.text}
        </div>
      ))}
    </div>
  );
}
