'use client'
import { useEffect, useState, useCallback } from 'react'
import { toDataStatus } from '@/lib/dataStatus'
import { DataStatusBadge } from '@/components/ui/DataStatusBadge'
import { useMode } from '@/lib/context/ModeContext'
import { arrow, pct, signed } from '@/lib/format'
import { getIndianMarketStatus } from '@/lib/utils'
import { sharedFetch } from '@/lib/sharedFetch'

// India mode's breadth block: the NSE sectoral indices (all checked to return a
// quote via /api/stocks, Oct 2026). One that comes back empty reads "unavailable".
const NIFTY_SECTORS: [string, string][] = [
  ['^NSEBANK', 'Bank'], ['^CNXIT', 'IT'], ['^CNXPHARMA', 'Pharma'], ['^CNXAUTO', 'Auto'], ['^CNXFMCG', 'FMCG'],
  ['^CNXMETAL', 'Metal'], ['^CNXENERGY', 'Energy'], ['^CNXREALTY', 'Realty'], ['^CNXPSUBANK', 'PSU Bank'],
  ['^CNXMEDIA', 'Media'], ['^CNXINFRA', 'Infra'],
]
const SECTORS_URL = `/api/stocks?tickers=${encodeURIComponent(NIFTY_SECTORS.map(([s]) => s).join(','))}`

// The USA hero cards directly above this strip already carry S&P 500 and NASDAQ
// (priced off SPY/QQQ). Repeating them here as ^GSPC/^IXIC put two different
// numbers for the same index on screen inches apart. Section A drops them in
// USA mode and keeps only what the hero row doesn't have — Dow, VIX, Russell.
// India mode keeps all five: its hero row is Nifty/Sensex/Bank Nifty/VIX/USDINR,
// so the US indices here are the only global context on the page.
const HERO_DUPLICATES = new Set(['^GSPC', '^IXIC'])

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
      <polyline points={pts} fill="none" style={{ stroke: color, strokeWidth: 'var(--chart-line)' }} strokeLinejoin="round" strokeLinecap="round" />
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
  return pct(n, 2)
}

/* ── Types ─────────────────────────────────────────────────────────────── */
interface QuoteTick {
  symbol: string; label: string; price: number; change: number
  changePct: number; sparkline: number[]; unit?: string
  region?: string
  // Set only by the India-mode MCX overlay below. Absent → the USD default.
  currency?: string
}
interface Breadth { advancing: number; declining: number; unchanged: number }
interface OverviewData {
  indices: QuoteTick[]; commodities: QuoteTick[]
  globalMarkets: QuoteTick[]; breadth: Breadth; fetchedAt: number
}

