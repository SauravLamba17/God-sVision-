'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Fuse from 'fuse.js'

type Category = 'PAGE' | 'STOCK' | 'CRYPTO' | 'FOREX' | 'ETF'

interface SearchItem {
  id: string
  label: string
  sublabel: string
  category: Category
  href: string
}

const PAGES: SearchItem[] = [
  { id: 'dash',        label: 'DASHBOARD',    sublabel: 'Main overview',              category: 'PAGE', href: '/' },
  { id: 'markets',     label: 'MARKETS',      sublabel: 'Equities & chart',           category: 'PAGE', href: '/markets' },
  { id: 'crypto',      label: 'CRYPTO',       sublabel: 'Top 100 coins & DeFi',       category: 'PAGE', href: '/crypto' },
  { id: 'forex',       label: 'FOREX',        sublabel: 'Currency pairs & rates',     category: 'PAGE', href: '/forex' },
  { id: 'macro',       label: 'MACRO',        sublabel: 'GDP, CPI, Fed, bonds',       category: 'PAGE', href: '/macro' },
  { id: 'commodities', label: 'COMMODITIES',  sublabel: 'Oil, gold, wheat, metals',   category: 'PAGE', href: '/commodities' },
  { id: 'news',        label: 'NEWS',         sublabel: 'Live financial headlines',   category: 'PAGE', href: '/news' },
  { id: 'map',         label: 'MAP',          sublabel: 'Global market map',          category: 'PAGE', href: '/map' },
  { id: 'heatmap',     label: 'HEATMAP',      sublabel: 'S&P 500 sector heat map',    category: 'PAGE', href: '/heatmap' },
  { id: 'screener',    label: 'SCREENER',     sublabel: 'Stock screener & filters',   category: 'PAGE', href: '/screener' },
  { id: 'options',     label: 'OPTIONS',      sublabel: 'Options chain & Greeks',     category: 'PAGE', href: '/options' },
  { id: 'earnings',    label: 'EARNINGS',     sublabel: 'Upcoming earnings calendar', category: 'PAGE', href: '/earnings' },
  { id: 'portfolio',   label: 'PORTFOLIO',    sublabel: 'Track your positions',       category: 'PAGE', href: '/portfolio' },
  { id: 'alerts',      label: 'ALERTS',       sublabel: 'Price & news alerts',        category: 'PAGE', href: '/alerts' },
  { id: 'yield-curve', label: 'YIELD CURVE',  sublabel: 'Treasury yield curve',       category: 'PAGE', href: '/yield-curve' },
  { id: 'bonds',       label: 'BONDS',        sublabel: 'Fixed income / bonds',       category: 'PAGE', href: '/bonds' },
  { id: 'backtest',    label: 'BACKTEST',     sublabel: 'Backtesting engine',         category: 'PAGE', href: '/backtest' },
  { id: 'chat',        label: 'CHAT',         sublabel: 'GOD\'s Vision live chat',    category: 'PAGE', href: '/chat' },
  { id: 'sheets',      label: 'SHEETS',       sublabel: 'Google Sheets add-on setup', category: 'PAGE', href: '/sheets' },
  { id: 'insiders',     label: 'INSIDERS',      sublabel: 'SEC Form 4 insider transactions', category: 'PAGE', href: '/insiders' },
  { id: 'centralbanks',label: 'CENTRAL BANKS', sublabel: 'Fed/ECB/BOE speeches & rates',   category: 'PAGE', href: '/centralbanks' },
  { id: 'correlation',  label: 'CORRELATION',   sublabel: '90-day cross-asset matrix',      category: 'PAGE', href: '/correlation' },
  { id: 'disease',      label: 'DISEASE',       sublabel: 'Global health intelligence',     category: 'PAGE', href: '/disease' },
  { id: 'godmode',      label: 'GOD MODE',      sublabel: 'Fullscreen ambient display',     category: 'PAGE', href: '/godmode' },
  { id: 'flights',      label: 'FLIGHTS',       sublabel: 'Live flight tracker',            category: 'PAGE', href: '/flights' },
  { id: 'weather',      label: 'WEATHER',       sublabel: 'Global weather & climate',       category: 'PAGE', href: '/weather' },
  { id: 'sports',       label: 'SPORTS',        sublabel: 'Live scores & standings',        category: 'PAGE', href: '/sports' },
]

