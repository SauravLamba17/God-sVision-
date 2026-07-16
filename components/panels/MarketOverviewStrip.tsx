'use client'
import { useEffect, useState, useCallback } from 'react'

/* ── Tiny inline sparkline SVG ─────────────────────────────────────────── */
function Spark({ data, positive, w = 64, h = 28 }: { data: number[]; positive: boolean; w?: number; h?: number }) {
  if (!data || data.length < 2) return <svg width={w} height={h} />
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - 2 - ((v - min) / range) * (h - 4)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const color = positive ? 'var(--text-positive)' : 'var(--text-negative)'
  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/* ── Number formatters ─────────────────────────────────────────────────── */
function fmtPrice(n: number, unit: string) {
  if (!n) return 'N/A'
  if (unit === '%') return n.toFixed(2) + '%'
  if (n >= 10000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (n >= 1000)  return n.toLocaleString('en-US', { maximumFractionDigits: 1 })
  if (n >= 10)    return n.toFixed(2)
  return n.toFixed(3)
}
function fmtPct(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

/* ── Types ─────────────────────────────────────────────────────────────── */
interface QuoteTick {
  symbol: string; label: string; price: number; change: number
  changePct: number; sparkline: number[]; unit?: string
  region?: string; failed?: boolean
}
interface Breadth { advancing: number; declining: number; unchanged: number }
interface OverviewData {
  indices: QuoteTick[]; commodities: QuoteTick[]
  globalMarkets: QuoteTick[]; breadth: Breadth; fetchedAt: number
}

/* ── Section A — 5 index cards ─────────────────────────────────────────── */
function IndexCard({ q }: { q: QuoteTick }) {
  const pos = q.changePct >= 0
  const cc  = pos ? 'var(--text-positive)' : 'var(--text-negative)'
  return (
    <div style={{
      flex: 1, background: 'var(--bg-terminal)', borderLeft: '3px solid #ff6d00',
      border: '1px solid #1b2e1b', borderLeftWidth: 3, borderLeftColor: 'var(--text-accent)',
      padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
        {q.label}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 18, fontWeight: 700, color: '#c8e6c9', lineHeight: 1 }}>
            {fmtPrice(q.price, q.unit || '')}
          </div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, fontWeight: 700, color: cc, marginTop: 2 }}>
            {pos ? '▲' : '▼'} {fmtPct(q.changePct)}
          </div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: cc }}>
            {q.change >= 0 ? '+' : ''}{q.change.toFixed(2)}
          </div>
        </div>
        {q.sparkline.length > 1 && <Spark data={q.sparkline} positive={pos} w={64} h={32} />}
      </div>
    </div>
  )
}

/* ── Section B — commodity strip ───────────────────────────────────────── */
function CommodityStrip({ items }: { items: QuoteTick[] }) {
  return (
    <div style={{
      background: '#030803', padding: '5px 12px', display: 'flex',
      alignItems: 'center', gap: 0, overflowX: 'auto', borderTop: '1px solid #1b2e1b',
      flexWrap: 'nowrap', scrollbarWidth: 'none',
    }}>
      {items.map((q, i) => {
        const pos = q.changePct >= 0
        return (
          <span key={q.symbol} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {i > 0 && <span style={{ color: 'var(--border-color)', margin: '0 8px' }}>|</span>}
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 700, color: 'var(--text-accent)' }}>{q.label}</span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-primary)' }}>
              {q.unit === '%' ? '' : '$'}{fmtPrice(q.price, q.unit || '')}
              {q.unit && q.unit !== '%' && <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>{q.unit}</span>}
            </span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 700, color: pos ? 'var(--text-positive)' : 'var(--text-negative)' }}>
              {fmtPct(q.changePct)}
            </span>
          </span>
        )
      })}
    </div>
  )
}

/* ── Section C — global market row ─────────────────────────────────────── */
function GlobalMarketRow({ markets, region, label }: { markets: QuoteTick[]; region: string; label: string }) {
  const filtered = markets.filter(m => m.region === region)
  if (!filtered.length) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '3px 12px', borderTop: '1px solid #0d1a0d', flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none' }}>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--text-muted)', marginRight: 10, flexShrink: 0, minWidth: 32 }}>{label}</span>
      {filtered.map((q, i) => {
        const pos = q.changePct >= 0
        return (
          <span key={q.symbol} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {i > 0 && <span style={{ color: 'var(--border-color)', margin: '0 6px' }}>·</span>}
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-secondary)' }}>{q.label}</span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: pos ? 'var(--text-positive)' : 'var(--text-negative)', fontWeight: 700 }}>
              {fmtPrice(q.price, '')} <span style={{ fontSize: 8 }}>{fmtPct(q.changePct)}</span>
            </span>
            {(q as any).failed && <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 7, color: 'var(--text-muted)', background: 'var(--border-color)', padding: '0 3px', borderRadius: 2 }}>DELAYED</span>}
          </span>
        )
      })}
    </div>
  )
}

