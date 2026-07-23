'use client';
import { useEffect, useState } from 'react';

// Polls /api/sparkline for a symbol's recent price series. Used by callers
// that don't already have price history on hand (e.g. dashboard hero cards).
export function useSparklineData(symbol: string) {
  const [data, setData] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/sparkline?symbol=${encodeURIComponent(symbol)}`);
        const json = await res.json();
        if (!mounted) return;
        setData(Array.isArray(json.prices) && json.prices.length >= 2 ? json.prices : null);
      } catch {
        if (mounted) setData(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [symbol]);

  return { data, loading };
}
