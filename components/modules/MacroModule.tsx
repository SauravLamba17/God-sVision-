'use client';
import { useState, useEffect } from 'react';

interface Props { compact?: boolean; }

export default function MacroModule({ compact }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/macro')
      .then(r => r.json())
      .then(d => { setData(d.data ?? d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const fs = compact ? '10px' : '11px';

  const indicators = data ? [
    { label: 'GDP Growth',    value: data.gdpGrowth ?? data.GDP ?? '—',            unit: '%' },
    { label: 'CPI Inflation', value: data.cpi ?? data.CPI ?? '—',                  unit: '%' },
    { label: 'Unemployment',  value: data.unemployment ?? data.UNRATE ?? '—',      unit: '%' },
    { label: 'Fed Rate',      value: data.fedRate ?? data.FEDFUNDS ?? '—',         unit: '%' },
    { label: '10Y Yield',     value: data.yield10y ?? data.DGS10 ?? '—',           unit: '%' },
    { label: '2Y Yield',      value: data.yield2y ?? data.DGS2 ?? '—',            unit: '%' },
    { label: 'Core PCE',      value: data.corePce ?? data.PCEPILFE ?? '—',        unit: '%' },
    { label: 'ISM Mfg',       value: data.ismManufacturing ?? data.ISM ?? '—',    unit: ''  },
  ] : [];

  return (
    <div style={{ height: '100%', background: 'var(--bg-panel)', color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono, monospace', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: compact ? '3px 8px' : '5px 10px', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-header)', flexShrink: 0 }}>
        <span style={{ color: 'var(--text-accent)', fontSize: 9, fontWeight: 700, letterSpacing: '1px' }}>MACRO</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: compact ? '4px 6px' : '6px 10px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: fs }}>Loading…</div>
        ) : indicators.map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: compact ? '3px 0' : '5px 0', borderBottom: '1px solid var(--border-dim)', fontSize: fs }}>
            <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
            <span style={{ color: 'var(--text-accent)', fontWeight: 700 }}>
              {item.value}{item.unit && item.value !== '—' ? item.unit : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
