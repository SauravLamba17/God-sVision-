'use client'
import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { Sparkline } from '@/components/ui/Sparkline'
import { useMode } from '@/lib/context/ModeContext'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import TickerLink from '@/components/ui/TickerLink'

const MarketOverviewStrip = dynamic(() => import('@/components/panels/MarketOverviewStrip'), { ssr: false })
const CryptoPanel         = dynamic(() => import('@/components/panels/CryptoPanel'),         { ssr: false })
const NewsPanel           = dynamic(() => import('@/components/panels/NewsPanel'),           { ssr: false })
const EarthquakePanel     = dynamic(() => import('@/components/panels/EarthquakePanel'),     { ssr: false })
const WeatherPanel        = dynamic(() => import('@/components/panels/WeatherPanel'),        { ssr: false })
const DailyBrief          = dynamic(() => import('@/components/terminal/DailyBrief'),        { ssr: false })
const FearRadar           = dynamic(() => import('@/components/panels/FearRadar'),           { ssr: false })
const NarrativeDetector   = dynamic(() => import('@/components/panels/NarrativeDetector'),   { ssr: false })
const RedditSentiment     = dynamic(() => import('@/components/panels/RedditSentiment'),     { ssr: false })
const ISSTracker          = dynamic(() => import('@/components/panels/ISSTracker'),          { ssr: false })
const RBIPolicyTracker    = dynamic(() => import('@/components/panels/RBIPolicyTracker'),    { ssr: false })
const FIIDIIFlow          = dynamic(() => import('@/components/panels/FIIDIIFlow'),          { ssr: false })
const NiftyHeatmap        = dynamic(() => import('@/components/panels/NiftyHeatmap'),        { ssr: false })
const AnalystPanel        = dynamic(() => import('@/components/panels/AnalystPanel'),         { ssr: false })

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Metric {
  label: string; symbol: string; price: number; change: number; changePct: number
  sparkline: number[]; accent: string; unit?: string
}
interface MoverRow {
  symbol: string; shortName?: string; regularMarketPrice: number
  regularMarketChange: number; regularMarketChangePercent: number; regularMarketVolume: number
}

/* ── Default metric cards ─────────────────────────────────────────────── */
const DEFAULT_METRICS: Metric[] = [
  { label: 'S&P 500',   symbol: 'SPY',      price: 543.27,  change: 2.14,   changePct: 0.39,  sparkline: [], accent: 'var(--text-accent)' },
  { label: 'NASDAQ',    symbol: 'QQQ',      price: 466.18,  change: 3.22,   changePct: 0.69,  sparkline: [], accent: '#a78bfa' },
  { label: 'BITCOIN',   symbol: 'BTC',      price: 67234.5, change: 892.3,  changePct: 1.34,  sparkline: [], accent: 'var(--text-warning)' },
  { label: 'GOLD',      symbol: 'GLD',      price: 232.41,  change: -0.87,  changePct: -0.37, sparkline: [], accent: '#fde68a' },
  { label: 'USD INDEX', symbol: 'DX-Y.NYB', price: 104.22,  change: -0.12,  changePct: -0.11, sparkline: [], accent: '#34d399' },
]

const DEFAULT_INDIA_METRICS: Metric[] = [
  { label: 'NIFTY 50',   symbol: '^NSEI',    price: 24000,  change: 120,  changePct: 0.5,  sparkline: [], accent: '#FF9933' },
  { label: 'SENSEX',     symbol: '^BSESN',   price: 79000,  change: 400,  changePct: 0.5,  sparkline: [], accent: '#138808' },
  { label: 'BANK NIFTY', symbol: '^NSEBANK', price: 52000,  change: 200,  changePct: 0.4,  sparkline: [], accent: 'var(--text-warning)' },
  { label: 'INDIA VIX',  symbol: '^INDIAVIX',price: 14.5,   change: -0.5, changePct: -3.3, sparkline: [], accent: 'var(--text-negative)' },
  { label: 'USD/INR',    symbol: 'USDINR=X', price: 83.50,  change: 0.15, changePct: 0.18, sparkline: [], accent: '#34d399' },
]

const TICKER_TAPE_SYMBOLS = [
  'SPY','QQQ','DIA','IWM','AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','JPM',
  'GLD','TLT','USO','GBP=X','EUR=X','JPY=X','BTC-USD','ETH-USD','SOL-USD','DOGE-USD',
]