const STOCKS: SearchItem[] = [
  'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','JPM','V','MA',
  'BRK-B','JNJ','UNH','XOM','LLY','AVGO','ORCL','HD','PG','COST',
  'ABBV','MRK','BAC','WFC','GS','AMD','INTC','CSCO','CRM','ADBE',
  'NFLX','PYPL','UBER','SNAP','SHOP','PLTR','SNOW','NET','CRWD','PANW',
  'DIS','SBUX','MCD','NKE','KO','PEP','WMT','TGT','BA','CAT',
].map(sym => ({
  id: `stock-${sym}`,
  label: sym,
  sublabel: 'Equity — Markets',
  category: 'STOCK' as Category,
  href: `/markets?ticker=${sym}`,
}))

const ETFS: SearchItem[] = [
  { sym: 'SPY', name: 'S&P 500' }, { sym: 'QQQ', name: 'Nasdaq 100' },
  { sym: 'DIA', name: 'Dow Jones' }, { sym: 'IWM', name: 'Russell 2000' },
  { sym: 'GLD', name: 'Gold' }, { sym: 'SLV', name: 'Silver' },
  { sym: 'USO', name: 'Crude Oil' }, { sym: 'TLT', name: '20Y Treasuries' },
  { sym: 'XLK', name: 'Tech ETF' }, { sym: 'XLF', name: 'Financials ETF' },
].map(({ sym, name }) => ({
  id: `etf-${sym}`,
  label: sym,
  sublabel: `ETF — ${name}`,
  category: 'ETF' as Category,
  href: `/markets?ticker=${sym}`,
}))

const CRYPTO: SearchItem[] = [
  { sym: 'BTC', name: 'Bitcoin' }, { sym: 'ETH', name: 'Ethereum' },
  { sym: 'BNB', name: 'BNB' }, { sym: 'SOL', name: 'Solana' },
  { sym: 'XRP', name: 'XRP' }, { sym: 'ADA', name: 'Cardano' },
  { sym: 'DOGE', name: 'Dogecoin' }, { sym: 'AVAX', name: 'Avalanche' },
  { sym: 'DOT', name: 'Polkadot' }, { sym: 'LINK', name: 'Chainlink' },
  { sym: 'MATIC', name: 'Polygon' }, { sym: 'UNI', name: 'Uniswap' },
  { sym: 'LTC', name: 'Litecoin' }, { sym: 'ATOM', name: 'Cosmos' },
  { sym: 'SHIB', name: 'Shiba Inu' }, { sym: 'ARB', name: 'Arbitrum' },
  { sym: 'OP', name: 'Optimism' }, { sym: 'APT', name: 'Aptos' },
].map(({ sym, name }) => ({
  id: `crypto-${sym}`,
  label: sym,
  sublabel: `Crypto — ${name}`,
  category: 'CRYPTO' as Category,
  href: `/crypto`,
}))

const FOREX: SearchItem[] = [
  { pair: 'EURUSD', label: 'EUR/USD', name: 'Euro / US Dollar' },
  { pair: 'GBPUSD', label: 'GBP/USD', name: 'British Pound / USD' },
  { pair: 'USDJPY', label: 'USD/JPY', name: 'US Dollar / Japanese Yen' },
  { pair: 'USDCHF', label: 'USD/CHF', name: 'US Dollar / Swiss Franc' },
  { pair: 'AUDUSD', label: 'AUD/USD', name: 'Australian Dollar / USD' },
  { pair: 'USDCAD', label: 'USD/CAD', name: 'US Dollar / Canadian Dollar' },
  { pair: 'NZDUSD', label: 'NZD/USD', name: 'New Zealand Dollar / USD' },
  { pair: 'EURGBP', label: 'EUR/GBP', name: 'Euro / British Pound' },
  { pair: 'USDINR', label: 'USD/INR', name: 'US Dollar / Indian Rupee' },
  { pair: 'USDCNY', label: 'USD/CNY', name: 'US Dollar / Chinese Yuan' },
  { pair: 'XAUUSD', label: 'XAU/USD', name: 'Gold / US Dollar' },
  { pair: 'XAGUSD', label: 'XAG/USD', name: 'Silver / US Dollar' },
].map(({ pair, label, name }) => ({
  id: `forex-${pair}`,
  label,
  sublabel: `Forex — ${name}`,
  category: 'FOREX' as Category,
  href: `/forex?pair=${pair}`,
}))

