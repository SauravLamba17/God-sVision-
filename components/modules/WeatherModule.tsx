'use client';
import { useState, useEffect } from 'react';

interface Props { compact?: boolean; }

const CITIES = ['New York', 'London', 'Tokyo', 'Dubai', 'Mumbai', 'Singapore'];

export default function WeatherModule({ compact }: Props) {
  const [weather, setWeather] = useState<any[]>([]);
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('gv_temp_unit') as 'C' | 'F' | null;
    if (saved === 'C' || saved === 'F') setTempUnit(saved);
  }, []);

  useEffect(() => {
    const cities = CITIES.slice(0, compact ? 4 : 6);
    Promise.all(
      cities.map(c => fetch(`/api/weather?city=${encodeURIComponent(c)}`).then(r => r.json()).catch(() => null))
    ).then(results => { setWeather(results.filter(Boolean)); setLoading(false); });
  }, [compact]);

  const toC = (f: number) => Math.round((f - 32) * 5 / 9);
  const display = (fVal: number) => tempUnit === 'C' ? `${toC(fVal)}°C` : `${Math.round(fVal)}°F`;

  const fs = compact ? '10px' : '11px';

  return (
    <div style={{ height: '100%', background: 'var(--bg-panel)', color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono, monospace', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: compact ? '3px 8px' : '5px 10px', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-header)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--text-accent)', fontSize: 9, fontWeight: 700, letterSpacing: '1px' }}>WEATHER</span>
        <div style={{ display: 'flex', gap: 2 }}>
          {(['C', 'F'] as const).map(u => (
            <button key={u} onClick={() => { setTempUnit(u); localStorage.setItem('gv_temp_unit', u); }}
              style={{ background: tempUnit === u ? 'var(--text-accent)' : 'transparent', color: tempUnit === u ? '#000' : 'var(--text-muted)', border: '1px solid var(--border-dim)', borderRadius: 2, padding: '1px 5px', fontSize: 8, cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700 }}>
              °{u}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 8, color: 'var(--text-muted)', fontSize: fs }}>Loading…</div>
        ) : weather.map((w: any, i: number) => {
          const tempF = w.temperature ?? w.temp ?? w.current?.temperature_2m ?? 68;
          return (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: compact ? '4px 6px' : '6px 8px', borderBottom: '1px solid var(--border-dim)', fontSize: fs }}>
              <span style={{ color: 'var(--text-muted)', flex: 1 }}>{w.city ?? w.name ?? CITIES[i]}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700, minWidth: 60, textAlign: 'right' }}>{display(tempF)}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 9, marginLeft: 8, minWidth: 60, textAlign: 'right' }}>{w.description ?? w.condition ?? ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
