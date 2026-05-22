import { useState, useEffect, useRef } from 'react';

interface PiPriceData {
  price: number | null;
  change24h: number | null;
  loading: boolean;
  error: boolean;
}

const COINGECKO_DIRECT =
  'https://api.coingecko.com/api/v3/simple/price?ids=pi-network&vs_currencies=usd&include_24hr_change=true';
const COINGECKO_PROXY =
  '/proxy/coingecko/simple/price?ids=pi-network&vs_currencies=usd&include_24hr_change=true';

const CACHE_KEY = 'marketpiepie_pi_price_cache';
const CACHE_TTL = 60_000; // 1 min
const POLL_INTERVAL = 60_000; // 60 s

interface CachedPrice {
  price: number;
  change24h: number;
  ts: number;
}

function readCache(): CachedPrice | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as CachedPrice;
    if (Date.now() - c.ts > CACHE_TTL) return null;
    return c;
  } catch {
    return null;
  }
}

function writeCache(price: number, change24h: number) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ price, change24h, ts: Date.now() }));
  } catch {}
}

async function tryFetch(url: string): Promise<{ price: number; change24h: number }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const pi = data['pi-network'];
  if (!pi) throw new Error('pi-network key missing');
  return { price: pi.usd, change24h: pi.usd_24h_change ?? 0 };
}

async function fetchPiPrice(): Promise<{ price: number; change24h: number }> {
  try {
    return await tryFetch(COINGECKO_DIRECT);
  } catch (e) {
    return await tryFetch(COINGECKO_PROXY);
  }
}

/**
 * React hook – polls CoinGecko every 60 s for the latest PI/USD price.
 * Returns { price, change24h (%), loading, error }.
 */
export function usePiPrice(): PiPriceData {
  const cached = readCache();
  const [data, setData] = useState<PiPriceData>({
    price: cached?.price ?? null,
    change24h: cached?.change24h ?? null,
    loading: !cached,
    error: false,
  });
  const timer = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { price, change24h } = await fetchPiPrice();
        writeCache(price, change24h);
        if (!cancelled) setData({ price, change24h, loading: false, error: false });
      } catch (err) {
        if (!cancelled) setData((p) => ({ ...p, loading: false, error: true }));
      }
    };

    const c = readCache();
    if (!c) load();
    else if (!cancelled) setData({ price: c.price, change24h: c.change24h, loading: false, error: false });

    timer.current = setInterval(load, POLL_INTERVAL);
    return () => { cancelled = true; clearInterval(timer.current); };
  }, []);

  return data;
}
