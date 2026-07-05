'use client';
import { useState, useEffect } from 'react';

interface Props { compact?: boolean; }

const TICKERS = 'SPY,QQQ,BTC-USD,GLD,DX-Y.NYB,^VIX';

export default function DashboardModule({ compact }: Props) {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () =>
      fetch(`/api/stocks?tickers=${TICKERS}`)
        .then(r => r.json())
        .then(d => { setQuotes(Array.isArray(d.data) ? d.data : []); setLoading(false); })
        .catch(() => setLoading(false));
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  const fs = compact ? '10px' : '11px';
  const items = quotes.slice(0, compact ? 4 : 6);

  return (
    <div style={{ height: '100%', background: 'var(--bg-panel)', color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono, monospace', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: compact ? '3px 8px' : '5px 10px', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-header)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-accent)', fontSize: 9, fontWeight: 700, letterSpacing: '1px' }}>DASHBOARD</span>
        <span style={{ fontSize: 8, color: 'var(--text-positive)' }}>● LIVE</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: compact ? '4px' : '6px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: fs }}>Loading…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {items.map((q: any, i: number) => {
              const chg = q.regularMarketChangePercent ?? 0;
              const positive = chg >= 0;
              return (
                <div key={i} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-dim)',
                  borderRadius: 2, padding: compact ? '5px 6px' : '7px 8px',
                }}>
                  <div style={{ fontSize: 8, color: 'var(--text-muted)', marginBottom: 2 }}>{q.symbol}</div>
                  <div style={{ fontSize: compact ? 13 : 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                    ${(q.regularMarketPrice ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: fs, color: positive ? 'var(--text-positive)' : 'var(--text-negative)', marginTop: 2, fontWeight: 700 }}>
                    {positive ? '▲' : '▼'} {Math.abs(chg).toFixed(2)}%
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
