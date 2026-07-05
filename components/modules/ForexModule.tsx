'use client';
import { useState, useEffect } from 'react';

interface Props { compact?: boolean; }

export default function ForexModule({ compact }: Props) {
  const [pairs, setPairs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () =>
      fetch('/api/forex?type=rates')
        .then(r => r.json())
        .then(d => {
          const arr = Array.isArray(d.data) ? d.data : [];
          setPairs(arr.slice(0, compact ? 8 : 16));
          setLoading(false);
        })
        .catch(() => setLoading(false));
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, [compact]);

  const fs = compact ? '10px' : '11px';

  return (
    <div style={{ height: '100%', background: 'var(--bg-panel)', color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono, monospace', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: compact ? '3px 8px' : '5px 10px', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-header)', flexShrink: 0 }}>
        <span style={{ color: 'var(--text-accent)', fontSize: 9, fontWeight: 700, letterSpacing: '1px' }}>FOREX</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 8, color: 'var(--text-muted)', fontSize: fs }}>Loading…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fs }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-dim)' }}>
                <th style={{ padding: compact ? '3px 6px' : '4px 8px', color: 'var(--text-muted)', textAlign: 'left', fontWeight: 600, fontSize: 9 }}>PAIR</th>
                <th style={{ padding: compact ? '3px 6px' : '4px 8px', color: 'var(--text-muted)', textAlign: 'right', fontWeight: 600, fontSize: 9 }}>RATE</th>
                <th style={{ padding: compact ? '3px 6px' : '4px 8px', color: 'var(--text-muted)', textAlign: 'right', fontWeight: 600, fontSize: 9 }}>CHG%</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((p: any, i: number) => {
                const chg = p.regularMarketChangePercent ?? p.changePct ?? 0;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-dim)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                    <td style={{ padding: compact ? '3px 6px' : '4px 8px', color: 'var(--text-accent)', fontWeight: 700 }}>{p.symbol ?? p.pair ?? '—'}</td>
                    <td style={{ padding: compact ? '3px 6px' : '4px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>
                      {(p.regularMarketPrice ?? p.rate ?? 0).toFixed(4)}
                    </td>
                    <td style={{ padding: compact ? '3px 6px' : '4px 8px', textAlign: 'right', color: chg >= 0 ? 'var(--text-positive)' : 'var(--text-negative)', fontWeight: 700 }}>
                      {chg >= 0 ? '+' : ''}{Number(chg).toFixed(3)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
