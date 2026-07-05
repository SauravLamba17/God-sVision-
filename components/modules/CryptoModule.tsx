'use client';
import { useState, useEffect } from 'react';

interface Props { compact?: boolean; }

export default function CryptoModule({ compact }: Props) {
  const [coins, setCoins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const limit = compact ? 8 : 15;
    const load = () =>
      fetch('/api/crypto?type=top100')
        .then(r => r.json())
        .then(d => { setCoins(Array.isArray(d.data) ? d.data.slice(0, limit) : []); setLoading(false); })
        .catch(() => setLoading(false));
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, [compact]);

  const fs = compact ? '10px' : '11px';

  return (
    <div style={{ height: '100%', background: 'var(--bg-panel)', color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono, monospace', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: compact ? '3px 8px' : '5px 10px', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-header)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-accent)', fontSize: 9, fontWeight: 700, letterSpacing: '1px' }}>CRYPTO</span>
        <span style={{ fontSize: 8, color: 'var(--text-positive)' }}>● LIVE</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 8, color: 'var(--text-muted)', fontSize: fs }}>Loading…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fs }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-dim)' }}>
                <th style={{ padding: compact ? '3px 6px' : '4px 8px', color: 'var(--text-muted)', textAlign: 'left', fontWeight: 600, fontSize: 9 }}>COIN</th>
                <th style={{ padding: compact ? '3px 6px' : '4px 8px', color: 'var(--text-muted)', textAlign: 'right', fontWeight: 600, fontSize: 9 }}>PRICE</th>
                <th style={{ padding: compact ? '3px 6px' : '4px 8px', color: 'var(--text-muted)', textAlign: 'right', fontWeight: 600, fontSize: 9 }}>24H%</th>
              </tr>
            </thead>
            <tbody>
              {coins.map((coin: any, i: number) => {
                const chg = coin.price_change_percentage_24h ?? coin.usd_24h_change ?? 0;
                const price = coin.current_price ?? coin.usd ?? 0;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-dim)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                    <td style={{ padding: compact ? '3px 6px' : '4px 8px', color: 'var(--text-accent)', fontWeight: 700 }}>
                      {(coin.symbol ?? coin.id ?? '').toUpperCase()}
                    </td>
                    <td style={{ padding: compact ? '3px 6px' : '4px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>
                      ${price >= 1000 ? price.toLocaleString(undefined, { maximumFractionDigits: 0 }) : price.toFixed(price < 1 ? 4 : 2)}
                    </td>
                    <td style={{ padding: compact ? '3px 6px' : '4px 8px', textAlign: 'right', color: chg >= 0 ? 'var(--text-positive)' : 'var(--text-negative)', fontWeight: 700 }}>
                      {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
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
