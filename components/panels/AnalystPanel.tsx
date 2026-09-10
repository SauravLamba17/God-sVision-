'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useMode } from '@/lib/context/ModeContext'
import { useBeginnerMode } from '@/lib/hooks/useBeginnerMode'
import { GlossaryTooltip } from '@/components/ui/GlossaryTooltip'

const StockDeepDive = dynamic(() => import('@/components/panels/StockDeepDive'), { ssr: false })

interface TopPick {
  ticker: string; name: string; action: 'BUY' | 'SELL' | 'WATCH'; conviction: 'HIGH' | 'MEDIUM' | 'LOW'
  entry: number; target1: number; target2: number; stopLoss: number
  technicalSummary: string; newsCatalyst: string; optionsStrategy: string
}
interface AvoidItem { ticker: string; name: string; reason: string }
interface SectorRotation { sector: string; trend: 'INFLOW' | 'OUTFLOW' | 'NEUTRAL'; avgChangePct: number }
interface DayTradingSetup { ticker: string; name: string; setup: string; trigger: string }

interface AnalystData {
  marketOutlook: { bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; summary: string; keyLevel: string }
  topPicks: TopPick[]
  avoidList: AvoidItem[]
  sectorRotation: SectorRotation[]
  optionsMarketView: string
  dayTradingSetups: DayTradingSetup[]
  riskWarnings: string[]
  market: 'IN' | 'US'
  marketStatus: string
  generatedAt: number
  nextRefresh: number
  universeSize: number
}

const REFRESH_MS = 15 * 60 * 1000
const MANUAL_COOLDOWN_MS = 5 * 60 * 1000

