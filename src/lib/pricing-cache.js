const CACHE_KEY = "pricingCache";
const TTL = 5 * 60 * 1000; // 5 minutes

export function getCachedPricing() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.value) return null;
    const fresh = Date.now() - Number(parsed.ts) < TTL;
    return { data: parsed.value, fresh };
  } catch {
    return null;
  }
}

export function setCachedPricing(value) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ value, ts: Date.now() })
    );
  } catch {
    // ignore write errors
  }
}


