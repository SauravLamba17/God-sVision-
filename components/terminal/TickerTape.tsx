'use client'
import { useEffect, useState } from 'react'
import { formatPercent } from '@/lib/utils'

interface TickerItem {
  symbol: string
  price: number
  change: number
  changePct: number
}


export default function TickerTape() {
  // Empty until live quotes arrive. A hardcoded 2024 tape (SPY 543.27, BTC
  // 67,234…) used to show first and stayed whenever the fetch failed.
  const [tickers, setTickers] = useState<TickerItem[]>([])

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
        // keep the last live tape (or none)
      }
    }
    fetchTickers()
    const interval = setInterval(fetchTickers, 60000)
    return () => clearInterval(interval)
  }, [])

  const doubled = [...tickers, ...tickers]
  if (!tickers.length) return <div style={{ flex: 1, margin: '0 12px' }} />

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