// Yahoo Finance ticker used for the hero card's intraday sparkline — kept
// separate from m.symbol since some cards price off an ETF/spot pair but
// chart off the underlying index/future (e.g. GLD price, GC=F sparkline).
const SPARKLINE_SYMBOL_MAP: Record<string, string> = {
  'S&P 500':   '^GSPC',
  'NASDAQ':    '^IXIC',
  'BITCOIN':   'BTC-USD',
  'GOLD':      'GC=F',
  'USD INDEX': 'DX-Y.NYB',
  'NIFTY 50':   '^NSEI',
  'SENSEX':     '^BSESN',
  'BANK NIFTY': '^NSEBANK',
  'INDIA VIX':  '^INDIAVIX',
}

/* ── Metric card ──────────────────────────────────────────────────────── */
function MetricCard({ m, isIndia }: { m: Metric; isIndia?: boolean }) {
  const isPos = m.changePct >= 0
  const cc = isPos ? 'var(--text-positive)' : 'var(--text-negative)'
  // Currency symbol is driven ONLY by the explicit isIndia prop passed at the
  // render site (USA cards never pass isIndia → always '$'). The 5 USA hero
  // cards — S&P 500, NASDAQ, Bitcoin, Gold, USD Index — are always
  // USD-denominated, so '$' is hardcoded here rather than routed through a
  // shared/dynamic formatter that could ever resolve to '₹'.
  const sym = isIndia ? '₹' : '$'
  const displayPrice = (() => {
    if (isIndia && m.price > 1000) {
      if (m.price >= 1_000_000) return '₹' + (m.price / 100_000).toFixed(0) + ' L'
      return '₹' + m.price.toFixed(2)
    }
    if (m.price >= 10000) return sym + m.price.toFixed(0)
    if (m.price >= 1) return sym + m.price.toFixed(2)
    return sym + m.price.toFixed(4)
  })()
  return (
    <div style={{ border: '1px solid var(--border-color)', borderTop: `2px solid ${m.accent}`, background: 'var(--bg-panel)', padding: '10px 14px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: `radial-gradient(ellipse at top right, ${m.accent}0a 0%, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: m.accent, letterSpacing: '0.1em', marginBottom: 6 }}>{m.label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
            {displayPrice}
          </div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: cc, marginTop: 3 }}>
            {isPos ? '▲ +' : '▼ '}{m.price >= 1 ? m.change.toFixed(2) : m.change.toFixed(4)} ({isPos ? '+' : ''}{m.changePct.toFixed(2)}%)
          </div>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <Sparkline symbol={SPARKLINE_SYMBOL_MAP[m.label] ?? m.symbol} isPositive={isPos} width={80} height={36} />
        </div>
      </div>
    </div>
  )
}

/* ── Market Movers (three-tab) ─────────────────────────────────────────── */
type MoverTab = 'gainers' | 'losers' | 'active'

