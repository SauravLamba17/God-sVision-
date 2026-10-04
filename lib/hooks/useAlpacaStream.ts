'use client';
import { useEffect, useState } from 'react';

export interface AlpacaTicker {
  symbol: string;
  price: number;
  bidPrice: number;
  askPrice: number;
  volume: number;
  timestamp: string;
  change: number;
  changePct: number;
  prevClose: number;
}

export type AlpacaMap = Map<string, AlpacaTicker>;

const DEFAULT_SYMBOLS = [
  'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','JPM',
  'V','JNJ','WMT','PG','MA','UNH','HD','CVX','MRK','ABBV',
  'SPY','QQQ','DIA','IWM','GLD','SLV','USO','TLT',
  'AMD','INTC','PYPL','ADBE','CRM','NFLX','ORCL','QCOM',
  'BAC','WFC','GS','MS','C','BLK','AXP','USB',
];

const POLL_MS = 10_000; // matches /api/stocks/live's 10s upstream cache

/**
 * Live US quotes (Alpaca IEX) polled from /api/stocks/live every 10s.
 * This used to be a browser WebSocket, which needed the Alpaca secret in
 * NEXT_PUBLIC_* — i.e. shipped to every visitor. The keys now stay server-side.
 * `connected` (→ LIVE badge) means the last poll returned live data.
 */
export function useAlpacaStream(symbols: string[] = DEFAULT_SYMBOLS) {
  const [tickers, setTickers] = useState<AlpacaMap>(new Map());
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = symbols.join(',');

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/stocks/live?symbols=${encodeURIComponent(key)}`);
        const j = await res.json();
        if (cancelled) return;
        const entries = Object.entries((j.data ?? {}) as Record<string, AlpacaTicker>);
        if (!res.ok || entries.length === 0) {
          setConnected(false);
          setError(j.error ?? 'No live quotes');
          return;
        }
        setTickers(prev => {
          const next = new Map(prev);
          for (const [sym, t] of entries) next.set(sym, t);
          return next;
        });
        setConnected(true);
        setError(null);
      } catch {
        if (!cancelled) { setConnected(false); setError('Live quotes unreachable'); }
      }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [key]);

  return { tickers, connected, error };
}
