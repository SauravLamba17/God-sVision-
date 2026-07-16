'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import CandlestickChart from '@/components/charts/CandlestickChart'
import type { OHLCCandle, IndicatorPoint } from '@/components/charts/CandlestickChartInner'
import { sma, bollingerBands, rsi, macd, Candle } from '@/lib/utils/technicals'
import { GlossaryTooltip } from '@/components/ui/GlossaryTooltip'

interface StockSnapshot {
  ticker: string; name: string; price: number; changePct: number; weeklyChangePct: number; monthlyChangePct: number
  volume: number; volumeRatio: number; obvTrend: string
  rsi: number | null
  macd: { value: number | null; signal: number | null; histogram: number | null }
  sma20: number | null; sma50: number | null; ema9: number | null; ema21: number | null
  bollinger: { upper: number | null; middle: number | null; lower: number | null }
  atr: number | null
  supertrend: { value: number | null; trend: string | null }
  vwap: number | null
  support: number[]; resistance: number[]
  fibonacci: Record<string, number>
  patterns: string[]
  high52: number; low52: number
  candles?: Candle[]
}
interface NewsArticle { title: string; url: string; source: string; publishedAt: string; summary?: string }
interface OptionsChain {
  atmStrike: number; strikeStep: number; ivBase: number; note: string
  strikes: { strike: number; call: { oi: number; iv: number; ltp: number }; put: { oi: number; iv: number; ltp: number } }[]
}
interface DeepDiveData {
  snapshot: StockSnapshot; news: NewsArticle[]; optionsChain: OptionsChain; fundamentals: any
  ai: { analysis: string; verdict: string; confidence: number }
  generatedAt: number
}

type Tab = 'technical' | 'fundamentals' | 'options' | 'news' | 'ai'

const TABS: { id: Tab; label: string }[] = [
  { id: 'technical',    label: 'TECHNICAL' },
  { id: 'fundamentals', label: 'FUNDAMENTALS' },
  { id: 'options',      label: 'OPTIONS' },
  { id: 'news',         label: 'NEWS' },
  { id: 'ai',           label: 'AI ANALYSIS' },
]