/* ── Section D — breadth bar ────────────────────────────────────────────── */
function BreadthBar({ breadth }: { breadth: Breadth }) {
  const total   = breadth.advancing + breadth.declining + breadth.unchanged || 500
  const advPct  = (breadth.advancing / total) * 100
  const decPct  = (breadth.declining / total) * 100
  const unchPct = (breadth.unchanged / total) * 100
  return (
    <div style={{ padding: '6px 10px' }}>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.08em' }}>S&P 500 BREADTH (SECTOR APPROX)</div>
      {/* Stacked bar */}
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
        <div style={{ width: `${advPct}%`, background: 'var(--text-positive)' }} />
        <div style={{ width: `${unchPct}%`, background: 'var(--text-muted)' }} />
        <div style={{ width: `${decPct}%`, background: 'var(--text-negative)' }} />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9 }}>
          <span style={{ color: 'var(--text-positive)', fontWeight: 700 }}>▲ {breadth.advancing}</span>
          <span style={{ color: 'var(--text-muted)', marginLeft: 2 }}>ADV</span>
        </span>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9 }}>
          <span style={{ color: 'var(--text-negative)', fontWeight: 700 }}>▼ {breadth.declining}</span>
          <span style={{ color: 'var(--text-muted)', marginLeft: 2 }}>DEC</span>
        </span>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9 }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{breadth.unchanged}</span>
          <span style={{ color: 'var(--text-muted)', marginLeft: 2 }}>UNCH</span>
        </span>
      </div>
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────────────────── */
export default function MarketOverviewStrip() {
  const [data,    setData]    = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [source,  setSource]  = useState('live')
  const [lastAt,  setLastAt]  = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/overview')
      const j   = await res.json()
      if (j.data) { setData(j.data); setSource(j.source); setLastAt(Date.now()) }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(); const id = setInterval(fetchData, 30000); return () => clearInterval(id) }, [fetchData])

  const now  = new Date()
  const etStr = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  return (
    <div style={{ border: '1px solid #1b2e1b', background: 'var(--bg-terminal)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(90deg,#050a05,#071207)',
        borderBottom: '1px solid #1b2e1b', padding: '4px 10px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 700, color: 'var(--text-accent)', letterSpacing: '0.1em' }}>
          ▸ GLOBAL MARKET MONITOR
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {source === 'live' && (
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--text-positive)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-positive)', display: 'inline-block' }} />LIVE
            </span>
          )}
          <span suppressHydrationWarning style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--text-muted)' }}>{etStr} ET</span>
          <button onClick={fetchData} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, lineHeight: 1 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-accent)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>↻</button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '16px 12px', fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-accent)' }}>
          LOADING MARKET DATA<span className="blink-cursor" />
        </div>
      ) : !data ? (
        <div style={{ padding: '12px', fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)' }}>Market data unavailable</div>
      ) : (
        <>
          {/* Section A — 5 index cards */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #1b2e1b' }}>
            {data.indices.map((q, i) => (
              <div key={q.symbol} style={{ flex: 1, borderRight: i < data.indices.length - 1 ? '1px solid #1b2e1b' : 'none' }}>
                <IndexCard q={q} />
              </div>
            ))}
            {data.indices.length === 0 && (
              <div style={{ padding: '12px', fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)' }}>Index data loading...</div>
            )}
          </div>

          {/* Section B — Commodity + Bond strip */}
          {data.commodities.length > 0 && <CommodityStrip items={data.commodities} />}

          {/* Section C — Global market rows */}
          <div style={{ background: '#040904' }}>
            <GlobalMarketRow markets={data.globalMarkets} region="ASIA" label="ASIA" />
            <div style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none' }}>
              <GlobalMarketRow markets={data.globalMarkets} region="EUR" label="EUR" />
              <GlobalMarketRow markets={data.globalMarkets} region="AMER" label="AMER" />
            </div>
          </div>

          {/* Section D — Breadth */}
          <div style={{ borderTop: '1px solid #1b2e1b', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ borderRight: '1px solid #1b2e1b' }}>
              <BreadthBar breadth={data.breadth} />
            </div>
            <div style={{ padding: '6px 10px' }}>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.08em' }}>MARKET CLOCK</div>
              <MarketClock />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Market status clock (right half of Section D) ──────────────────────── */
function MarketClock() {
  const [status, setStatus] = useState('')
  const [time,   setTime]   = useState('')

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const etStr = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
      setTime(etStr + ' ET')
      const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
      const d = et.getDay(), h = et.getHours(), m = et.getMinutes()
      const t = h * 60 + m
      if (d === 0 || d === 6) { setStatus('CLOSED'); return }
      if (t >= 9 * 60 + 30 && t < 16 * 60) { setStatus('OPEN'); return }
      if (t >= 4 * 60 && t < 9 * 60 + 30) { setStatus('PRE-MARKET'); return }
      if (t >= 16 * 60 && t < 20 * 60) { setStatus('AFTER-HOURS'); return }
      setStatus('CLOSED')
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const statusColor: Record<string, string> = {
    'OPEN': 'var(--text-positive)', 'CLOSED': 'var(--text-negative)', 'PRE-MARKET': 'var(--text-warning)', 'AFTER-HOURS': 'var(--text-accent)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 14, fontWeight: 700, color: statusColor[status] || 'var(--text-muted)' }}>
        {status || '---'}
      </div>
      <div suppressHydrationWarning style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)' }}>{time}</div>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--text-muted)' }}>NYSE · NASDAQ · CME</div>
    </div>
  )
}
