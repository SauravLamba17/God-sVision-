'use client';
import { useState } from 'react';

const STRATEGIES = [
  { id: 'sma_crossover', label: 'SMA Crossover', desc: 'Buy when short MA crosses above long MA, sell when crosses below' },
  { id: 'rsi', label: 'RSI Overbought/Oversold', desc: 'Buy when RSI < 30 (oversold), sell when RSI > 70 (overbought)' },
  { id: 'buy_hold', label: 'Buy & Hold', desc: 'Buy on day 1, hold until end date (benchmark comparison)' },
];

export default function BacktestPage() {
  const [ticker, setTicker] = useState('SPY');
  const [strategy, setStrategy] = useState('sma_crossover');
  const [startDate, setStartDate] = useState('2020-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [capital, setCapital] = useState(10000);
  const [shortPeriod, setShortPeriod] = useState(20);
  const [longPeriod, setLongPeriod] = useState(50);
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [oversold, setOversold] = useState(30);
  const [overbought, setOverbought] = useState(70);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runBacktest = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const params = strategy === 'sma_crossover'
        ? { shortPeriod, longPeriod }
        : strategy === 'rsi'
        ? { period: rsiPeriod, oversold, overbought }
        : {};

      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, strategy, startDate, endDate, initialCapital: capital, params }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); } else { setResult(data); }
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const panel: React.CSSProperties = {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    overflow: 'hidden',
  };
  const header: React.CSSProperties = {
    background: 'var(--bg-header)',
    borderBottom: '1px solid var(--border-color)',
    padding: '8px 12px',
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--text-accent)',
    letterSpacing: '0.5px',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    padding: '7px 10px',
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: '12px',
    borderRadius: '3px',
    outline: 'none',
    marginTop: '4px',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '10px',
    color: 'var(--text-muted)',
    fontFamily: 'IBM Plex Mono, monospace',
    letterSpacing: '0.5px',
    display: 'block',
    marginTop: '10px',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-terminal)', padding: '8px', color: 'var(--text-primary)' }}>
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', fontWeight: 700, color: 'var(--text-accent)', letterSpacing: '1px', marginBottom: '10px' }}>
        BACKTESTING ENGINE
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,280px) minmax(0,1fr)', gap: '8px' }}>
        {/* Settings panel */}
        <div style={panel}>
          <div style={header}>STRATEGY SETTINGS</div>
          <div style={{ padding: '12px' }}>
            <label style={labelStyle}>TICKER</label>
            <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
              placeholder="AAPL, SPY, NVDA..." style={inputStyle} />

            <label style={labelStyle}>STRATEGY</label>
            <select value={strategy} onChange={e => setStrategy(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              {STRATEGIES.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>

            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
              {STRATEGIES.find(s => s.id === strategy)?.desc}
            </div>

            {strategy === 'sma_crossover' && (
              <>
                <label style={labelStyle}>SHORT PERIOD (days)</label>
                <input type="number" value={shortPeriod} onChange={e => setShortPeriod(parseInt(e.target.value))} style={inputStyle} />
                <label style={labelStyle}>LONG PERIOD (days)</label>
                <input type="number" value={longPeriod} onChange={e => setLongPeriod(parseInt(e.target.value))} style={inputStyle} />
              </>
            )}

            {strategy === 'rsi' && (
              <>
                <label style={labelStyle}>RSI PERIOD</label>
                <input type="number" value={rsiPeriod} onChange={e => setRsiPeriod(parseInt(e.target.value))} style={inputStyle} />
                <label style={labelStyle}>OVERSOLD THRESHOLD</label>
                <input type="number" value={oversold} onChange={e => setOversold(parseInt(e.target.value))} style={inputStyle} />
                <label style={labelStyle}>OVERBOUGHT THRESHOLD</label>
                <input type="number" value={overbought} onChange={e => setOverbought(parseInt(e.target.value))} style={inputStyle} />
              </>
            )}

            <label style={labelStyle}>START DATE</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />

            <label style={labelStyle}>END DATE</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />

            <label style={labelStyle}>INITIAL CAPITAL ($)</label>
            <input type="number" value={capital} onChange={e => setCapital(parseInt(e.target.value))} style={inputStyle} />

            <button onClick={runBacktest} disabled={loading} style={{
              width: '100%',
              marginTop: '16px',
              padding: '10px',
              background: loading ? 'var(--bg-hover)' : 'var(--text-accent)',
              border: 'none',
              color: loading ? 'var(--text-muted)' : '#000',
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '1px',
              cursor: loading ? 'not-allowed' : 'pointer',
              borderRadius: '3px',
            }}>
              {loading ? 'RUNNING...' : 'RUN BACKTEST'}
            </button>

            {error && (
              <div style={{ marginTop: '8px', color: 'var(--text-negative)', fontSize: '11px', fontFamily: 'IBM Plex Mono, monospace' }}>
                Error: {error}
              </div>
            )}
          </div>
        </div>

        {/* Results panel */}
        <div>
          {!result && !loading && (
            <div style={{ ...panel, padding: '40px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: 'var(--text-muted)' }}>
                Configure a strategy and click RUN BACKTEST
              </div>
            </div>
          )}

          {loading && (
            <div style={{ ...panel, padding: '40px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: 'var(--text-accent)' }}>
                Running backtest...
              </div>
            </div>
          )}

          {result && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '8px' }}>
              {/* Key metrics */}
              <div style={panel}>
                <div style={header}>{result.ticker} · {STRATEGIES.find(s => s.id === result.strategy)?.label}</div>
                <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { label: 'TOTAL RETURN', value: `${result.totalReturnPct > 0 ? '+' : ''}${result.totalReturnPct}%`, pos: result.totalReturnPct > 0 },
                    { label: 'FINAL CAPITAL', value: `$${result.finalCapital.toLocaleString()}`, pos: result.finalCapital > result.initialCapital },
                    { label: 'vs BUY & HOLD', value: `${result.buyHoldReturn > 0 ? '+' : ''}${result.buyHoldReturn}%`, pos: result.totalReturnPct > result.buyHoldReturn },
                    { label: 'SHARPE RATIO', value: result.sharpeRatio.toFixed(2), pos: result.sharpeRatio > 1 },
                    { label: 'MAX DRAWDOWN', value: `${result.maxDrawdown}%`, pos: false },
                    { label: 'WIN RATE', value: `${result.winRate}%`, pos: result.winRate > 50 },
                    { label: 'TOTAL TRADES', value: result.totalTrades, pos: true },
                    { label: 'WIN/LOSS', value: `${result.winningTrades}W / ${result.losingTrades}L`, pos: result.winningTrades > result.losingTrades },
                  ].map(m => (
                    <div key={m.label} style={{
                      background: 'var(--bg-header)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '3px',
                      padding: '8px 10px',
                    }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.5px', marginBottom: '3px' }}>
                        {m.label}
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: m.pos ? 'var(--text-positive)' : m.label === 'MAX DRAWDOWN' ? 'var(--text-negative)' : 'var(--text-primary)' }}>
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Strategy vs buy-hold comparison */}
                <div style={{ padding: '0 12px 12px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono, monospace', marginBottom: '6px' }}>
                    STRATEGY vs BUY & HOLD
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '2px', fontFamily: 'IBM Plex Mono, monospace' }}>Strategy</div>
                      <div style={{ height: '8px', background: 'var(--bg-hover)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(Math.abs(result.totalReturnPct), 100)}%`, background: result.totalReturnPct >= 0 ? 'var(--text-positive)' : 'var(--text-negative)', borderRadius: '2px' }} />
                      </div>
                      <div style={{ fontSize: '10px', color: result.totalReturnPct >= 0 ? 'var(--text-positive)' : 'var(--text-negative)', fontFamily: 'IBM Plex Mono, monospace', marginTop: '2px' }}>
                        {result.totalReturnPct > 0 ? '+' : ''}{result.totalReturnPct}%
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '2px', fontFamily: 'IBM Plex Mono, monospace' }}>Buy & Hold</div>
                      <div style={{ height: '8px', background: 'var(--bg-hover)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(Math.abs(result.buyHoldReturn), 100)}%`, background: result.buyHoldReturn >= 0 ? 'var(--text-info)' : 'var(--text-negative)', borderRadius: '2px' }} />
                      </div>
                      <div style={{ fontSize: '10px', color: result.buyHoldReturn >= 0 ? 'var(--text-info)' : 'var(--text-negative)', fontFamily: 'IBM Plex Mono, monospace', marginTop: '2px' }}>
                        {result.buyHoldReturn > 0 ? '+' : ''}{result.buyHoldReturn}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Equity curve chart */}
              <div style={panel}>
                <div style={header}>EQUITY CURVE · ${result.initialCapital.toLocaleString()} initial capital</div>
                <div style={{ padding: '8px' }}>
                  {result.equityCurve.length > 0 && (() => {
                    const vals = result.equityCurve.map((p: any) => p.value);
                    const max = Math.max(...vals);
                    const min = Math.min(...vals);
                    const range = max - min || 1;
                    const w = 340;
                    const h = 160;
                    const pts = vals.map((v: number, i: number) => {
                      const x = (i / (vals.length - 1)) * w;
                      const y = h - ((v - min) / range) * (h - 20) - 10;
                      return `${x},${y}`;
                    });
                    const isPositive = vals[vals.length - 1] >= result.initialCapital;
                    return (
                      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%' }}>
                        <defs>
                          <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={isPositive ? '#00e676' : '#ff1744'} stopOpacity="0.3" />
                            <stop offset="100%" stopColor={isPositive ? '#00e676' : '#ff1744'} stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        {[0, 0.25, 0.5, 0.75, 1].map(t => (
                          <line key={t} x1="0" y1={h - t * (h - 20) - 10} x2={w} y2={h - t * (h - 20) - 10}
                            stroke="var(--border-color)" strokeWidth="0.5" />
                        ))}
                        <polyline points={pts.join(' ')}
                          fill="none"
                          stroke={isPositive ? '#00e676' : '#ff1744'}
                          strokeWidth="1.5" />
                        <text x="2" y="12" fontSize="8" fill="var(--text-muted)" fontFamily="IBM Plex Mono">
                          ${max.toLocaleString()}
                        </text>
                        <text x="2" y={h - 2} fontSize="8" fill="var(--text-muted)" fontFamily="IBM Plex Mono">
                          ${min.toLocaleString()}
                        </text>
                        <text x={w - 50} y={h - 2} fontSize="8" fill="var(--text-muted)" fontFamily="IBM Plex Mono">
                          {result.endDate.slice(0, 7)}
                        </text>
                      </svg>
                    );
                  })()}
                </div>
              </div>

              {/* Trade log */}
              <div style={{ ...panel, gridColumn: '1 / -1' }}>
                <div style={header}>TRADE LOG ({result.trades.length} trades)</div>
                <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, background: 'var(--bg-header)' }}>
                        {['TYPE', 'DATE', 'PRICE', 'SHARES', 'VALUE'].map(h => (
                          <th key={h} style={{ padding: '5px 10px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '9px', textAlign: h === 'TYPE' || h === 'DATE' ? 'left' : 'right', letterSpacing: '0.5px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.map((t: any, i: number) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}
                          onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-hover)'}
                          onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                          <td style={{ padding: '5px 10px', color: t.type === 'BUY' ? 'var(--text-positive)' : 'var(--text-negative)', fontWeight: 700 }}>{t.type}</td>
                          <td style={{ padding: '5px 10px', color: 'var(--text-muted)' }}>{t.date}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right', color: 'var(--text-primary)' }}>${t.price.toFixed(2)}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>{t.shares}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 700 }}>${t.value.toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