export default function StockDeepDive({ ticker, market, onClose }: { ticker: string; market: 'IN' | 'US'; onClose: () => void }) {
  const [data, setData] = useState<DeepDiveData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('technical')
  const accent = market === 'IN' ? '#FF9933' : 'var(--text-accent)'
  const currency = market === 'IN' ? '₹' : '$'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/analyst/stock?ticker=${encodeURIComponent(ticker)}&market=${market}`)
      .then(r => r.json())
      .then(j => { if (!cancelled) { if (j.data) setData(j.data); else setError(j.error || 'No data') } })
      .catch(() => { if (!cancelled) setError('Failed to load stock detail') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [ticker, market])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const chartProps = useMemo(() => {
    const candles = data?.snapshot.candles
    if (!candles || candles.length < 20) return null
    const closes = candles.map(c => c.close)
    const sma20 = sma(closes, 20)
    const sma50 = sma(closes, 50)
    const bb = bollingerBands(closes, 20, 2)
    const rsiArr = rsi(closes, 14)
    const macdRes = macd(closes)
    const toPoints = (arr: (number | null)[]): IndicatorPoint[] => candles.map((c, i) => ({ time: c.time, value: arr[i] }))
    const ohlc: OHLCCandle[] = candles.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }))
    return {
      candles: ohlc,
      overlays: { sma20: toPoints(sma20), sma50: toPoints(sma50), bbUpper: toPoints(bb.upper), bbLower: toPoints(bb.lower) },
      rsiData: toPoints(rsiArr),
      macdData: candles.map((c, i) => ({ time: c.time, macd: macdRes.macdLine[i], signal: macdRes.signalLine[i], hist: macdRes.histogram[i] })),
    }
  }, [data])

  const close = useCallback(() => onClose(), [onClose])

  return (
    <div
      onClick={close}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(960px, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-terminal)', border: `1px solid ${accent}40`, fontFamily: 'IBM Plex Mono', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #1e293b', background: 'var(--bg-header)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: accent }}>{ticker.replace('.NS', '')}</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{data?.snapshot.name}</span>
            {data && (
              <>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{currency}{data.snapshot.price.toFixed(2)}</span>
                <span style={{ fontSize: 10, color: data.snapshot.changePct >= 0 ? 'var(--text-positive)' : 'var(--text-negative)' }}>
                  {data.snapshot.changePct >= 0 ? '▲' : '▼'} {Math.abs(data.snapshot.changePct).toFixed(2)}%
                </span>
              </>
            )}
          </div>
          <button onClick={close} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 16, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, padding: '6px 10px', borderBottom: '1px solid #1b2e1b', background: 'var(--bg-panel)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                fontSize: 9, padding: '4px 10px', cursor: 'pointer', borderRadius: 2,
                background: tab === t.id ? `${accent}18` : 'transparent',
                color: tab === t.id ? accent : 'var(--text-muted)',
                border: '1px solid', borderColor: tab === t.id ? `${accent}40` : 'transparent',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {loading ? (
            <div style={{ fontSize: 10, color: accent }}>LOADING DEEP DIVE<span className="blink-cursor" /></div>
          ) : error ? (
            <div style={{ fontSize: 10, color: 'var(--text-negative)' }}>{error}</div>
          ) : !data ? null : (
            <>
              {tab === 'technical' && (
                <div>
                  {chartProps ? (
                    <CandlestickChart {...chartProps} height={460} showVolume showRsi showMacd />
                  ) : (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Not enough history to render chart.</div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
                    {([
                      ['RSI', 'RSI (14)', data.snapshot.rsi?.toFixed(1) ?? '—'],
                      ['MACD', 'MACD Hist', data.snapshot.macd.histogram?.toFixed(2) ?? '—'],
                      ['ATR', 'ATR (14)', data.snapshot.atr?.toFixed(2) ?? '—'],
                      ['SUPERTREND', 'Supertrend', data.snapshot.supertrend.trend ?? '—'],
                      ['SMA', 'SMA20', data.snapshot.sma20?.toFixed(2) ?? '—'],
                      ['SMA', 'SMA50', data.snapshot.sma50?.toFixed(2) ?? '—'],
                      ['VWAP', 'VWAP', data.snapshot.vwap?.toFixed(2) ?? '—'],
                      ['VOLUME', 'Vol Ratio', `${data.snapshot.volumeRatio.toFixed(2)}x`],
                    ] as [string, string, string][]).map(([glossaryKey, label, val]) => (
                      <div key={label} style={{ border: '1px solid #1e293b', padding: '6px 8px' }}>
                        <div style={{ fontSize: 7, color: 'var(--text-muted)' }}>
                          <GlossaryTooltip term={glossaryKey}>{label}</GlossaryTooltip>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-primary)', marginTop: 2 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                    <div style={{ border: '1px solid #1e293b', padding: '6px 8px' }}>
                      <div style={{ fontSize: 7, color: 'var(--text-muted)', marginBottom: 4 }}>
                        <GlossaryTooltip term="SUPPORT">SUPPORT</GlossaryTooltip>
                      </div>
                      {data.snapshot.support.map((s, i) => <div key={i} style={{ fontSize: 10, color: 'var(--text-positive)' }}>{currency}{s.toFixed(2)}</div>)}
                    </div>
                    <div style={{ border: '1px solid #1e293b', padding: '6px 8px' }}>
                      <div style={{ fontSize: 7, color: 'var(--text-muted)', marginBottom: 4 }}>
                        <GlossaryTooltip term="RESISTANCE">RESISTANCE</GlossaryTooltip>
                      </div>
                      {data.snapshot.resistance.map((s, i) => <div key={i} style={{ fontSize: 10, color: 'var(--text-negative)' }}>{currency}{s.toFixed(2)}</div>)}
                    </div>
                  </div>
                  {data.snapshot.patterns.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {data.snapshot.patterns.map(p => (
                        <span key={p} style={{ fontSize: 8, padding: '2px 6px', background: `${accent}15`, color: accent, borderRadius: 2 }}>{p.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === 'fundamentals' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                      ['52W High', `${currency}${data.snapshot.high52.toFixed(2)}`],
                      ['52W Low', `${currency}${data.snapshot.low52.toFixed(2)}`],
                      ['Volume', data.snapshot.volume.toLocaleString()],
                      ...(data.fundamentals?.summaryDetail?.marketCap ? [['Market Cap', (data.fundamentals.summaryDetail.marketCap / 1e9).toFixed(2) + 'B']] : []),
                      ...(data.fundamentals?.summaryDetail?.trailingPE ? [['Trailing P/E', data.fundamentals.summaryDetail.trailingPE.toFixed(2)]] : []),
                      ...(data.fundamentals?.summaryDetail?.dividendYield ? [['Div Yield', (data.fundamentals.summaryDetail.dividendYield * 100).toFixed(2) + '%']] : []),
                      ...(data.fundamentals?.financialData?.returnOnEquity ? [['ROE', (data.fundamentals.financialData.returnOnEquity * 100).toFixed(1) + '%']] : []),
                      ...(data.fundamentals?.financialData?.profitMargins ? [['Profit Margin', (data.fundamentals.financialData.profitMargins * 100).toFixed(1) + '%']] : []),
                    ].map(([label, val]) => (
                      <div key={label} style={{ border: '1px solid #1e293b', padding: '6px 8px' }}>
                        <div style={{ fontSize: 7, color: 'var(--text-muted)' }}>{label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-primary)', marginTop: 2 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  {!data.fundamentals && (
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 10 }}>Extended fundamentals (P/E, ROE, margins) unavailable for this ticker from the data provider.</div>
                  )}
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 7, color: 'var(--text-muted)', marginBottom: 4 }}>
                      <GlossaryTooltip term="FIBONACCI">FIBONACCI RETRACEMENT (60D RANGE)</GlossaryTooltip>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {Object.entries(data.snapshot.fibonacci).map(([level, val]) => (
                        <span key={level} style={{ fontSize: 9, padding: '3px 6px', border: '1px solid #1e293b', color: 'var(--text-secondary)' }}>{level}%: {currency}{val.toFixed(2)}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'options' && (
                <div>
                  <div style={{ fontSize: 8, color: 'var(--text-warning)', marginBottom: 8 }}>⚠ {data.optionsChain.note}</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1b2e1b' }}>
                        {([
                          ['CALL_OPTION', 'CALL OI'],
                          ['IV', 'CALL IV'],
                          ['PREMIUM', 'CALL LTP'],
                          ['STRIKE_PRICE', 'STRIKE'],
                          ['PREMIUM', 'PUT LTP'],
                          ['IV', 'PUT IV'],
                          ['PUT_OPTION', 'PUT OI'],
                        ] as [string, string][]).map(([glossaryKey, h]) => (
                          <th key={h} style={{ fontSize: 7, color: 'var(--text-muted)', padding: '4px 6px', textAlign: 'center' }}>
                            <GlossaryTooltip term={glossaryKey}>{h}</GlossaryTooltip>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.optionsChain.strikes.map(s => (
                        <tr key={s.strike} style={{ borderBottom: '1px solid #0d1a0d', background: s.strike === data.optionsChain.atmStrike ? `${accent}10` : 'transparent' }}>
                          <td style={{ padding: '4px 6px', textAlign: 'center', color: 'var(--text-positive)' }}>{s.call.oi.toLocaleString()}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', color: 'var(--text-secondary)' }}>{s.call.iv}%</td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', color: 'var(--text-primary)' }}>{currency}{s.call.ltp}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 700, color: s.strike === data.optionsChain.atmStrike ? accent : 'var(--text-primary)' }}>{s.strike}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', color: 'var(--text-primary)' }}>{currency}{s.put.ltp}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', color: 'var(--text-secondary)' }}>{s.put.iv}%</td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', color: 'var(--text-negative)' }}>{s.put.oi.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {tab === 'news' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {data.news.length === 0 ? (
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>No recent company-specific headlines found.</div>
                  ) : data.news.map((n, i) => (
                    <div key={i} onClick={() => window.open(n.url, '_blank')}
                      style={{ padding: '8px 10px', border: '1px solid #1e293b', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-header)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ fontSize: 10, color: 'var(--text-primary)', marginBottom: 3 }}>{n.title}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ fontSize: 7, color: accent }}>{n.source}</span>
                        <span style={{ fontSize: 7, color: 'var(--text-muted)' }}>{new Date(n.publishedAt).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'ai' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 2,
                      color: data.ai.verdict === 'BUY' ? 'var(--text-positive)' : data.ai.verdict === 'SELL' ? 'var(--text-negative)' : 'var(--text-muted)',
                      background: data.ai.verdict === 'BUY' ? '#22c55e15' : data.ai.verdict === 'SELL' ? '#ef444415' : '#64748b15',
                    }}>{data.ai.verdict}</span>
                    <div style={{ flex: 1, height: 5, background: 'var(--border-color)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${data.ai.confidence}%`, height: '100%', background: accent }} />
                    </div>
                    <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{data.ai.confidence}% confidence</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-primary)', lineHeight: 1.7 }}>{data.ai.analysis}</div>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ padding: '6px 16px', borderTop: '1px solid #1e293b', background: '#000', fontSize: 7, color: 'var(--text-muted)' }}>
          ⚠ AI-generated analysis for informational purposes only. Not investment advice.
        </div>
      </div>
    </div>
  )
}