function formatVol(n: number, isIndia = false): string {
  if (!n) return 'N/A'
  if (isIndia) {
    if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)} Cr`
    if (n >= 100_000)    return `${(n / 100_000).toFixed(1)} L`
    if (n >= 1_000)      return `${(n / 1_000).toFixed(0)}K`
    return String(n)
  }
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return String(n)
}

/* ── India Market Movers ─────────────────────────────────────────────────── */
function IndiaMarketMovers() {
  const [tab,     setTab]     = useState<MoverTab>('gainers')
  const [gainers, setGainers] = useState<MoverRow[]>([])
  const [losers,  setLosers]  = useState<MoverRow[]>([])
  const [active,  setActive]  = useState<MoverRow[]>([])
  const [loading, setLoading] = useState(true)
  const [lastAt,  setLastAt]  = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res  = await fetch('/api/india/stocks/movers')
      const json = await res.json()
      if (json.data) {
        setGainers(json.data.gainers || [])
        setLosers(json.data.losers || [])
        setActive(json.data.active || [])
        setLastAt(new Date())
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(); const id = setInterval(fetchData, 30000); return () => clearInterval(id) }, [fetchData])

  const rows = tab === 'gainers' ? gainers : tab === 'losers' ? losers : active

  const tabStyle = (t: MoverTab) => ({
    fontFamily: 'IBM Plex Mono', fontSize: 9, padding: '3px 10px', cursor: 'pointer',
    background:  tab === t ? 'rgba(255,153,51,0.12)' : 'transparent',
    color:       tab === t ? '#FF9933' : 'var(--text-muted)',
    border: '1px solid',
    borderColor: tab === t ? '#FF993340' : 'var(--border-color)',
    borderRadius: 2,
  } as React.CSSProperties)

  const displaySymbol = (sym: string) => sym.replace('.NS', '').replace('.BO', '')

  return (
    <div style={{ border: '1px solid var(--border-color)', borderLeft: '2px solid #FF9933', background: 'var(--bg-panel)', overflow: 'hidden' }}>
      <div style={{ background: 'var(--bg-header)', borderBottom: '1px solid var(--border-color)', padding: '5px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, fontWeight: 600, color: '#FF9933', letterSpacing: '0.08em' }}>NIFTY MOVERS</span>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, padding: '1px 5px', background: 'rgba(255,153,51,0.12)', color: '#FF9933', borderRadius: 2 }}>NSE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {lastAt && <span suppressHydrationWarning style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--text-muted)' }}>{lastAt.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} IST</span>}
          <button onClick={fetchData} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FF9933')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>↻</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, padding: '5px 8px', borderBottom: '1px solid var(--border-color)' }}>
        <button style={tabStyle('gainers')} onClick={() => setTab('gainers')}>▲ TOP GAINERS</button>
        <button style={tabStyle('losers')}  onClick={() => setTab('losers')}>▼ TOP LOSERS</button>
        <button style={tabStyle('active')}  onClick={() => setTab('active')}>⚡ MOST ACTIVE</button>
      </div>
      {loading ? (
        <div style={{ padding: '12px 10px', fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#FF9933' }}>LOADING<span className="blink-cursor" /></div>
      ) : rows.length === 0 ? (
        <div style={{ padding: '12px 10px', fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)' }}>No data — NSE market may be closed</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              {['NSE', 'COMPANY', '₹ PRICE', 'CHG%', 'VOL'].map(h => (
                <th key={h} style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--text-muted)', padding: '3px 6px', textAlign: h === 'NSE' || h === 'COMPANY' ? 'left' : 'right', fontWeight: 400, letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 10).map((q, i) => {
              const pos = q.regularMarketChangePercent >= 0
              const cc  = pos ? 'var(--text-positive)' : 'var(--text-negative)'
              return (
                <tr key={q.symbol + i} style={{ borderBottom: '1px solid #0d1a0d', cursor: 'pointer' }}
                  onClick={() => window.location.href = `/markets?ticker=${q.symbol}`}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-buy)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 700, color: '#FF9933', padding: '3px 6px', width: 70 }}><TickerLink ticker={q.symbol} style={{ color: '#FF9933' }}>{displaySymbol(q.symbol)}</TickerLink></td>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)', padding: '3px 6px', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.shortName?.slice(0, 16) || '—'}</td>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-primary)', padding: '3px 6px', textAlign: 'right' }}>₹{q.regularMarketPrice?.toFixed(2)}</td>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 700, color: cc, padding: '3px 6px', textAlign: 'right' }}>{formatPercent(q.regularMarketChangePercent)}</td>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)', padding: '3px 6px', textAlign: 'right' }}>{formatVol(q.regularMarketVolume, true)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function MarketMovers() {
  const [tab,      setTab]      = useState<MoverTab>('gainers')
  const [gainers,  setGainers]  = useState<MoverRow[]>([])
  const [losers,   setLosers]   = useState<MoverRow[]>([])
  const [active,   setActive]   = useState<MoverRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [lastAt,   setLastAt]   = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res  = await fetch('/api/stocks?type=movers')
      const json = await res.json()
      if (json.data) {
        setGainers(json.data.gainers || [])
        setLosers(json.data.losers   || [])
        // Sort gainers by volume for the "most active" tab
        const byVol = [...(json.data.gainers || []), ...(json.data.losers || [])]
          .sort((a, b) => (b.regularMarketVolume || 0) - (a.regularMarketVolume || 0))
          .slice(0, 10)
        setActive(byVol)
        setLastAt(new Date())
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(); const id = setInterval(fetchData, 30000); return () => clearInterval(id) }, [fetchData])

  const rows = tab === 'gainers' ? gainers : tab === 'losers' ? losers : active
  const isOpen = (() => {
    const now = new Date()
    const et  = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const d = et.getDay(), h = et.getHours(), m = et.getMinutes(), t = h * 60 + m
    if (d === 0 || d === 6) return false
    return t >= 570 && t < 960
  })()

  const tabStyle = (t: MoverTab) => ({
    fontFamily: 'IBM Plex Mono', fontSize: 9, padding: '3px 10px', cursor: 'pointer',
    background:   tab === t ? 'rgba(255,109,0,0.12)' : 'transparent',
    color:        tab === t ? 'var(--text-accent)' : 'var(--text-muted)',
    border:       '1px solid',
    borderColor:  tab === t ? 'rgba(255,109,0,0.25)' : 'var(--border-color)',
    borderRadius: 2,
  } as React.CSSProperties)

  return (
    <div style={{ border: '1px solid #1e293b', borderLeft: '2px solid #22c55e', background: 'var(--bg-panel)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-header)', borderBottom: '1px solid var(--border-color)', padding: '5px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, fontWeight: 600, color: 'var(--text-positive)', letterSpacing: '0.08em' }}>MARKET MOVERS</span>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, padding: '1px 5px', background: isOpen ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: isOpen ? 'var(--text-positive)' : 'var(--text-negative)', borderRadius: 2 }}>
            {isOpen ? '● OPEN' : '● CLOSED'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {lastAt && <span suppressHydrationWarning style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--text-muted)' }}>{lastAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>}
          <button onClick={fetchData} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-positive)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>↻</button>
        </div>
      </div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '5px 8px', borderBottom: '1px solid var(--border-color)' }}>
        <button style={tabStyle('gainers')} onClick={() => setTab('gainers')}>▲ TOP GAINERS</button>
        <button style={tabStyle('losers')}  onClick={() => setTab('losers')}>▼ TOP LOSERS</button>
        <button style={tabStyle('active')}  onClick={() => setTab('active')}>⚡ MOST ACTIVE</button>
      </div>
      {/* Table */}
      {loading ? (
        <div style={{ padding: '12px 10px', fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-positive)' }}>LOADING<span className="blink-cursor" /></div>
      ) : rows.length === 0 ? (
        <div style={{ padding: '12px 10px', fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)' }}>No data — market may be closed</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              {['TICKER', 'COMPANY', 'PRICE', 'CHG%', 'VOL'].map(h => (
                <th key={h} style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--text-muted)', padding: '3px 6px', textAlign: h === 'TICKER' || h === 'COMPANY' ? 'left' : 'right', fontWeight: 400, letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 10).map((q, i) => {
              const pos = q.regularMarketChangePercent >= 0
              const cc  = pos ? 'var(--text-positive)' : 'var(--text-negative)'
              return (
                <tr key={q.symbol + i} style={{ borderBottom: '1px solid #0d1a0d', cursor: 'pointer' }}
                  onClick={() => window.location.href = `/markets?ticker=${q.symbol}`}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-buy)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 700, color: 'var(--text-accent)', padding: '3px 6px', width: 60 }}>{q.symbol}</td>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)', padding: '3px 6px', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.shortName?.slice(0, 16) || '—'}</td>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-primary)', padding: '3px 6px', textAlign: 'right' }}>{formatCurrency(q.regularMarketPrice)}</td>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 700, color: cc, padding: '3px 6px', textAlign: 'right' }}>{formatPercent(q.regularMarketChangePercent)}</td>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)', padding: '3px 6px', textAlign: 'right' }}>{formatVol(q.regularMarketVolume)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

/* ── Ticker Tape ───────────────────────────────────────────────────────── */
function TickerTape({ prices }: { prices: Record<string, { price: number; changePct: number }> }) {
  const items = TICKER_TAPE_SYMBOLS.filter(s => prices[s])
  if (items.length === 0) return null
  const doubled = [...items, ...items]
  return (
    <div style={{ overflow: 'hidden', borderTop: '1px solid var(--border-color)', background: 'var(--bg-terminal)', height: 24 }}>
      <div style={{ display: 'flex', animation: 'tickerScroll 60s linear infinite', whiteSpace: 'nowrap' }}>
        {doubled.map((sym, i) => {
          const p = prices[sym]
          const isPos = (p?.changePct ?? 0) >= 0
          return (
            <span key={i} style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 14px', height: 24, lineHeight: '24px', borderRight: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-accent)', fontWeight: 700 }}>{sym.replace('-USD', '').replace('=X', '')}</span>
              <span style={{ color: 'var(--text-primary)' }}>${p?.price >= 1 ? p.price.toFixed(2) : p?.price.toFixed(4)}</span>
              <span style={{ color: isPos ? 'var(--text-positive)' : 'var(--text-negative)' }}>{isPos ? '▲' : '▼'}{Math.abs(p?.changePct ?? 0).toFixed(2)}%</span>
            </span>
          )
        })}
      </div>
      <style>{`@keyframes tickerScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
    </div>
  )
}

