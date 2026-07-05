'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

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

export function useAlpacaStream(symbols: string[] = DEFAULT_SYMBOLS) {
  const [tickers, setTickers] = useState<AlpacaMap>(new Map());
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const prevCloseRef = useRef<Map<string, number>>(new Map());
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    const apiKey = process.env.NEXT_PUBLIC_ALPACA_API_KEY;
    const secretKey = process.env.NEXT_PUBLIC_ALPACA_SECRET_KEY;
    if (!apiKey || !secretKey) {
      setError('ALPACA keys missing in .env.local');
      return;
    }
    try {
      const ws = new WebSocket('wss://stream.data.alpaca.markets/v2/iex');
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ action: 'auth', key: apiKey, secret: secretKey }));
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const messages = JSON.parse(event.data);
          if (!Array.isArray(messages)) return;
          messages.forEach((msg: any) => {
            if (msg.T === 'success' && msg.msg === 'authenticated') {
              setConnected(true);
              setError(null);
              ws.send(JSON.stringify({ action: 'subscribe', quotes: symbols, trades: symbols }));
            }
            if (msg.T === 'q') {
              setTickers(prev => {
                const next = new Map(prev);
                const existing = next.get(msg.S) ?? {
                  symbol: msg.S, price: 0, bidPrice: 0, askPrice: 0,
                  volume: 0, timestamp: '', change: 0, changePct: 0, prevClose: 0,
                };
                const midPrice = ((msg.bp ?? 0) + (msg.ap ?? 0)) / 2;
                const prevClose = prevCloseRef.current.get(msg.S) ?? existing.prevClose;
                const change = prevClose > 0 ? midPrice - prevClose : existing.change;
                const changePct = prevClose > 0 ? ((midPrice - prevClose) / prevClose) * 100 : existing.changePct;
                next.set(msg.S, {
                  ...existing,
                  bidPrice: msg.bp ?? existing.bidPrice,
                  askPrice: msg.ap ?? existing.askPrice,
                  price: midPrice > 0 ? midPrice : existing.price,
                  timestamp: msg.t ?? existing.timestamp,
                  change, changePct,
                });
                return next;
              });
            }
            if (msg.T === 't') {
              setTickers(prev => {
                const next = new Map(prev);
                const existing = next.get(msg.S) ?? {
                  symbol: msg.S, price: 0, bidPrice: 0, askPrice: 0,
                  volume: 0, timestamp: '', change: 0, changePct: 0, prevClose: 0,
                };
                const prevClose = prevCloseRef.current.get(msg.S) ?? existing.prevClose;
                const change = prevClose > 0 ? msg.p - prevClose : existing.change;
                const changePct = prevClose > 0 ? ((msg.p - prevClose) / prevClose) * 100 : existing.changePct;
                next.set(msg.S, {
                  ...existing,
                  price: msg.p,
                  volume: (existing.volume ?? 0) + (msg.s ?? 0),
                  timestamp: msg.t,
                  change, changePct,
                });
                return next;
              });
            }
          });
        } catch (e) {
          console.error('[Alpaca] Parse error:', e);
        }
      };

      ws.onerror = () => {
        setConnected(false);
        setError('Alpaca WebSocket error');
      };

      ws.onclose = () => {
        setConnected(false);
        if (mountedRef.current) reconnectRef.current = setTimeout(connect, 5000);
      };
    } catch {
      setError('Failed to connect to Alpaca');
      reconnectRef.current = setTimeout(connect, 5000);
    }
  }, [symbols.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch(`/api/stocks/prevclose?symbols=${symbols.join(',')}`)
      .then(r => r.json())
      .then((data: Record<string, number>) => {
        Object.entries(data).forEach(([sym, close]) => prevCloseRef.current.set(sym, close));
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { tickers, connected, error };
}
