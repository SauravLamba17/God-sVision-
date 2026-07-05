'use client';
import { useState, useEffect, useCallback } from 'react';

interface Props { compact?: boolean; }

export default function MarketsModule({ compact }: Props) {
  const [ticker, setTicker] = useState('SPY');
  const [input, setInput] = useState('SPY');
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchQuote = useCallback((sym: string) => {
    setLoading(true);
    fetch(`/api/stocks?tickers=${sym}`)
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d.data) ? d.data : [];
        setQuote(arr[0] ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchQuote(ticker); }, [ticker]);

  const fs = compact ? '10px' : '12px';
  const fsLg = compact ? '18px' : '24px';
  const chg = quote?.regularMarketChangePercent ?? 0;
  const positive = chg >= 0;

  return (
    <div style={{ height: '100%', background: 'var(--bg-panel)', color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono, monospace', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: compact ? '3px 8px' : '5px 10px', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-header)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--text-accent)', fontSize: 9, fontWeight: 700, letterSpacing: '1px' }}>MARKETS</span>
        <form onSubmit={e => { e.preventDefault(); setTicker(input.toUpperCase()); }} style={{ display: 'flex', gap: 4 }}>
          <input value={input} onChange={e => setInput(e.target.value.toUpperCase())}
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-dim)', color: 'var(--text-primary)', padding: '1px 5px', fontSize: 9, fontFamily: 'IBM Plex Mono, monospace', width: 70, borderRadius: 2, outline: 'none' }}
            placeholder="TICKER" />
          <button type="submit" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-dim)', color: 'var(--text-accent)', padding: '1px 6px', fontSize: 8, fontFamily: 'IBM Plex Mono, monospace', cursor: 'pointer', borderRadius: 2 }}>GO</button>
        </form>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: compact ? '6px 8px' : '10px 12px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: fs }}>Loading {ticker}…</div>
        ) : quote ? (
          <>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{quote.shortName ?? ticker}</div>
            <div style={{ fontSize: fsLg, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono, monospace' }}>
              ${(quote.regularMarketPrice ?? 0).toFixed(2)}
            </div>
            <div style={{ fontSize: fs, color: positive ? 'var(--text-positive)' : 'var(--text-negative)', marginTop: 3, fontWeight: 700 }}>
              {positive ? '▲' : '▼'} {Math.abs(chg).toFixed(2)}%
            </div>
            {!compact && (
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                {[
                  ['Volume', (quote.regularMarketVolume ?? 0).toLocaleString()],
                  ['52W High', `$${(quote.fiftyTwoWeekHigh ?? 0).toFixed(2)}`],
                  ['52W Low',  `$${(quote.fiftyTwoWeekLow  ?? 0).toFixed(2)}`],
                  ['P/E',      quote.trailingPE?.toFixed(1) ?? '—'],
                  ['Mkt Cap',  quote.marketCap ? `$${(quote.marketCap / 1e9).toFixed(1)}B` : '—'],
                  ['Div Yield',quote.dividendYield ? `${(quote.dividendYield * 100).toFixed(2)}%` : '—'],
                ].map(([label, value]) => (
                  <div key={label} style={{ fontSize: 10 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 9 }}>{label}</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{value}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: fs }}>No data for {ticker}</div>
        )}
      </div>
    </div>
  );
}
