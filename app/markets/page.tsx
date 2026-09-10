'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import CandlestickChart from '@/components/charts/CandlestickChart'
import PanelWrapper from '@/components/panels/PanelWrapper'
import AIButton from '@/components/terminal/AIButton'
import { formatCurrency, formatNumber, formatPercent, getCurrencyForTicker } from '@/lib/utils'
import { useAlpacaStream } from '@/lib/hooks/useAlpacaStream'
import { useFlash } from '@/lib/hooks/useFlash'

const DEFAULT_TICKERS = ['SPY','QQQ','AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','JPM','PLTR','AMD']

const PERIODS = [
  { label: '1D',  value: '1d',  interval: '5m'  },
  { label: '5D',  value: '5d',  interval: '15m' },
  { label: '1M',  value: '1mo', interval: '1d'  },
  { label: '3M',  value: '3mo', interval: '1d'  },
  { label: '6M',  value: '6mo', interval: '1d'  },
  { label: '1Y',  value: '1y',  interval: '1wk' },
  { label: '2Y',  value: '2y',  interval: '1wk' },
]

interface Quote {
  symbol: string; shortName?: string; regularMarketPrice: number
  regularMarketChange: number; regularMarketChangePercent: number
  regularMarketVolume: number; marketCap?: number; trailingPE?: number
  fiftyTwoWeekHigh?: number; fiftyTwoWeekLow?: number; dividendYield?: number
  averageAnalystRating?: string
}

interface Indicator {
  time: number; sma20?: number|null; sma50?: number|null; sma200?: number|null
  ema12?: number|null; ema26?: number|null
  rsi?: number|null; macd?: number|null; macdSignal?: number|null; macdHist?: number|null
  bbUpper?: number|null; bbLower?: number|null; bbMiddle?: number|null
}

const SIGNAL_COLORS: Record<string, string> = {
  OVERBOUGHT: 'var(--text-negative)', OVERSOLD: 'var(--text-positive)', NEUTRAL: 'var(--text-secondary)',
  'BULLISH CROSSOVER': 'var(--text-positive)', 'BEARISH CROSSOVER': 'var(--text-negative)',
  'ABOVE 50 SMA': 'var(--text-positive)', 'BELOW 50 SMA': 'var(--text-negative)',
  'BB SQUEEZE HIGH': 'var(--text-negative)', 'BB SQUEEZE LOW': 'var(--text-positive)', 'WITHIN BB': 'var(--text-secondary)',
  'N/A': 'var(--text-muted)',
}

const IND_COLORS: Record<string,string> = { SMA20:'var(--text-accent)', SMA50:'var(--text-warning)', SMA200:'#a78bfa', EMA12:'#34d399', EMA26:'#fb923c', BB:'var(--text-positive)', RSI:'var(--text-accent)', MACD:'#ec4899' }

