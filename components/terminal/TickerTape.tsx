'use client'
import { useEffect, useState } from 'react'
import { formatPercent } from '@/lib/utils'

interface TickerItem {
  symbol: string
  price: number
  change: number
  changePct: number
}

const FALLBACK_TICKERS: TickerItem[] = [
  { symbol: 'SPY', price: 543.27, change: 2.14, changePct: 0.39 },
  { symbol: 'QQQ', price: 470.85, change: 3.21, changePct: 0.69 },
  { symbol: 'BTC', price: 67234.50, change: 892.30, changePct: 1.34 },
  { symbol: 'ETH', price: 3521.40, change: -42.10, changePct: -1.18 },
  { symbol: 'AAPL', price: 192.35, change: 1.25, changePct: 0.65 },
  { symbol: 'MSFT', price: 429.17, change: -2.44, changePct: -0.57 },
  { symbol: 'NVDA', price: 131.38, change: 4.72, changePct: 3.73 },
  { symbol: 'TSLA', price: 248.42, change: -5.18, changePct: -2.04 },
  { symbol: 'EUR/USD', price: 1.0821, change: 0.0012, changePct: 0.11 },
  { symbol: 'GBP/USD', price: 1.2734, change: -0.0034, changePct: -0.27 },
  { symbol: 'GOLD', price: 2381.20, change: 12.40, changePct: 0.52 },
  { symbol: 'OIL', price: 80.34, change: -0.87, changePct: -1.07 },
]

export default function TickerTape() {
  const [tickers, setTickers] = useState<TickerItem[]>(FALLBACK_TICKERS)

  useEffect(() => {
    const fetchTickers = async () => {
      try {
        const res = await fetch('/api/stocks?tickers=SPY,QQQ,AAPL,MSFT,NVDA,GOOGL,AMZN,META,TSLA,JPM')
        const json = await res.json()
        if (json.data) {
          const items: TickerItem[] = json.data.map((q: {
            symbol: string
            regularMarketPrice: number
            regularMarketChange: number
            regularMarketChangePercent: number
          }) => ({
            symbol: q.symbol,
            price: q.regularMarketPrice,
            change: q.regularMarketChange,
            changePct: q.regularMarketChangePercent
          }))
          setTickers(items)
        }
      } catch {
        // use fallback
      }
    }
    fetchTickers()
    const interval = setInterval(fetchTickers, 60000)
    return () => clearInterval(interval)
  }, [])

  const doubled = [...tickers, ...tickers]

  return (
    <div style={{ overflow: 'hidden', flex: 1, margin: '0 12px' }}>
      <div className="ticker-tape" style={{ display: 'flex', alignItems: 'center' }}>
        {doubled.map((item, idx) => (
          <span key={idx} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            marginRight: 20, whiteSpace: 'nowrap',
            fontFamily: 'IBM Plex Mono', fontSize: 'var(--fs-body)',
          }}>
            <span style={{ color: 'var(--text-accent)', fontWeight: 700, letterSpacing: '0.06em' }}>{item.symbol}</span>
            <span style={{ color: 'var(--text-primary)' }}>
              {item.price < 10 ? item.price.toFixed(4) : item.price.toFixed(2)}
            </span>
            <span style={{
              color: item.changePct >= 0 ? 'var(--text-positive)' : 'var(--text-negative)',
              fontSize: 'var(--fs-meta)',
              background: item.changePct >= 0 ? 'var(--bg-live)' : 'var(--bg-sell)',
              padding: '0 4px', borderRadius: 2,
            }}>
              {item.changePct >= 0 ? '▲' : '▼'} {formatPercent(item.changePct)}
            </span>
            <span style={{ color: 'var(--border-bright)', marginLeft: 8, fontSize: 'var(--fs-body)' }}>│</span>
          </span>
        ))}
      </div>
    </div>
  )
}