function fmtCountdown(ms: number): string {
  if (ms <= 0) return '0:00'
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const biasColor = (b: string) => b === 'BULLISH' ? 'var(--text-positive)' : b === 'BEARISH' ? 'var(--text-negative)' : 'var(--text-warning)'
const actionColor = (a: string) => a === 'BUY' ? 'var(--text-positive)' : a === 'SELL' ? 'var(--text-negative)' : 'var(--text-muted)'
const convictionColor = (c: string) => c === 'HIGH' ? 'var(--text-positive)' : c === 'MEDIUM' ? 'var(--text-warning)' : 'var(--text-muted)'
const trendColor = (t: string) => t === 'INFLOW' ? 'var(--text-positive)' : t === 'OUTFLOW' ? 'var(--text-negative)' : 'var(--text-muted)'

function BeginnerCardExplainer({ pick, currency }: { pick: TopPick; currency: string }) {
  const rr = pick.entry > 0
    ? ((pick.target1 - pick.entry) / (pick.entry - pick.stopLoss)).toFixed(2)
    : '–'
  const gainPerShare = (pick.target1 - pick.entry).toFixed(2)
  const lossPerShare = (pick.entry - pick.stopLoss).toFixed(2)

  return (
    <div style={{
      margin: '6px 0 4px',
      padding: '8px 10px',
      background: 'rgba(245,158,11,0.06)',
      border: '1px solid rgba(245,158,11,0.2)',
      borderRadius: 3,
      fontSize: 'var(--fs-meta)',
      lineHeight: 1.7,
      color: 'var(--text-secondary)',
    }}>
      <div style={{ fontWeight: 700, color: 'var(--text-warning)', marginBottom: 4, fontSize: 'var(--fs-meta)', letterSpacing: '0.06em' }}>
        📚 WHAT DOES THIS MEAN?
      </div>
      <div>
        The AI thinks <b style={{ color: 'var(--text-primary)' }}>{pick.ticker.replace('.NS', '')}</b> will go{' '}
        <b style={{ color: pick.action === 'BUY' ? 'var(--text-positive)' : pick.action === 'SELL' ? 'var(--text-negative)' : 'var(--text-warning)' }}>
          {pick.action === 'BUY' ? 'UP' : pick.action === 'SELL' ? 'DOWN' : 'SIDEWAYS'}
        </b>{' '}based on technical analysis.
      </div>
      <div style={{ marginTop: 4 }}>
        IF YOU {pick.action === 'SELL' ? 'SHORT SELL' : 'BUY'} at {currency}{pick.entry}:
        <div style={{ marginTop: 2, paddingLeft: 8 }}>
          <div>• You could <b style={{ color: 'var(--text-positive)' }}>gain {currency}{gainPerShare}/share</b> if it hits T1 ({currency}{pick.target1})</div>
          <div>• You could <b style={{ color: 'var(--text-negative)' }}>lose {currency}{lossPerShare}/share</b> if it hits SL ({currency}{pick.stopLoss})</div>
          <div>• For every {currency}1 risked, you could gain <b style={{ color: 'var(--text-positive)' }}>{currency}{rr}</b></div>
        </div>
      </div>
      <div style={{ marginTop: 5, padding: '4px 6px', background: 'rgba(239,68,68,0.08)', borderLeft: '2px solid #ef4444', fontSize: 'var(--fs-meta)' }}>
        ⚠ This is AI analysis, not financial advice. Never invest money you cannot afford to lose.
      </div>
    </div>
  )
}

export default function AnalystPanel() {
  const { isIndia } = useMode()
  const [isBeginnerMode] = useBeginnerMode()
  const market = isIndia ? 'IN' : 'US'
  const accent = isIndia ? '#FF9933' : 'var(--text-accent)'
  const currency = isIndia ? '₹' : '$'

  const [data, setData] = useState<AnalystData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<string>('')
  const [now, setNow] = useState(Date.now())
  const [lastManualRefresh, setLastManualRefresh] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const fetchingRef = useRef(false)

  const fetchData = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      const res = await fetch(`/api/analyst?market=${market}`)
      const j = await res.json()
      if (j.data) { setData(j.data); setSource(j.source || ''); setError(null) }
      else if (j.error) setError(j.error)
    } catch {
      setError('Failed to reach analyst engine')
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [market])

  useEffect(() => {
    setLoading(true)
    fetchData()
    const id = setInterval(fetchData, REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchData])

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.ticker) setSelectedTicker(detail.ticker)
    }
    window.addEventListener('stockSelected', handler)
    return () => window.removeEventListener('stockSelected', handler)
  }, [])

  const manualCooldownLeft = MANUAL_COOLDOWN_MS - (now - lastManualRefresh)
  const canManualRefresh = manualCooldownLeft <= 0

  const handleManualRefresh = () => {
    if (!canManualRefresh) return
    setLastManualRefresh(Date.now())
    setLoading(true)
    fetchData()
  }

  const refreshCountdown = data ? fmtCountdown(data.nextRefresh - now) : '–'

  const statusColor = data?.marketStatus === 'OPEN' ? 'var(--text-positive)' : data?.marketStatus === 'PRE-OPEN' || data?.marketStatus === 'AFTER-HOURS' ? 'var(--text-warning)' : 'var(--text-negative)'

  const sectionTitleStyle: React.CSSProperties = { fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', letterSpacing: '0.1em', padding: '6px 10px 3px' }

  return (
    <div style={{
      fontFamily: 'IBM Plex Mono', border: '1px solid #1e293b', borderLeft: `2px solid ${accent}`, background: 'var(--bg-panel)',
      display: 'flex', flexDirection: 'column', height: '100%',
      width: '100%', minWidth: 0, maxWidth: '100%', overflowX: 'hidden', overflowY: 'hidden', boxSizing: 'border-box',
    }}>
      {/* Sticky header */}
      <div style={{ padding: '5px 10px', borderBottom: '1px solid #1e293b', background: 'var(--bg-header)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: accent, letterSpacing: '0.08em' }}>🤖 GOD'S VISION ANALYST</span>
          {data && (
            <span style={{ fontSize: 'var(--fs-meta)', padding: '1px 5px', borderRadius: 2, background: `${statusColor}20`, color: statusColor }}>
              ● {data.marketStatus}
            </span>
          )}
          {source && (
            <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>{source.toUpperCase()}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>Next: {refreshCountdown}</span>
          <button
            onClick={handleManualRefresh}
            disabled={!canManualRefresh}
            title={canManualRefresh ? 'Refresh now' : `Wait ${fmtCountdown(manualCooldownLeft)}`}
            style={{
              background: 'none', border: 'none', cursor: canManualRefresh ? 'pointer' : 'not-allowed',
              color: canManualRefresh ? accent : 'var(--text-muted)', fontSize: 'var(--fs-body)',
            }}>
            ↻{!canManualRefresh && <span style={{ fontSize: 'var(--fs-meta)', marginLeft: 3 }}>{fmtCountdown(manualCooldownLeft)}</span>}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && !data ? (
          <div style={{ padding: 14, fontSize: 'var(--fs-body)', color: accent }}>ANALYZING MARKET<span className="blink-cursor" /></div>
        ) : error && !data ? (
          <div style={{ padding: 14, fontSize: 'var(--fs-body)', color: 'var(--text-negative)' }}>{error}</div>
        ) : data ? (
          <>
            {/* Beginner Warning Banner */}
            {isBeginnerMode && (
              <div style={{
                margin: '8px 8px 0',
                padding: '8px 10px',
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: 3,
                fontSize: 'var(--fs-meta)',
                color: 'var(--text-warning)',
                lineHeight: 1.6,
              }}>
                <div style={{ fontWeight: 700, marginBottom: 3, fontSize: 'var(--fs-meta)', letterSpacing: '0.06em' }}>
                  ⚠ FOR LEARNING ONLY — BEGINNER MODE ON
                </div>
                These are AI-generated trading suggestions, not financial advice.
                Never invest money you cannot afford to lose.
                Consult a {isIndia ? 'SEBI' : 'SEC'}-registered advisor for real investment decisions.
              </div>
            )}

            {/* Market Outlook Bar */}
            <div style={{ margin: 8, padding: '8px 10px', border: '1px solid #1e293b', borderLeft: `2px solid ${biasColor(data.marketOutlook.bias)}`, background: 'var(--bg-panel)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: biasColor(data.marketOutlook.bias) }}>{data.marketOutlook.bias}</span>
                <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>{data.universeSize} names tracked</span>
              </div>
              <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{data.marketOutlook.summary}</div>
              <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', marginTop: 4 }}>Key level: {data.marketOutlook.keyLevel}</div>
            </div>

            {/* Top Picks */}
            <div style={sectionTitleStyle}>
              TOP PICKS
              {isBeginnerMode && (
                <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                  — AI-suggested trades based on technical analysis
                </span>
              )}
            </div>
            <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {data.topPicks.map(p => {
                const isOpen = expanded === p.ticker
                return (
                  <div key={p.ticker} style={{ border: '1px solid #1e293b', background: 'var(--bg-panel)' }}>
                    <div
                      onClick={() => setExpanded(isOpen ? null : p.ticker)}
                      style={{ padding: '6px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 'var(--fs-meta)', padding: '1px 5px', borderRadius: 2, background: `${actionColor(p.action)}20`, color: actionColor(p.action), fontWeight: 700 }}>{p.action}</span>
                        <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-primary)' }}>{p.ticker.replace('.NS', '')}</span>
                        <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>{p.name}</span>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: convictionColor(p.conviction) }} title={p.conviction} />
                      </div>
                      <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-secondary)' }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                    <div style={{ padding: '0 8px 6px', display: 'flex', gap: 12, fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>
                      <span>Entry <b style={{ color: 'var(--text-primary)' }}>{currency}{p.entry}</b></span>
                      <span>T1 <b style={{ color: 'var(--text-positive)' }}>{currency}{p.target1}</b></span>
                      <span>T2 <b style={{ color: 'var(--text-positive)' }}>{currency}{p.target2}</b></span>
                      <span>
                        <GlossaryTooltip term="ATR" showIcon={isBeginnerMode}>SL</GlossaryTooltip>{' '}
                        <b style={{ color: 'var(--text-negative)' }}>{currency}{p.stopLoss}</b>
                      </span>
                      <span>
                        <GlossaryTooltip term="RISK_REWARD" showIcon={isBeginnerMode}>R:R</GlossaryTooltip>{' '}
                        <b style={{ color: 'var(--text-secondary)' }}>
                          {p.entry > 0 && p.stopLoss > 0
                            ? `1:${((p.target1 - p.entry) / Math.max(p.entry - p.stopLoss, 0.01)).toFixed(1)}`
                            : '–'}
                        </b>
                      </span>
                    </div>
                    {isOpen && (
                      <div style={{ padding: '6px 8px 8px', borderTop: '1px solid #1b2e1b', fontSize: 'var(--fs-meta)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        <div style={{ marginBottom: 4 }}>{p.technicalSummary}</div>
                        <div style={{ marginBottom: 4, color: 'var(--text-muted)' }}>📰 {p.newsCatalyst}</div>
                        <div style={{ marginBottom: 4, color: 'var(--text-muted)' }}>
                          ⚙ <GlossaryTooltip term={
                            p.optionsStrategy.includes('Bull Call') ? 'BULL_CALL_SPREAD' :
                            p.optionsStrategy.includes('Iron Condor') ? 'IRON_CONDOR' :
                            p.optionsStrategy.includes('Put') ? 'PUT_OPTION' : 'CALL_OPTION'
                          } showIcon={isBeginnerMode}>{p.optionsStrategy}</GlossaryTooltip>
                        </div>
                        {isBeginnerMode && <BeginnerCardExplainer pick={p} currency={currency} />}
                        <button
                          onClick={() => setSelectedTicker(p.ticker)}
                          style={{ fontSize: 'var(--fs-meta)', padding: '3px 8px', background: `${accent}15`, color: accent, border: `1px solid ${accent}40`, borderRadius: 2, cursor: 'pointer', marginTop: 4 }}>
                          DEEP DIVE →
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Avoid List */}
            {data.avoidList.length > 0 && (
              <>
                <div style={sectionTitleStyle}>AVOID LIST</div>
                <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {data.avoidList.map(a => (
                    <div key={a.ticker} style={{ padding: '5px 8px', border: '1px solid #2a1414', borderLeft: '2px solid #ef4444', background: '#1a0a0a', fontSize: 'var(--fs-meta)' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-negative)' }}>{a.ticker.replace('.NS', '')}</span>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>{a.reason}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Day Trading Setups */}
            {data.dayTradingSetups.length > 0 && (
              <>
                <div style={sectionTitleStyle}>INTRADAY SETUPS</div>
                <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {data.dayTradingSetups.map(d => (
                    <div key={d.ticker} style={{ padding: '5px 8px', border: '1px solid #1e293b', fontSize: 'var(--fs-meta)' }}>
                      <span style={{ fontWeight: 700, color: accent }}>{d.ticker.replace('.NS', '')}</span>
                      <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{d.setup}</div>
                      <div style={{ color: 'var(--text-muted)', marginTop: 1, fontSize: 'var(--fs-meta)' }}>Trigger: {d.trigger}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Options Market View */}
            <div style={sectionTitleStyle}>
              <GlossaryTooltip term="CALL_OPTION" showIcon={isBeginnerMode}>OPTIONS</GlossaryTooltip> MARKET VIEW
            </div>
            <div style={{ margin: '0 8px 8px', padding: '6px 8px', border: '1px solid #1e293b', fontSize: 'var(--fs-meta)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {data.optionsMarketView}
            </div>

            {/* Sector Rotation */}
            <div style={sectionTitleStyle}>
              SECTOR ROTATION
              {isBeginnerMode && (
                <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                  — which industries money is flowing into/out of
                </span>
              )}
            </div>
            <div style={{ padding: '0 8px 8px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {data.sectorRotation.map(s => (
                <span key={s.sector} style={{ fontSize: 'var(--fs-meta)', padding: '2px 6px', borderRadius: 2, background: `${trendColor(s.trend)}15`, color: trendColor(s.trend), border: `1px solid ${trendColor(s.trend)}30` }}>
                  {s.sector} {s.trend} ({s.avgChangePct >= 0 ? '+' : ''}{s.avgChangePct}%)
                </span>
              ))}
            </div>

            {/* Risk Warnings */}
            <div style={{ margin: '0 8px 8px', padding: '6px 8px', border: '1px solid #422006', background: '#1a1206', fontSize: 'var(--fs-meta)', color: '#fbbf24' }}>
              {data.riskWarnings.map((w, i) => <div key={i} style={{ marginBottom: i < data.riskWarnings.length - 1 ? 3 : 0 }}>⚠ {w}</div>)}
            </div>
          </>
        ) : null}
      </div>

      {/* Mandatory compliance disclaimer — always rendered */}
      <div style={{ padding: '6px 10px', borderTop: '1px solid #1e293b', background: '#000', fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', lineHeight: 1.4 }}>
        ⚠ FOR INFORMATIONAL PURPOSES ONLY — NOT INVESTMENT ADVICE. Equity &amp; derivatives trading carries substantial risk of loss. AI-generated analysis may contain errors or omissions. Not a {isIndia ? 'SEBI' : 'SEC'}-registered investment advisor. Consult a licensed financial advisor before trading. Past performance does not guarantee future results.
      </div>

      {selectedTicker && (
        <StockDeepDive ticker={selectedTicker} market={market} onClose={() => setSelectedTicker(null)} />
      )}
    </div>
  )
}