/* ── Section A — 5 index cards ─────────────────────────────────────────── */
function IndexCard({ q }: { q: QuoteTick }) {
  const pos = q.changePct >= 0
  const cc  = pos ? 'var(--up)' : 'var(--down)'
  return (
    <div style={{
      flex: 1, background: 'var(--surface-2)', borderRadius: 'var(--radius-inner)',
      padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3, height: '100%',
    }}>
      <div className="gv-label">
        {q.label}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="gv-num" style={{ fontSize: 'var(--fs-display)', fontWeight: 'var(--fw-bold)', color: 'var(--text)', lineHeight: 1.1 }}>
            {fmtPrice(q.price, q.unit || '')}
          </div>
          <div className="gv-num" style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', color: cc, marginTop: 2 }}>
            {arrow(q.changePct)} {fmtPct(q.changePct)}
          </div>
          <div className="gv-num" style={{ fontSize: 'var(--fs-meta)', color: cc }}>
            {signed(q.change, 2)}
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
    // Wraps rather than scrolls, so no item is cut off at narrow widths / large text.
    <div style={{
      padding: '8px 16px', display: 'flex',
      alignItems: 'center', columnGap: 20, rowGap: 4, borderTop: 'var(--bw) solid var(--divider)',
      flexWrap: 'wrap',
    }}>
      {items.map(q => {
        const pos = q.changePct >= 0
        return (
          <span key={q.symbol} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <span style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-bold)', color: 'var(--accent-text)' }}>{q.label}</span>
            <span className="gv-num" style={{ fontSize: 'var(--fs-body)', color: 'var(--text)' }}>
              {q.unit === '%' ? '' : (q.currency ?? '$')}{fmtPrice(q.price, q.unit || '')}
              {q.unit && q.unit !== '%' && <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>{q.unit}</span>}
            </span>
            <span className="gv-num" style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', color: pos ? 'var(--up)' : 'var(--down)' }}>
              {arrow(q.changePct)}{fmtPct(q.changePct)}
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
    <div style={{ display: 'flex', alignItems: 'center', columnGap: 16, rowGap: 4, padding: '5px 16px', flexWrap: 'wrap' }}>
      <span className="gv-label" style={{ flexShrink: 0, minWidth: 36 }}>{label}</span>
      {filtered.map(q => {
        const pos = q.changePct >= 0
        return (
          <span key={q.symbol} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)' }}>{q.label}</span>
            <span className="gv-num" style={{ fontSize: 'var(--fs-body)', color: pos ? 'var(--up)' : 'var(--down)', fontWeight: 'var(--fw-semibold)' }}>
              {fmtPrice(q.price, '')} <span style={{ fontSize: 'var(--fs-meta)' }}>{arrow(q.changePct)}{fmtPct(q.changePct)}</span>
            </span>
          </span>
        )
      })}
    </div>
  )
}

/* ── Section D — breadth bar ────────────────────────────────────────────── */
function BreadthBar({ breadth }: { breadth: Breadth }) {
  const total   = breadth.advancing + breadth.declining + breadth.unchanged || 1
  const advPct  = (breadth.advancing / total) * 100
  const decPct  = (breadth.declining / total) * 100
  const unchPct = (breadth.unchanged / total) * 100
  return (
    <div style={{ padding: '10px 16px' }}>
      <div className="gv-label" style={{ marginBottom: 6 }}>S&P 500 SECTORS — {breadth.advancing + breadth.declining + breadth.unchanged} SPDR ETFs</div>
      {/* Stacked bar */}
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
        <div style={{ width: `${advPct}%`, background: 'var(--up)' }} />
        <div style={{ width: `${unchPct}%`, background: 'var(--muted)' }} />
        <div style={{ width: `${decPct}%`, background: 'var(--down)' }} />
      </div>
      <div className="gv-num" style={{ display: 'flex', gap: 12 }}>
        <span style={{ fontSize: 'var(--fs-body)' }}>
          <span style={{ color: 'var(--up)', fontWeight: 'var(--fw-bold)' }}>▲ {breadth.advancing}</span>
          <span style={{ color: 'var(--text-muted)', marginLeft: 2 }}>ADV</span>
        </span>
        <span style={{ fontSize: 'var(--fs-body)' }}>
          <span style={{ color: 'var(--down)', fontWeight: 'var(--fw-bold)' }}>▼ {breadth.declining}</span>
          <span style={{ color: 'var(--text-muted)', marginLeft: 2 }}>DEC</span>
        </span>
        <span style={{ fontSize: 'var(--fs-body)' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 'var(--fw-bold)' }}>{breadth.unchanged}</span>
          <span style={{ color: 'var(--text-muted)', marginLeft: 2 }}>UNCH</span>
        </span>
      </div>
    </div>
  )
}

/* ── Section D (India) — Nifty sectoral indices ─────────────────────────── */
function IndiaSectors({ sectors }: { sectors: Record<string, number> | null }) {
  const rows = NIFTY_SECTORS.map(([sym, name]) => ({ name, chg: sectors?.[sym] }))
  const have = rows.filter(r => r.chg !== undefined) as { name: string; chg: number }[]
  const adv = have.filter(r => r.chg > 0).length, dec = have.filter(r => r.chg < 0).length
  const unch = have.length - adv - dec, total = have.length || 1
  return (
    <div style={{ padding: '10px 16px' }}>
      <div className="gv-label" style={{ marginBottom: 6 }}>NIFTY SECTORS — {NIFTY_SECTORS.length} NSE SECTORAL INDICES</div>
      {sectors === null ? (
        <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>Loading sector indices…</div>
      ) : (
        <>
          <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 6, background: 'var(--divider)' }}>
            <div style={{ width: `${(adv / total) * 100}%`, background: 'var(--up)' }} />
            <div style={{ width: `${(unch / total) * 100}%`, background: 'var(--muted)' }} />
            <div style={{ width: `${(dec / total) * 100}%`, background: 'var(--down)' }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 14, rowGap: 2, fontSize: 'var(--fs-meta)' }}>
            {rows.map(r => (
              <span key={r.name} style={{ whiteSpace: 'nowrap' }}>
                <span style={{ color: 'var(--text-2)' }}>{r.name} </span>
                {r.chg === undefined
                  ? <span style={{ color: 'var(--text-muted)' }}>unavailable</span>
                  : <span className="gv-num" style={{ fontWeight: 'var(--fw-semibold)', color: r.chg > 0 ? 'var(--up)' : r.chg < 0 ? 'var(--down)' : 'var(--text-muted)' }}>{arrow(r.chg)}{pct(r.chg, 2)}</span>}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────────────────── */
export default function MarketOverviewStrip() {
  const { isIndia } = useMode()
  const [data,    setData]    = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [source,  setSource]  = useState<string | undefined>()
  const [lastAt,  setLastAt]  = useState<number | null>(null)
  // India-mode MCX overlay, keyed by the Yahoo ticker the overview route uses.
  const [mcx, setMcx] = useState<Record<string, { price: number; unit: string }>>({})
  // The USD/INR rate /api/india/commodities converted with — reused for Brent (no MCX contract) so every ₹ figure uses one rate.
  const [usdInr, setUsdInr] = useState<number | null>(null)
  // India mode: sector index → change %, null until the first answer.
  const [sectors, setSectors] = useState<Record<string, number> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/overview')
      const j   = await res.json()
      if (j.data) { setData(j.data); setSource(j.source); setLastAt(Date.now()) }
    } catch { /* silent */ }
    finally { setLoading(false) }
    // Rides the same 60 s refresh (no extra interval); India mode only.
    if (isIndia) {
      try {
        const j = await (await sharedFetch(SECTORS_URL)).json()
        setSectors(Object.fromEntries((j.data ?? [])
          .filter((q: { regularMarketChangePercent?: number }) => Number.isFinite(q.regularMarketChangePercent))
          .map((q: { symbol: string; regularMarketChangePercent: number }) => [q.symbol, q.regularMarketChangePercent])))
      } catch { setSectors(s => s ?? {}) }
    }
  }, [isIndia])

  useEffect(() => { fetchData(); const id = setInterval(fetchData, 60000); return () => clearInterval(id) }, [fetchData])

  // Gold/silver/crude/gas/copper are quoted globally in USD, but an Indian user
  // trades them on MCX, where they're quoted in INR per MCX's own units
  // (₹/10g, ₹/kg, ₹/bbl) — not as a naive USD→INR multiply of the spot price.
  // /api/india/commodities already does exactly that conversion for the
  // COMMODITIES page, so India mode reuses it here rather than growing a second
  // conversion path. Brent has no MCX contract and stays USD; the two treasury
  // yields are percentages and never get a currency symbol in either mode.
  useEffect(() => {
    if (!isIndia) { setMcx({}); setUsdInr(null); return }
    const loadMcx = async () => {
      try {
        const res = await fetch('/api/india/commodities')
        const j   = await res.json()
        const rows: any[] = j.data?.commodities ?? []
        setUsdInr(Number.isFinite(j.data?.usdInr) ? j.data.usdInr : null)
        setMcx(Object.fromEntries(
          rows
            .filter(c => c?.ticker && Number.isFinite(c.priceINR))
            // The API's unit already carries the ₹; strip it so the symbol is
            // rendered once, before the number, like the USD path.
            .map(c => [c.ticker, { price: c.priceINR, unit: String(c.unit ?? '').replace('₹', '') }])
        ))
      } catch { /* leave mcx empty — the strip falls back to USD spot */ }
    }
    loadMcx()
    const id = setInterval(loadMcx, 60000)
    return () => clearInterval(id)
  }, [isIndia])

  const commodities: QuoteTick[] = (data?.commodities ?? []).map(q => {
    if (!isIndia || q.unit === '%') return q
    const m = mcx[q.symbol]
    // COMEX/NYMEX × USD/INR — not an MCX quote (MCX adds import duty). The ₹ is shown once, before the price.
    if (m) return { ...q, price: m.price, unit: m.unit, currency: '₹' }
    // No MCX contract (Brent): same rate and same per-unit basis as the converted WTI row.
    if (usdInr) return { ...q, price: q.price * usdInr, currency: '₹' }
    return q
  })

  const indices = (data?.indices ?? []).filter(q => isIndia || !HERO_DUPLICATES.has(q.symbol))

  return (
    <div className="gv-card">
      {/* Header */}
      <div className="gv-card-head">
        <span>Global market monitor</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {toDataStatus(source) && <DataStatusBadge status={toDataStatus(source)!} source="Yahoo Finance" asOf={data?.fetchedAt} />}
          {/* The ET clock that used to sit here is the same time the MARKET
              CLOCK panel shows in Section D, and the TopBar carries the
              OPEN/CLOSED badge. Three copies of one clock, so this one goes. */}
          <button type="button" onClick={fetchData} aria-label="Refresh" title="Refresh" className="gv-icon-btn">↻</button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 16, fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>
          Loading market data<span className="blink-cursor" />
        </div>
      ) : !data ? (
        <div style={{ padding: 16, fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>Market data unavailable</div>
      ) : (
        <>
          {/* Section A — index cards the hero row doesn't already show */}
          <div style={{ display: 'flex', gap: 10, padding: '12px 16px' }}>
            {indices.map(q => (
              <div key={q.symbol} style={{ flex: 1, minWidth: 0 }}>
                <IndexCard q={q} />
              </div>
            ))}
            {indices.length === 0 && (
              <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>Index data temporarily unavailable</div>
            )}
          </div>

          {/* Section B — Commodity + Bond strip */}
          {commodities.length > 0 && <CommodityStrip items={commodities} />}

          {/* Section C — Global market rows */}
          {/* One row per region, each wrapping (a shared scrolling row clipped items mid-glyph). */}
          <div style={{ borderTop: 'var(--bw) solid var(--divider)', padding: '3px 0' }}>
            <GlobalMarketRow markets={data.globalMarkets} region="ASIA" label="ASIA" />
            <GlobalMarketRow markets={data.globalMarkets} region="EUR" label="EUR" />
            <GlobalMarketRow markets={data.globalMarkets} region="AMER" label="AMER" />
          </div>

          {/* Section D — Breadth (India: Nifty sectoral indices) */}
          <div style={{ borderTop: 'var(--bw) solid var(--divider)', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ borderRight: 'var(--bw) solid var(--divider)' }}>
              {isIndia ? <IndiaSectors sectors={sectors} /> : <BreadthBar breadth={data.breadth} />}
            </div>
            <div style={{ padding: '10px 16px' }}>
              <div className="gv-label" style={{ marginBottom: 6 }}>MARKET CLOCK</div>
              <MarketClock isIndia={isIndia} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Market status clock (right half of Section D) ──────────────────────── */
function MarketClock({ isIndia }: { isIndia: boolean }) {
  const [status, setStatus] = useState('')
  const [time,   setTime]   = useState('')

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      if (isIndia) {
        setTime(now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' IST')
        setStatus(getIndianMarketStatus())
        return
      }
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
  }, [isIndia])

  const statusColor: Record<string, string> = {
    'OPEN': 'var(--up)', 'CLOSED': 'var(--down)', 'PRE-MARKET': 'var(--warning)', 'PRE-OPEN': 'var(--warning)', 'AFTER-HOURS': 'var(--accent-text)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: statusColor[status] || 'var(--text-muted)' }}>
        {status ? `${isIndia ? 'NSE ' : ''}${status}` : '---'}
      </div>
      <div suppressHydrationWarning className="gv-num" style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>{time}</div>
      <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>{isIndia ? 'NSE · BSE · MCX' : 'NYSE · NASDAQ · CME'}</div>
    </div>
  )
}
