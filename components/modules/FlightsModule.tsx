'use client';
import { useState, useEffect } from 'react';

interface Props { compact?: boolean; }

export default function FlightsModule({ compact }: Props) {
  const [flights, setFlights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const limit = compact ? 8 : 15;
    const load = () =>
      fetch('/api/flights')
        .then(r => r.json())
        .then(d => { setFlights(Array.isArray(d.states) ? d.states.slice(0, limit) : []); setLoading(false); })
        .catch(() => setLoading(false));
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [compact]);

  const fs = compact ? '10px' : '11px';

  return (
    <div style={{ height: '100%', background: 'var(--bg-panel)', color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono, monospace', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: compact ? '3px 8px' : '5px 10px', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-header)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-accent)', fontSize: 9, fontWeight: 700, letterSpacing: '1px' }}>FLIGHTS</span>
        <span style={{ fontSize: 8, color: 'var(--text-positive)' }}>● LIVE</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 8, color: 'var(--text-muted)', fontSize: fs }}>Loading…</div>
        ) : flights.length === 0 ? (
          <div style={{ padding: 8, color: 'var(--text-muted)', fontSize: fs }}>No flight data</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fs }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-dim)' }}>
                <th style={{ padding: compact ? '3px 5px' : '4px 7px', color: 'var(--text-muted)', textAlign: 'left', fontWeight: 600, fontSize: 9 }}>CALLSIGN</th>
                {!compact && <th style={{ padding: '4px 7px', color: 'var(--text-muted)', textAlign: 'left', fontWeight: 600, fontSize: 9 }}>ORIGIN</th>}
                <th style={{ padding: compact ? '3px 5px' : '4px 7px', color: 'var(--text-muted)', textAlign: 'right', fontWeight: 600, fontSize: 9 }}>ALT (ft)</th>
                <th style={{ padding: compact ? '3px 5px' : '4px 7px', color: 'var(--text-muted)', textAlign: 'right', fontWeight: 600, fontSize: 9 }}>SPD</th>
              </tr>
            </thead>
            <tbody>
              {flights.map((f: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-dim)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                  <td style={{ padding: compact ? '3px 5px' : '4px 7px', color: 'var(--text-accent)', fontWeight: 700 }}>{f[1]?.trim() || 'N/A'}</td>
                  {!compact && <td style={{ padding: '4px 7px', color: 'var(--text-muted)', fontSize: 9 }}>{f[2] || '—'}</td>}
                  <td style={{ padding: compact ? '3px 5px' : '4px 7px', textAlign: 'right', color: 'var(--text-primary)' }}>
                    {f[7] ? Math.round(f[7] * 3.281).toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: compact ? '3px 5px' : '4px 7px', textAlign: 'right', color: 'var(--text-info)' }}>
                    {f[9] ? `${Math.round(f[9] * 1.944)}kt` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
