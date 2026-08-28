'use client'
import { useEffect, useState, useRef } from 'react'
import PanelWrapper from './PanelWrapper'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface Quote {
  symbol: string
  shortName?: string
  regularMarketPrice: number
  regularMarketChange: number
  regularMarketChangePercent: number
  regularMarketVolume: number
  marketCap?: number
}

export default function MarketPanel() {
  const [gainers, setGainers] = useState<Quote[]>([])
  const [losers, setLosers] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState('live')
  const prevPrices = useRef<Record<string, number>>({})
  const [flashCells, setFlashCells] = useState<Record<string, 'green' | 'red' | null>>({})

  const fetchData = async () => {
    try {
      const res = await fetch('/api/stocks?type=movers')
      const json = await res.json()
      if (json.data) {
        const newFlash: Record<string, 'green' | 'red' | null> = {}
        const allQuotes = [...(json.data.gainers || []), ...(json.data.losers || [])]
        allQuotes.forEach((q: Quote) => {
          const prev = prevPrices.current[q.symbol]
          if (prev !== undefined && prev !== q.regularMarketPrice) {
            newFlash[q.symbol] = q.regularMarketPrice > prev ? 'green' : 'red'
          }
          prevPrices.current[q.symbol] = q.regularMarketPrice
        })
        setFlashCells(newFlash)
        setTimeout(() => setFlashCells({}), 400)
        setGainers(json.data.gainers || [])
        setLosers(json.data.losers || [])
        setSource(json.source)
        setError(null)
      }
    } catch (e) {
      setError('Failed to fetch market data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 60000)
    return () => clearInterval(id)
  }, [])

  const renderTable = (data: Quote[], label: string, positive: boolean) => (
    <div>
      <div className="font-mono text-[10px] px-2 py-1" style={{ color: positive ? 'var(--text-positive)' : 'var(--text-negative)', borderBottom: '1px solid #1b2e1b' }}>
        ▲ TOP {label}
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>TICKER</th>
            <th>PRICE</th>
            <th>CHG%</th>
            <th>VOL</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 8).map(q => (
            <tr
              key={q.symbol}
              className={flashCells[q.symbol] === 'green' ? 'cell-flash-green' : flashCells[q.symbol] === 'red' ? 'cell-flash-red' : ''}
            >
              <td style={{ textAlign: 'left' }}>
                <span className="text-accent font-bold">{q.symbol}</span>
                {q.shortName && <span className="text-muted ml-1 text-[9px]">{q.shortName?.slice(0, 12)}</span>}
              </td>
              <td className="font-mono">{formatCurrency(q.regularMarketPrice)}</td>
              <td className={q.regularMarketChangePercent >= 0 ? 'positive' : 'negative'}>
                {formatPercent(q.regularMarketChangePercent)}
              </td>
              <td className="text-neutral">{formatVolume(q.regularMarketVolume)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <PanelWrapper title="MARKET MOVERS" loading={loading} error={error} source={source} onRefresh={fetchData}>
      <div className="grid-2">
        {renderTable(gainers, 'GAINERS', true)}
        {renderTable(losers, 'LOSERS', false)}
      </div>
    </PanelWrapper>
  )
}

function formatVolume(v: number): string {
  if (!v) return 'N/A'
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return String(v)
}
