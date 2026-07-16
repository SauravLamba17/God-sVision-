'use client';
import { useState, useEffect } from 'react';

interface YieldData {
  symbol: string;
  label: string;
  maturity: string;
  yield: number;
  change: number;
  changePct: number;
}

interface ETFData {
  symbol: string;
  label: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  yield: string | null;
}

interface SpreadData {
  [key: string]: { label: string; value: number; date: string };
}

export default function BondsPage() {
  const [yields, setYields] = useState<YieldData[]>([]);
  const [etfs, setEtfs] = useState<ETFData[]>([]);
  const [spreads, setSpreads] = useState<SpreadData>({});
  const [activeTab, setActiveTab] = useState<'overview' | 'etfs' | 'spreads' | 'calculator'>('overview');
  const [loading, setLoading] = useState(true);

  // Bond yield calculator state
  const [calcFaceValue, setCalcFaceValue] = useState(1000);
  const [calcCouponRate, setCalcCouponRate] = useState(5);
  const [calcYearsToMaturity, setCalcYearsToMaturity] = useState(10);
  const [calcMarketPrice, setCalcMarketPrice] = useState(950);
  const [calcYTM, setCalcYTM] = useState<number | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [yRes, eRes, sRes] = await Promise.all([
          fetch('/api/bonds?type=yields'),
          fetch('/api/bonds?type=etfs'),
          fetch('/api/bonds?type=spread'),
        ]);
        const [y, e, s] = await Promise.all([yRes.json(), eRes.json(), sRes.json()]);
        setYields(Array.isArray(y) ? y : []);
        setEtfs(Array.isArray(e) ? e : []);
        setSpreads(s ?? {});
      } catch { /* silent */ }
      setLoading(false);
    };
    fetchAll();
    const iv = setInterval(fetchAll, 300000);
    return () => clearInterval(iv);
  }, []);

  // YTM Calculator using Newton-Raphson method
  const calculateYTM = () => {
    const fv = calcFaceValue;
    const c = (calcCouponRate / 100) * fv;
    const n = calcYearsToMaturity;
    const p = calcMarketPrice;

    let ytm = c / p;
    for (let i = 0; i < 100; i++) {
      const pv = c * (1 - Math.pow(1 + ytm, -n)) / ytm + fv / Math.pow(1 + ytm, n);
      const dpv = -c * (1 - Math.pow(1 + ytm, -n)) / (ytm * ytm)
        + c * n * Math.pow(1 + ytm, -n - 1) / ytm
        - fv * n * Math.pow(1 + ytm, -n - 1);
      const diff = pv - p;
      if (Math.abs(diff) < 0.0001) break;
      ytm = ytm - diff / dpv;
    }
    setCalcYTM(parseFloat((ytm * 100).toFixed(4)));
  };

  const panelStyle: React.CSSProperties = {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    background: 'var(--bg-header)',
    borderBottom: '1px solid var(--border-color)',
    padding: '8px 12px',
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--text-accent)',
    letterSpacing: '0.5px',
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid var(--text-accent)' : '2px solid transparent',
    color: active ? 'var(--text-accent)' : 'var(--text-muted)',
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: '10px',
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.5px',
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-terminal)',
      padding: '8px',
      color: 'var(--text-primary)',
    }}>
      {/* Page header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px',
      }}>
        <div style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '13px',
          fontWeight: 700,
          color: 'var(--text-accent)',
          letterSpacing: '1px',
        }}>
          FIXED INCOME INTELLIGENCE
        </div>
        <div style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '10px',
          color: 'var(--text-muted)',
        }}>
          Treasury Yields · Bond ETFs · Credit Spreads · YTM Calculator
        </div>
      </div>

      {/* Tab navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: '10px',
      }}>
        {(['overview', 'etfs', 'spreads', 'calculator'] as const).map(tab => (
          <button key={tab} style={tabStyle(activeTab === tab)}
            onClick={() => setActiveTab(tab)}>
            {tab === 'overview' ? 'YIELD CURVE' :
             tab === 'etfs' ? 'BOND ETFs' :
             tab === 'spreads' ? 'CREDIT SPREADS' : 'YTM CALCULATOR'}
          </button>
        ))}
      </div>

      {/* YIELD CURVE TAB */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '8px' }}>
          {/* Treasury yields table */}
          <div style={panelStyle}>
            <div style={headerStyle}>US TREASURY YIELDS</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {['MATURITY', 'YIELD %', 'CHG', 'CHG%'].map(h => (
                    <th key={h} style={{ padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '9px', textAlign: h === 'MATURITY' ? 'left' : 'right', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1,2,3,4].map(i => (
                    <tr key={i}><td colSpan={4} style={{ padding: '8px 10px' }}>
                      <div style={{ height: '16px', background: 'var(--bg-hover)', borderRadius: '2px', animation: 'pulse 1.5s infinite' }} />
                    </td></tr>
                  ))
                ) : yields.map(y => (
                  <tr key={y.symbol}
                    style={{ borderBottom: '1px solid var(--border-color)', cursor: 'default' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                    <td style={{ padding: '8px 10px', color: 'var(--text-accent)', fontWeight: 700 }}>{y.label}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 700 }}>{y.yield.toFixed(2)}%</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: y.change >= 0 ? 'var(--text-positive)' : 'var(--text-negative)' }}>
                      {y.change >= 0 ? '+' : ''}{y.change.toFixed(3)}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: y.changePct >= 0 ? 'var(--text-positive)' : 'var(--text-negative)' }}>
                      {y.changePct >= 0 ? '+' : ''}{y.changePct.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Yield curve visual */}
          <div style={panelStyle}>
            <div style={headerStyle}>YIELD CURVE SHAPE</div>
            <div style={{ padding: '12px' }}>
              {yields.length > 0 && (
                <svg viewBox="0 0 300 160" style={{ width: '100%' }}>
                  {/* Grid lines */}
                  {[0,1,2,3,4].map(i => (
                    <line key={i} x1="40" y1={20 + i * 30} x2="290" y2={20 + i * 30}
                      stroke="var(--border-color)" strokeWidth="0.5" />
                  ))}
                  {/* Curve */}
                  {yields.length >= 2 && (() => {
                    const maxY = Math.max(...yields.map(y => y.yield));
                    const minY = Math.min(...yields.map(y => y.yield));
                    const range = maxY - minY || 1;
                    const pts = yields.map((y, i) => {
                      const x = 40 + (i / (yields.length - 1)) * 250;
                      const yPos = 20 + ((maxY - y.yield) / range) * 120;
                      return `${x},${yPos}`;
                    });
                    return (
                      <>
                        <polyline points={pts.join(' ')} fill="none"
                          stroke="var(--text-accent)" strokeWidth="2" strokeLinejoin="round" />
                        {yields.map((y, i) => {
                          const x = 40 + (i / (yields.length - 1)) * 250;
                          const yPos = 20 + ((maxY - y.yield) / range) * 120;
                          return (
                            <g key={i}>
                              <circle cx={x} cy={yPos} r="4" fill="var(--text-accent)" />
                              <text x={x} y={yPos - 8} textAnchor="middle"
                                fontSize="9" fill="var(--text-primary)" fontFamily="IBM Plex Mono">
                                {y.yield.toFixed(2)}%
                              </text>
                              <text x={x} y="155" textAnchor="middle"
                                fontSize="8" fill="var(--text-muted)" fontFamily="IBM Plex Mono">
                                {y.maturity}
                              </text>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              )}
              {/* Inversion warning */}
              {yields.length >= 2 && yields[0]?.yield > yields[yields.length - 1]?.yield && (
                <div style={{
                  marginTop: '8px',
                  padding: '6px 10px',
                  background: 'rgba(255,23,68,0.08)',
                  border: '1px solid rgba(255,23,68,0.3)',
                  borderRadius: '3px',
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: '10px',
                  color: 'var(--text-negative)',
                }}>
                  ⚠ INVERTED YIELD CURVE — Recession indicator
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BOND ETFs TAB */}
      {activeTab === 'etfs' && (
        <div style={panelStyle}>
          <div style={headerStyle}>BOND ETFs — REAL-TIME</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {['SYMBOL', 'NAME', 'PRICE', 'CHG', 'CHG%', 'YIELD', 'VOLUME'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '9px', textAlign: h === 'SYMBOL' || h === 'NAME' ? 'left' : 'right', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1,2,3,4,5,6,7,8].map(i => (
                  <tr key={i}><td colSpan={7} style={{ padding: '8px 10px' }}>
                    <div style={{ height: '16px', background: 'var(--bg-hover)', borderRadius: '2px' }} />
                  </td></tr>
                ))
              ) : etfs.map(e => (
                <tr key={e.symbol}
                  style={{ borderBottom: '1px solid var(--border-color)' }}
                  onMouseEnter={ev => (ev.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-hover)'}
                  onMouseLeave={ev => (ev.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                  <td style={{ padding: '8px 10px', color: 'var(--text-accent)', fontWeight: 700 }}>{e.symbol}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontSize: '10px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 700 }}>${e.price.toFixed(2)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: e.change >= 0 ? 'var(--text-positive)' : 'var(--text-negative)' }}>
                    {e.change >= 0 ? '+' : ''}{e.change.toFixed(2)}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: e.changePct >= 0 ? 'var(--text-positive)' : 'var(--text-negative)', fontWeight: 700 }}>
                    {e.changePct >= 0 ? '+' : ''}{e.changePct.toFixed(2)}%
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-info)' }}>
                    {e.yield ? `${e.yield}%` : '—'}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '10px' }}>
                    {e.volume >= 1e6 ? `${(e.volume/1e6).toFixed(1)}M` : e.volume >= 1e3 ? `${(e.volume/1e3).toFixed(0)}K` : `${e.volume}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CREDIT SPREADS TAB */}
      {activeTab === 'spreads' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '8px' }}>
          {Object.entries(spreads).map(([id, s]) => (
            <div key={id} style={{
              ...panelStyle,
              padding: '16px',
            }}>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '6px' }}>
                {s.label}
              </div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '28px', fontWeight: 700, color: s.value < 0 ? 'var(--text-negative)' : 'var(--text-primary)' }}>
                {s.value > 0 ? '+' : ''}{s.value.toFixed(2)}%
              </div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
                As of {s.date} · Source: FRED
              </div>
              <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                {id === 'BAMLC0A0CM' && (s.value < 1.5 ? '✓ Tight spreads — credit markets healthy' : s.value < 3 ? '⚠ Moderate spreads — some credit stress' : '⚠ Wide spreads — credit stress elevated')}
                {id === 'BAMLH0A0HYM2' && (s.value < 4 ? '✓ Tight HY spreads — risk-on sentiment' : s.value < 7 ? '⚠ Moderate HY spreads' : '⚠ Wide HY spreads — risk-off / recession risk')}
                {id === 'T10Y2Y' && (s.value < 0 ? '⚠ Inverted curve — recession indicator' : s.value < 0.5 ? '⚠ Flat curve — slowing growth' : '✓ Normal curve — healthy economy')}
                {id === 'T10Y3M' && (s.value < 0 ? '⚠ Inverted — historically precedes recession' : '✓ Positive spread')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* YTM CALCULATOR TAB */}
      {activeTab === 'calculator' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '8px' }}>
          <div style={panelStyle}>
            <div style={headerStyle}>YIELD TO MATURITY CALCULATOR</div>
            <div style={{ padding: '16px', fontFamily: 'IBM Plex Mono, monospace' }}>
              {[
                { label: 'Face Value ($)', value: calcFaceValue, setter: setCalcFaceValue },
                { label: 'Coupon Rate (%)', value: calcCouponRate, setter: setCalcCouponRate },
                { label: 'Years to Maturity', value: calcYearsToMaturity, setter: setCalcYearsToMaturity },
                { label: 'Market Price ($)', value: calcMarketPrice, setter: setCalcMarketPrice },
              ].map(field => (
                <div key={field.label} style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.5px' }}>
                    {field.label}
                  </div>
                  <input
                    type="number"
                    value={field.value}
                    onChange={e => field.setter(parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      padding: '8px 10px',
                      fontFamily: 'IBM Plex Mono, monospace',
                      fontSize: '13px',
                      borderRadius: '3px',
                      outline: 'none',
                    }}
                  />
                </div>
              ))}
              <button
                onClick={calculateYTM}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--text-accent)',
                  border: 'none',
                  color: '#000',
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  cursor: 'pointer',
                  borderRadius: '3px',
                }}>
                CALCULATE YTM
              </button>
            </div>
          </div>

          <div style={panelStyle}>
            <div style={headerStyle}>RESULT</div>
            <div style={{ padding: '24px', textAlign: 'center' }}>
              {calcYTM !== null ? (
                <>
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '8px' }}>
                    YIELD TO MATURITY
                  </div>
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '48px', fontWeight: 700, color: calcYTM > calcCouponRate ? 'var(--text-positive)' : 'var(--text-negative)' }}>
                    {calcYTM}%
                  </div>
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px', lineHeight: 1.8 }}>
                    <div>Coupon Rate: {calcCouponRate}%</div>
                    <div>Annual Coupon: ${(calcFaceValue * calcCouponRate / 100).toFixed(2)}</div>
                    <div>Price vs Par: {calcMarketPrice > calcFaceValue ? 'Trading at PREMIUM' : calcMarketPrice < calcFaceValue ? 'Trading at DISCOUNT' : 'Trading at PAR'}</div>
                    <div style={{ marginTop: '8px', color: calcYTM > calcCouponRate ? 'var(--text-positive)' : 'var(--text-negative)' }}>
                      {calcYTM > calcCouponRate ? 'YTM > Coupon: Bond at discount' : 'YTM < Coupon: Bond at premium'}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Enter bond details and click Calculate
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