/* ── India Crypto Mini Panel ────────────────────────────────────────────── */
function IndiaCryptoMini() {
  const [coins, setCoins] = useState<Array<{ id: string; symbol: string; priceINR: number; change24h: number; isIndianProject?: boolean }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/india/crypto')
        const j   = await res.json()
        if (j.data?.coins) setCoins(j.data.coins.slice(0, 10))
      } finally { setLoading(false) }
    }
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [])

  const fmtINR = (n: number) => {
    if (n >= 10_000_000) return '₹' + (n / 10_000_000).toFixed(2) + ' Cr'
    if (n >= 100_000)    return '₹' + (n / 100_000).toFixed(2) + ' L'
    if (n >= 1_000)      return '₹' + (n / 1_000).toFixed(2) + 'K'
    return '₹' + n.toFixed(2)
  }

  return (
    <div style={{ border: '1px solid #1e293b', borderLeft: '2px solid #FF9933', background: 'var(--bg-panel)', overflow: 'hidden' }}>
      <div style={{ padding: '5px 10px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-header)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, fontWeight: 600, color: '#FF9933', letterSpacing: '0.08em' }}>₿ CRYPTO / INR</span>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--text-muted)' }}>CoinGecko · INR</span>
      </div>
      {loading ? (
        <div style={{ padding: '12px 10px', fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#FF9933' }}>LOADING<span className="blink-cursor" /></div>
      ) : (
        <>
          <div style={{ padding: '4px 8px', fontSize: 7, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)', borderBottom: '1px solid #0d1a0d' }}>
            30% flat tax + 1% TDS on gains · India Crypto Tax
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {['COIN', 'PRICE (INR)', '24H %'].map(h => (
                  <th key={h} style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--text-muted)', padding: '3px 6px', textAlign: h === 'COIN' ? 'left' : 'right', fontWeight: 400, letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coins.map(c => {
                const pos = c.change24h >= 0
                const cc  = pos ? 'var(--text-positive)' : 'var(--text-negative)'
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #0d1a0d' }}>
                    <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 700, color: '#FF9933', padding: '3px 6px' }}>
                      {c.symbol}
                      {c.isIndianProject && <span style={{ fontSize: 7, marginLeft: 4, color: '#FF9933', background: '#FF993320', padding: '0 3px', borderRadius: 2 }}>🇮🇳</span>}
                    </td>
                    <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-primary)', padding: '3px 6px', textAlign: 'right' }}>{fmtINR(c.priceINR)}</td>
                    <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 700, color: cc, padding: '3px 6px', textAlign: 'right' }}>{formatPercent(c.change24h)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ padding: '5px 8px', borderTop: '1px solid #0d1a0d', display: 'flex', gap: 8 }}>
            {['WazirX', 'CoinDCX', 'ZebPay'].map(ex => (
              <span key={ex} style={{ fontFamily: 'IBM Plex Mono', fontSize: 7, color: 'var(--text-muted)', background: 'var(--bg-header)', padding: '1px 5px', borderRadius: 2 }}>{ex}</span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ── India News Mini Panel ───────────────────────────────────────────────── */
function IndiaNewsMini({ limit = 8 }: { limit?: number }) {
  const [articles, setArticles] = useState<Array<{ title: string; source: string; url: string; publishedAt: string }>>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/india/news')
        const j   = await res.json()
        if (j.data?.articles) setArticles(j.data.articles.slice(0, limit))
      } finally { setLoading(false) }
    }
    load()
    const id = setInterval(load, 300_000)
    return () => clearInterval(id)
  }, [limit])

  if (loading) return <div style={{ padding: 12, fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#FF9933' }}>LOADING INDIA NEWS...</div>

  return (
    <div style={{ border: '1px solid #1e293b', borderLeft: '2px solid #FF9933', background: 'var(--bg-panel)', overflow: 'hidden' }}>
      <div style={{ padding: '5px 10px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-header)' }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, fontWeight: 600, color: '#FF9933', letterSpacing: '0.08em' }}>📡 INDIA MARKETS NEWS</span>
      </div>
      <div style={{ overflowY: 'auto', maxHeight: 320 }}>
        {articles.map((a, i) => (
          <div key={i} style={{ padding: '6px 10px', borderBottom: '1px solid #0d1526', cursor: 'pointer' }}
            onClick={() => window.open(a.url, '_blank')}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-buy)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{a.title}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 7, color: '#FF9933' }}>{a.source}</span>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 7, color: 'var(--text-muted)' }}>{new Date(a.publishedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

function PanelSkeleton({ h = 200 }: { h?: number }) {
  const rows = [100, 100, 70, 100, 85]
  return (
    <div style={{ height: h, padding: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-panel)' }}>
      {rows.map((w, i) => (
        <div key={i} className={'skeleton'} style={{ height: '24px', marginBottom: '6px', width: w + '%' }} />
      ))}
    </div>
  )
}

/* ── Dashboard page ────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { isIndia } = useMode()
  const [metrics,    setMetrics]    = useState<Metric[]>(DEFAULT_METRICS)
  const [tapePrices, setTapePrices] = useState<Record<string, { price: number; changePct: number }>>({})
  const [phase,      setPhase]      = useState(0)

  const [tempUnit, setTempUnit] = useState<'C' | 'F'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('gv_dash_temp_unit') as 'C' | 'F') ?? 'C'
    }
    return 'C'
  })
  const handleTempUnitChange = (u: 'C' | 'F') => {
    setTempUnit(u)
    try { localStorage.setItem('gv_dash_temp_unit', u) } catch { /* ignore */ }
  }

  // Stagger panel mounting to avoid simultaneous API calls on load
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 500)
    const t2 = setTimeout(() => setPhase(2), 1000)
    const t3 = setTimeout(() => setPhase(3), 1500)
    const t4 = setTimeout(() => setPhase(4), 2000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [])

  // Fetch USA metrics
  useEffect(() => {
    if (isIndia) return
    const fetchAll = async () => {
      try {
        const [stockRes, cryptoRes] = await Promise.allSettled([
          fetch(`/api/stocks?tickers=${['SPY','QQQ','GLD','DX-Y.NYB'].join(',')}`),
          fetch('/api/crypto?type=top100'),
        ])
        const updated = [...DEFAULT_METRICS]
        const newTape: Record<string, { price: number; changePct: number }> = {}

        if (stockRes.status === 'fulfilled') {
          const j = await stockRes.value.json()
          const data: any[] = j.data || []
          const update = (symbol: string, idx: number) => {
            const q = data.find((q: any) => q.symbol === symbol)
            if (q) {
              updated[idx] = { ...updated[idx], price: q.regularMarketPrice, change: q.regularMarketChange, changePct: q.regularMarketChangePercent }
              newTape[symbol] = { price: q.regularMarketPrice, changePct: q.regularMarketChangePercent }
            }
          }
          update('SPY', 0); update('QQQ', 1); update('GLD', 3); update('DX-Y.NYB', 4)
        }
        if (cryptoRes.status === 'fulfilled') {
          const j = await cryptoRes.value.json()
          const btc = j.data?.find((c: any) => c.symbol === 'btc')
          const eth = j.data?.find((c: any) => c.symbol === 'eth')
          const sol = j.data?.find((c: any) => c.symbol === 'sol')
          if (btc) {
            updated[2] = { ...updated[2], price: btc.current_price, change: btc.price_change_24h, changePct: btc.price_change_percentage_24h, sparkline: btc.sparkline_in_7d?.price?.slice(-20) || [] }
            newTape['BTC-USD'] = { price: btc.current_price, changePct: btc.price_change_percentage_24h }
          }
          if (eth) newTape['ETH-USD'] = { price: eth.current_price, changePct: eth.price_change_percentage_24h }
          if (sol) newTape['SOL-USD'] = { price: sol.current_price, changePct: sol.price_change_percentage_24h }
        }
        setMetrics(updated)
        setTapePrices(newTape)
      } catch {}
    }
    fetchAll()
    const id = setInterval(fetchAll, 30000)
    return () => clearInterval(id)
  }, [isIndia])

  // Fetch India metrics
  useEffect(() => {
    if (!isIndia) return
    const fetchIndia = async () => {
      try {
        const [idxRes, fxRes] = await Promise.allSettled([
          fetch('/api/india/indices'),
          fetch('/api/india/forex'),
        ])

        let idxMap: Record<string, any> = {}
        if (idxRes.status === 'fulfilled') {
          const j = await idxRes.value.json()
          if (j.data?.indices?.length) {
            for (const idx of j.data.indices) idxMap[idx.symbol || idx.ticker] = idx
          }
        }
        if (!Object.keys(idxMap).length) return

        let usdInr = { price: 83.50, change: 0.12, changePct: 0.14 }
        if (fxRes.status === 'fulfilled') {
          const j = await fxRes.value.json()
          const pair = j.data?.pairs?.find((p: any) => p.ticker === 'USDINR=X')
          if (pair?.price) usdInr = { price: pair.price, change: pair.change, changePct: pair.changePct }
        }

        const updated: Metric[] = [
          { label: 'NIFTY 50',   symbol: '^NSEI',     price: idxMap['^NSEI']?.price     ?? 24000, change: idxMap['^NSEI']?.change     ?? 0, changePct: idxMap['^NSEI']?.changePct     ?? 0, sparkline: idxMap['^NSEI']?.sparkline     ?? [], accent: '#FF9933' },
          { label: 'SENSEX',     symbol: '^BSESN',    price: idxMap['^BSESN']?.price    ?? 79000, change: idxMap['^BSESN']?.change    ?? 0, changePct: idxMap['^BSESN']?.changePct    ?? 0, sparkline: idxMap['^BSESN']?.sparkline    ?? [], accent: '#138808' },
          { label: 'BANK NIFTY', symbol: '^NSEBANK',  price: idxMap['^NSEBANK']?.price  ?? 52000, change: idxMap['^NSEBANK']?.change  ?? 0, changePct: idxMap['^NSEBANK']?.changePct  ?? 0, sparkline: idxMap['^NSEBANK']?.sparkline  ?? [], accent: 'var(--text-warning)' },
          { label: 'INDIA VIX',  symbol: '^INDIAVIX', price: idxMap['^INDIAVIX']?.price ?? 14.5,  change: idxMap['^INDIAVIX']?.change ?? 0, changePct: idxMap['^INDIAVIX']?.changePct ?? 0, sparkline: idxMap['^INDIAVIX']?.sparkline ?? [], accent: 'var(--text-negative)' },
          { label: 'USD/INR',    symbol: 'USDINR=X',  price: usdInr.price, change: usdInr.change, changePct: usdInr.changePct, sparkline: [], accent: '#34d399' },
        ]
        setMetrics(updated)
      } catch {}
    }
    fetchIndia()
    const id = setInterval(fetchIndia, 30000)
    return () => clearInterval(id)
  }, [isIndia])

  // Reset metrics when mode changes
  useEffect(() => {
    setMetrics(isIndia ? DEFAULT_INDIA_METRICS : DEFAULT_METRICS)
  }, [isIndia])

  if (isIndia) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: '100vw', overflowX: 'hidden', boxSizing: 'border-box' }}>
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 8, display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          {/* Row 0: 5 India metric cards — immediate */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6 }}>
            {metrics.map(m => <MetricCard key={m.symbol} m={m} isIndia />)}
          </div>

          {/* Row 1: Market Overview Strip — immediate */}
          <MarketOverviewStrip />

          {/* Row 2: Daily Brief + RBI Policy — 500ms */}
          {phase >= 1 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 280px)', gap: 6 }}>
              <ErrorBoundary name="Daily Brief"><DailyBrief /></ErrorBoundary>
              <ErrorBoundary name="RBI Policy Tracker"><RBIPolicyTracker /></ErrorBoundary>
            </div>
          ) : <PanelSkeleton h={120} />}

          {/* Row 3: Nifty Movers + India Crypto — 500ms */}
          {phase >= 1 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 6, minHeight: 260 }}>
              <ErrorBoundary name="India Market Movers"><IndiaMarketMovers /></ErrorBoundary>
              <ErrorBoundary name="India Crypto"><IndiaCryptoMini /></ErrorBoundary>
            </div>
          ) : <PanelSkeleton h={260} />}

          {/* Row 4: Nifty Heatmap + AI Analyst — 1000ms */}
          {phase >= 2 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 380px) minmax(0, 1fr)',
              gap: 6,
              minHeight: 520,
              width: '100%',
              maxWidth: '100%',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}>
              <div style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
                <ErrorBoundary name="Nifty Heatmap"><NiftyHeatmap /></ErrorBoundary>
              </div>
              <ErrorBoundary name="AI Analyst"><AnalystPanel /></ErrorBoundary>
            </div>
          ) : <PanelSkeleton h={520} />}

          {/* Row 5: FII/DII + Narrative + India News — 1500ms */}
          {phase >= 3 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 280px) minmax(0, 280px) minmax(0, 1fr)', gap: 6, minHeight: 260 }}>
              <ErrorBoundary name="FII/DII Flow"><FIIDIIFlow /></ErrorBoundary>
              <div style={{ border: '1px solid var(--border-color)', background: 'var(--bg-panel)' }}>
                <ErrorBoundary name="Narrative Detector"><NarrativeDetector /></ErrorBoundary>
              </div>
              <ErrorBoundary name="India News"><IndiaNewsMini limit={12} /></ErrorBoundary>
            </div>
          ) : <PanelSkeleton h={260} />}

          {/* Row 6: ISS + Earthquake + Weather — 2000ms */}
          {phase >= 4 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 6, minHeight: 200, width: '100%', overflow: 'hidden' }}>
              <div style={{ border: '1px solid var(--border-color)', background: 'var(--bg-panel)' }}>
                <ErrorBoundary name="ISS Tracker"><ISSTracker /></ErrorBoundary>
              </div>
              <ErrorBoundary name="Earthquake Panel"><EarthquakePanel limit={6} /></ErrorBoundary>
              <ErrorBoundary name="Weather Panel"><WeatherPanel tempUnit={tempUnit} onTempUnitChange={handleTempUnitChange} /></ErrorBoundary>
            </div>
          )}

        </div>
        <TickerTape prices={tapePrices} />
      </div>
    )
  }

  // USA MODE (original layout)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: '100vw', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 8, display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        {/* Row 0: 5 quick metric cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6 }}>
          {metrics.map(m => <MetricCard key={m.symbol} m={m} />)}
        </div>

        {/* Row 1: Global Market Overview Strip — immediate */}
        <ErrorBoundary name="Market Overview"><MarketOverviewStrip /></ErrorBoundary>

        {/* Row 2: Daily Brief + Fear Radar — 500ms */}
        {phase >= 1 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 6 }}>
            <ErrorBoundary name="Daily Brief"><DailyBrief /></ErrorBoundary>
            <ErrorBoundary name="Fear Radar"><FearRadar compact={false} /></ErrorBoundary>
          </div>
        ) : <PanelSkeleton h={120} />}

        {/* Row 3: Market Movers + Crypto — 500ms */}
        {phase >= 1 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 6, minHeight: 260 }}>
            <ErrorBoundary name="Market Movers"><MarketMovers /></ErrorBoundary>
            <ErrorBoundary name="Crypto Panel"><CryptoPanel /></ErrorBoundary>
          </div>
        ) : <PanelSkeleton h={260} />}

        {/* Row 4: Narrative Detector + News — 1000ms */}
        {phase >= 2 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 6, minHeight: 280 }}>
            <div style={{ border: '1px solid var(--border-color)', background: 'var(--bg-panel)' }}>
              <ErrorBoundary name="Narrative Detector"><NarrativeDetector /></ErrorBoundary>
            </div>
            <ErrorBoundary name="News Panel"><NewsPanel limit={8} /></ErrorBoundary>
          </div>
        ) : <PanelSkeleton h={280} />}

        {/* Row 5: Reddit + ISS + Earthquake + Weather — 1500ms */}
        {phase >= 3 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) 180px', gap: 6, minHeight: 200 }}>
            <div style={{ border: '1px solid var(--border-color)', background: 'var(--bg-panel)' }}>
              <div style={{ padding: '5px 8px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>REDDIT SENTIMENT</span>
              </div>
              <ErrorBoundary name="Reddit Sentiment"><RedditSentiment /></ErrorBoundary>
            </div>
            <div style={{ border: '1px solid var(--border-color)', background: 'var(--bg-panel)' }}>
              <ErrorBoundary name="ISS Tracker"><ISSTracker /></ErrorBoundary>
            </div>
            <ErrorBoundary name="Earthquake Panel"><EarthquakePanel limit={6} /></ErrorBoundary>
            <ErrorBoundary name="Weather Panel"><WeatherPanel tempUnit={tempUnit} onTempUnitChange={handleTempUnitChange} /></ErrorBoundary>
          </div>
        )}

      </div>
      <TickerTape prices={tapePrices} />
    </div>
  )
}