function MarketsInner() {
  const searchParams = useSearchParams()
  const urlTicker = searchParams.get('ticker')

  const [selectedTicker, setSelectedTicker] = useState(urlTicker || 'SPY')

  const { tickers: alpacaTickers, connected: alpacaConnected } =
    useAlpacaStream([selectedTicker ?? 'SPY'])

  const [searchInput,    setSearchInput]    = useState('')
  const [period,         setPeriod]         = useState('3mo')
  const [quote,          setQuote]          = useState<Quote|null>(null)
  const [candles,        setCandles]        = useState<any[]>([])
  const [indicators,     setIndicators]     = useState<Indicator[]>([])
  const [signals,        setSignals]        = useState<Record<string,string>>({})
  const [summary,        setSummary]        = useState<Record<string,unknown>|null>(null)
  const [loading,        setLoading]        = useState(true)
  const [rateLimited,    setRateLimited]    = useState(false)
  const [retryCountdown, setRetryCountdown] = useState(0)
  const [watchlist,      setWatchlist]      = useState<Quote[]>([])
  const [source,         setSource]         = useState('live')
  const [activeIndicators, setActiveIndicators] = useState<string[]>(['SMA20','SMA50','RSI','MACD'])

  const liveTicker = alpacaTickers.get(selectedTicker ?? 'SPY')
  // NSE/BSE tickers are priced in INR — see getCurrencyForTicker.
  const cur = getCurrencyForTicker(selectedTicker ?? quote?.symbol)
  const displayPrice = liveTicker?.price || quote?.regularMarketPrice || 0
  const displayChangePct = liveTicker?.changePct || quote?.regularMarketChangePercent || 0

  const flash = useFlash(displayPrice)

  const toggle = (ind: string) =>
    setActiveIndicators(arr => arr.includes(ind) ? arr.filter(a => a !== ind) : [...arr, ind])

  const fetchTechnicals = useCallback(async (ticker: string, per: string) => {
    setLoading(true)
    setRateLimited(false)
    try {
      const res  = await fetch(`/api/technicals?ticker=${ticker}&period=${per}`)
      const json = await res.json()
      if (json.data) {
        setCandles(json.data.candles || [])
        setIndicators(json.data.indicators || [])
        setSignals(json.data.signals || {})
        setSource(json.source || 'live')
        setRateLimited(false)
      } else if (json.rateLimited) {
        setRateLimited(true)
        let secs = 30
        setRetryCountdown(secs)
        const tick = setInterval(() => {
          secs--
          setRetryCountdown(secs)
          if (secs <= 0) clearInterval(tick)
        }, 1000)
        setTimeout(() => { clearInterval(tick); fetchTechnicals(ticker, per) }, 30000)
        return
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  const fetchQuote = useCallback(async (ticker: string) => {
    try {
      const [qRes, sRes] = await Promise.allSettled([
        fetch(`/api/stocks?tickers=${ticker}`),
        fetch(`/api/stocks?type=summary&ticker=${ticker}`),
      ])
      if (qRes.status === 'fulfilled') {
        const j = await qRes.value.json()
        const arr = Array.isArray(j.data) ? j.data : []
        if (arr.length > 0) setQuote(arr[0])
        else if (j.data && !Array.isArray(j.data)) setQuote(j.data)
      }
      if (sRes.status === 'fulfilled') { const j = await sRes.value.json(); if (j.data) setSummary(j.data) }
    } catch { /* silent */ }
  }, [])

  const fetchWatchlist = useCallback(async () => {
    try {
      const res  = await fetch(`/api/stocks?tickers=${DEFAULT_TICKERS.join(',')}`)
      const json = await res.json()
      if (json.data) setWatchlist(json.data)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchQuote(selectedTicker)
    fetchTechnicals(selectedTicker, period)
    const id = setInterval(() => fetchQuote(selectedTicker), 60000)
    return () => clearInterval(id)
  }, [selectedTicker, period])

  useEffect(() => { fetchWatchlist(); const id = setInterval(fetchWatchlist, 60000); return () => clearInterval(id) }, [])

  useEffect(() => { if (urlTicker) setSelectedTicker(urlTicker) }, [urlTicker])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput.trim()) { setSelectedTicker(searchInput.trim().toUpperCase()); setSearchInput('') }
  }

  // Build overlay data for CandlestickChart
  const on = (key: string) => activeIndicators.includes(key)
  const toOverlay = (key: keyof Indicator) =>
    indicators.map(d => ({ time: d.time, value: (d[key] as number | null | undefined) ?? null }))

  const overlays = {
    sma20:   on('SMA20')  ? toOverlay('sma20')   : [],
    sma50:   on('SMA50')  ? toOverlay('sma50')   : [],
    sma200:  on('SMA200') ? toOverlay('sma200')  : [],
    ema12:   on('EMA12')  ? toOverlay('ema12')   : [],
    ema26:   on('EMA26')  ? toOverlay('ema26')   : [],
    bbUpper: on('BB')     ? toOverlay('bbUpper') : [],
    bbLower: on('BB')     ? toOverlay('bbLower') : [],
  }
  const rsiData  = indicators.map(d => ({ time: d.time, value: d.rsi ?? null }))
  const macdData = indicators.map(d => ({ time: d.time, macd: d.macd ?? null, signal: d.macdSignal ?? null, hist: d.macdHist ?? null }))

  return (
    <div className="p-2 flex gap-2 h-full">
      {/* Left: Watchlist */}
      <div style={{ width: 185, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PanelWrapper title="WATCHLIST" fullHeight>
          <div>
            <form onSubmit={handleSearch} style={{ padding: 8 }}>
              <input value={searchInput} onChange={e => setSearchInput(e.target.value.toUpperCase())}
                placeholder="SEARCH TICKER..." className="input-terminal w-full" />
            </form>
            <table className="data-table">
              <thead><tr><th style={{ textAlign:'left' }}>TICKER</th><th>PRICE</th><th>CHG%</th></tr></thead>
              <tbody>
                {watchlist.map(q => (
                  <tr key={q.symbol} onClick={() => setSelectedTicker(q.symbol)} style={{ cursor:'pointer' }}>
                    <td style={{ textAlign:'left' }}>
                      <span style={{ color: selectedTicker===q.symbol ? 'var(--text-accent)' : 'var(--text-primary)', fontWeight: selectedTicker===q.symbol ? 700 : 400 }}>{q.symbol}</span>
                    </td>
                    <td style={{ fontSize:'var(--fs-body)' }}>{getCurrencyForTicker(q.symbol)}{q.regularMarketPrice?.toFixed(2)}</td>
                    <td style={{ fontSize:'var(--fs-body)', color: q.regularMarketChangePercent>=0 ? 'var(--text-positive)' : 'var(--text-negative)' }}>
                      {formatPercent(q.regularMarketChangePercent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelWrapper>
      </div>

      {/* Center: Chart */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8, minWidth:0 }}>
        {/* Quote Header */}
        {quote && (
          <div style={{ border:'1px solid #1e293b', borderLeft:'2px solid #38bdf8', background:'var(--bg-header)', padding:'8px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontFamily:'IBM Plex Mono', fontSize:20, fontWeight:700, color:'var(--text-accent)', letterSpacing:'0.06em' }}>{quote.symbol}</span>
              <span style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-meta)', color:'var(--text-muted)' }}>{quote.shortName}</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              <span style={{
                fontFamily:'IBM Plex Mono', fontSize:24, fontWeight:700,
                color: flash === 'up' ? '#00e676' : flash === 'down' ? '#ff1744' : 'var(--text-primary)',
                background: flash === 'up' ? 'rgba(0,230,118,0.08)' : flash === 'down' ? 'rgba(255,23,68,0.08)' : 'transparent',
                transition: 'all 400ms ease',
                padding: '2px 6px',
                borderRadius: '3px',
              }}>{formatCurrency(displayPrice, 2, cur)}</span>
              <div>
                <div style={{ fontFamily:'IBM Plex Mono', fontSize:13, fontWeight:700, color: displayChangePct>=0 ? 'var(--text-positive)' : 'var(--text-negative)' }}>
                  {displayChangePct>=0 ? '▲' : '▼'} {formatPercent(displayChangePct)}
                </div>
                <div style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-body)', color: quote.regularMarketChangePercent>=0 ? 'var(--text-positive)' : 'var(--text-negative)' }}>
                  {quote.regularMarketChange>=0 ? '+' : ''}{quote.regularMarketChange?.toFixed(2)}
                </div>
              </div>
              {alpacaConnected ? (
                <span style={{
                  background: 'rgba(0,230,118,0.1)', color: '#00e676', border: '1px solid rgba(0,230,118,0.3)',
                  borderRadius: '20px', padding: '1px 8px', fontSize: 'var(--fs-badge)', fontWeight: 700, fontFamily: 'IBM Plex Mono',
                }}>
                  ● LIVE
                </span>
              ) : (
                <span style={{
                  background: 'rgba(255,152,0,0.1)', color: '#ff9800', border: '1px solid rgba(255,152,0,0.3)',
                  borderRadius: '20px', padding: '1px 8px', fontSize: 'var(--fs-badge)', fontWeight: 700, fontFamily: 'IBM Plex Mono',
                }}>
                  ● DELAYED 15m
                </span>
              )}
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
              {Object.entries(signals).filter(([k]) => k !== 'rsi' && k !== 'macdValue').map(([k,v]) => (
                <span key={k} style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-badge)', padding:'2px 7px', background:`${SIGNAL_COLORS[v as string]||'var(--text-muted)'}18`, border:`1px solid ${SIGNAL_COLORS[v as string]||'var(--text-muted)'}40`, color:SIGNAL_COLORS[v as string]||'var(--text-muted)', borderRadius:3 }}>
                  {v as string}
                </span>
              ))}
              <AIButton
                panelData={{ symbol: quote?.symbol, price: quote?.regularMarketPrice, change: quote?.regularMarketChangePercent, volume: quote?.regularMarketVolume, signals, summary }}
                panelName={`${quote?.symbol} MARKETS`}
                context={`Technical signals: ${JSON.stringify(signals)}. Period: ${period}`}
              />
            </div>
          </div>
        )}

        {/* Period + Indicator Toggles */}
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:3 }}>
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)} style={{
                fontFamily:'IBM Plex Mono', fontSize:'var(--fs-meta)', padding:'4px 9px', cursor:'pointer',
                border:'1px solid', borderRadius:3,
                background: period===p.value ? 'rgba(255,109,0,0.12)' : 'transparent',
                color:       period===p.value ? 'var(--text-accent)' : 'var(--text-muted)',
                borderColor: period===p.value ? 'var(--text-accent)' : 'var(--border-color)',
              }}>{p.label}</button>
            ))}
          </div>
          <div style={{ width:1, height:20, background:'var(--border-color)' }} />
          <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
            {Object.keys(IND_COLORS).map(ind => {
              const active = activeIndicators.includes(ind)
              return (
                <button key={ind} onClick={() => toggle(ind)} style={{
                  fontFamily:'IBM Plex Mono', fontSize:'var(--fs-meta)', padding:'4px 9px', cursor:'pointer',
                  border:`1px solid ${active ? IND_COLORS[ind] : 'var(--border-color)'}`,
                  background: active ? `${IND_COLORS[ind]}15` : 'transparent',
                  color: active ? IND_COLORS[ind] : 'var(--text-muted)', borderRadius:3,
                  transition:'all 0.15s',
                }}>
                  <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background: active ? IND_COLORS[ind] : 'var(--border-color)', marginRight:4, verticalAlign:'middle' }} />
                  {ind}
                </button>
              )
            })}
          </div>
        </div>

        {/* Candlestick Chart with integrated RSI/MACD */}
        <div style={{ border:'1px solid #1e293b', background:'var(--bg-terminal)', borderRadius:2, overflow:'hidden' }}>
          <div className="panel-header">
            <span className="panel-header-title">{selectedTicker} — OHLCV · {PERIODS.find(p=>p.value===period)?.label}</span>
            <span style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-meta)', color: source==='live' ? 'var(--text-positive)' : 'var(--text-warning)' }}>
              {source==='live' ? '● LIVE' : '⚠ CACHED'}
            </span>
          </div>
          {rateLimited ? (
            <div style={{ height:400, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12 }}>
              <div style={{ fontFamily:'IBM Plex Mono', fontSize:13, color:'var(--text-warning)' }}>⚠ YAHOO FINANCE RATE LIMIT</div>
              <div style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-body)', color:'var(--text-muted)' }}>Auto-retrying in {retryCountdown}s...</div>
              <button onClick={() => fetchTechnicals(selectedTicker, period)}
                style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-body)', color:'var(--text-accent)', background:'transparent', border:'1px solid #1e3a5f', padding:'4px 12px', cursor:'pointer', borderRadius:2 }}>
                RETRY NOW
              </button>
            </div>
          ) : loading && candles.length === 0 ? (
            <div style={{ height:400, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, background:'var(--bg-terminal)' }}>
              <span style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-body)', color:'var(--text-accent)' }}>FETCHING {selectedTicker} CHART<span className="blink-cursor" /></span>
              <span style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-meta)', color:'var(--text-muted)' }}>CONNECTING TO MARKET DATA...</span>
            </div>
          ) : (
            <CandlestickChart
              candles={candles}
              height={400}
              showVolume
              showRsi={on('RSI')}
              showMacd={on('MACD')}
              rsiData={rsiData}
              macdData={macdData}
              overlays={overlays}
            />
          )}
        </div>
      </div>

      {/* Right: Fundamentals */}
      <div style={{ width:210, flexShrink:0, display:'flex', flexDirection:'column', gap:8 }}>
        {quote && (
          <PanelWrapper title={`${quote.symbol} FUNDAMENTALS`} accentColor="#f59e0b">
            <div style={{ padding:'4px 10px' }}>
              {[
                { label:'MKT CAP',    value: quote.marketCap ? formatNumber(quote.marketCap) : 'N/A' },
                { label:'P/E RATIO',  value: (summary as any)?.summaryDetail?.trailingPE?.toFixed(1) || 'N/A' },
                { label:'FWD P/E',    value: (summary as any)?.summaryDetail?.forwardPE?.toFixed(1) || 'N/A' },
                { label:'52W HIGH',   value: formatCurrency(quote.fiftyTwoWeekHigh||0, 2, cur) },
                { label:'52W LOW',    value: formatCurrency(quote.fiftyTwoWeekLow||0, 2, cur) },
                { label:'VOLUME',     value: formatNumber(quote.regularMarketVolume||0) },
                { label:'DIV YIELD',  value: quote.dividendYield ? `${(quote.dividendYield*100).toFixed(2)}%` : 'N/A' },
                { label:'AVG RATING', value: quote.averageAnalystRating || 'N/A' },
                { label:'BETA',       value: (summary as any)?.summaryDetail?.beta?.toFixed(2) || 'N/A' },
                { label:'PROFIT MGN', value: (summary as any)?.financialData?.profitMargins ? `${((summary as any).financialData.profitMargins*100).toFixed(1)}%` : 'N/A' },
                { label:'REV GROWTH', value: (summary as any)?.financialData?.revenueGrowth  ? `${((summary as any).financialData.revenueGrowth*100).toFixed(1)}%`  : 'N/A' },
                { label:'GROSS MGN',  value: (summary as any)?.financialData?.grossMargins   ? `${((summary as any).financialData.grossMargins*100).toFixed(1)}%`   : 'N/A' },
              ].map(row => (
                <div key={row.label} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid rgba(30,41,59,0.5)' }}>
                  <span style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-meta)', color:'var(--text-muted)' }}>{row.label}</span>
                  <span style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-body)', color:'var(--text-secondary)' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </PanelWrapper>
        )}
        {quote?.fiftyTwoWeekHigh && quote?.fiftyTwoWeekLow && (
          <div style={{ border:'1px solid #1e293b', background:'var(--bg-panel)', padding:'8px 10px' }}>
            <div style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-meta)', color:'var(--text-accent)', letterSpacing:'0.06em', marginBottom:6 }}>52W RANGE</div>
            <div style={{ position:'relative', height:6, background:'var(--border-color)', borderRadius:3 }}>
              <div style={{
                position:'absolute', left:0, top:0, height:'100%', borderRadius:3,
                width:`${((quote.regularMarketPrice-quote.fiftyTwoWeekLow)/(quote.fiftyTwoWeekHigh-quote.fiftyTwoWeekLow))*100}%`,
                background:'linear-gradient(90deg,var(--text-positive),var(--text-accent))',
              }} />
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
              <span style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-body)', color:'var(--text-negative)' }}>{cur}{quote.fiftyTwoWeekLow.toFixed(0)}</span>
              <span style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-body)', color:'var(--text-positive)' }}>{cur}{quote.fiftyTwoWeekHigh.toFixed(0)}</span>
            </div>
          </div>
        )}
        {/* Quick links to financial pages */}
        {quote && (
          <div style={{ border:'1px solid #1e293b', background:'var(--bg-panel)', padding:'8px 10px' }}>
            <div style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-meta)', color:'var(--text-accent)', letterSpacing:'0.06em', marginBottom:6 }}>QUICK LINKS</div>
            {[
              { label:'FINANCIALS', href:`/financials?ticker=${quote.symbol}` },
              { label:'OPTIONS',    href:`/options?ticker=${quote.symbol}` },
              { label:'EARNINGS',   href:'/earnings' },
              { label:'INSIDER',    href:'/insiders' },
            ].map(l => (
              <a key={l.label} href={l.href} style={{ display:'block', fontFamily:'IBM Plex Mono', fontSize:'var(--fs-body)', color:'var(--text-accent)', padding:'4px 0', borderBottom:'1px solid rgba(30,41,59,0.3)', textDecoration:'none' }}
                onMouseEnter={e => (e.currentTarget.style.color='var(--text-accent)')} onMouseLeave={e => (e.currentTarget.style.color='var(--text-accent)')}>
                → {l.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function MarketsPage() {
  return (
    <Suspense fallback={<div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', fontFamily:'IBM Plex Mono', color:'var(--text-accent)' }}>LOADING MARKETS<span className="blink-cursor" /></div>}>
      <MarketsInner />
    </Suspense>
  )
}