const ALL_ITEMS: SearchItem[] = [...PAGES, ...STOCKS, ...ETFS, ...CRYPTO, ...FOREX]

const CATEGORY_COLOR: Record<Category, string> = {
  PAGE:   'var(--text-accent)',
  STOCK:  'var(--text-positive)',
  ETF:    '#a78bfa',
  CRYPTO: 'var(--text-warning)',
  FOREX:  '#fb923c',
}

const fuseOptions = {
  keys: ['label', 'sublabel', 'id'],
  threshold: 0.35,
  includeScore: true,
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const fuse = useMemo(() => new Fuse(ALL_ITEMS, fuseOptions), [])

  const results = useMemo<SearchItem[]>(() => {
    if (!query.trim()) return PAGES.slice(0, 8)
    return fuse.search(query).slice(0, 12).map(r => r.item)
  }, [query, fuse])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setSelected(0)
  }, [])

  const select = useCallback((item: SearchItem) => {
    router.push(item.href)
    close()
  }, [router, close])

  // Keyboard shortcut to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Navigation inside palette
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected(prev => Math.min(prev + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (results[selected]) select(results[selected])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, results, selected, close, select])

  // Auto-focus and reset selection on query change
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => { setSelected(0) }, [query])

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.children[selected] as HTMLElement
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: '12vh',
      }}
      onClick={e => { if (e.target === e.currentTarget) close() }}
    >
      <div style={{
        width: '100%',
        maxWidth: 760,
        border: '1px solid #1e293b',
        borderTop: '2px solid #f59e0b',
        background: 'var(--bg-terminal)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(245,158,11,0.08)',
      }}>
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          borderBottom: '1px solid #1e293b',
        }}>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 14, color: 'var(--text-warning)', opacity: 0.7 }}>
            &gt;_
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tickers, coins, pairs, pages..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontFamily: 'IBM Plex Mono', fontSize: 14, fontWeight: 500,
              color: 'var(--text-warning)',
              caretColor: 'var(--text-warning)',
            }}
          />
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)' }}>
            ESC
          </span>
        </div>

        {/* Results list */}
        <div ref={listRef} style={{ maxHeight: 360, overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: '20px 14px', fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              NO RESULTS FOR &quot;{query}&quot;
            </div>
          ) : (
            results.map((item, i) => (
              <div
                key={item.id}
                onClick={() => select(item)}
                onMouseEnter={() => setSelected(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '9px 14px',
                  cursor: 'pointer',
                  background: i === selected ? 'rgba(245,158,11,0.06)' : 'transparent',
                  borderLeft: i === selected ? '2px solid #f59e0b' : '2px solid transparent',
                  transition: 'background 0.1s',
                }}
              >
                {/* Category badge */}
                <span style={{
                  fontFamily: 'IBM Plex Mono', fontSize: 8, fontWeight: 700,
                  color: CATEGORY_COLOR[item.category],
                  background: `${CATEGORY_COLOR[item.category]}15`,
                  border: `1px solid ${CATEGORY_COLOR[item.category]}30`,
                  borderRadius: 2,
                  padding: '1px 5px',
                  letterSpacing: '0.08em',
                  minWidth: 42, textAlign: 'center',
                  flexShrink: 0,
                }}>
                  {item.category}
                </span>

                {/* Label */}
                <span style={{
                  fontFamily: 'IBM Plex Mono', fontSize: 12, fontWeight: 600,
                  color: i === selected ? 'var(--text-warning)' : 'var(--text-primary)',
                  minWidth: 80,
                }}>
                  {item.label}
                </span>

                {/* Sublabel */}
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)' }}>
                  {item.sublabel}
                </span>

                {/* Arrow indicator */}
                {i === selected && (
                  <span style={{ marginLeft: 'auto', color: 'var(--text-warning)', fontSize: 12 }}>→</span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid #1e293b',
          padding: '6px 14px',
          display: 'flex', gap: 16,
          fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)',
        }}>
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>⌘K / ctrl+K toggle</span>
          <span style={{ marginLeft: 'auto' }}>{results.length} results</span>
        </div>
      </div>
    </div>
  )
}
