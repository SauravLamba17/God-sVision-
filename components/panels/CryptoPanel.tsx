'use client'
import { useEffect, useState } from 'react'
import PanelWrapper from './PanelWrapper'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'

interface Coin {
  id: string
  symbol: string
  name: string
  current_price: number
  price_change_percentage_24h: number
  price_change_percentage_7d_in_currency: number
  market_cap: number
  total_volume: number
  image: string
  market_cap_rank: number
}

export default function CryptoPanel() {
  const [coins, setCoins] = useState<Coin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState('live')

  const fetchData = async () => {
    try {
      const res = await fetch('/api/crypto?type=top100')
      const json = await res.json()
      if (json.data) {
        setCoins(json.data.slice(0, 10))
        setSource(json.source)
        setError(null)
      }
    } catch (e) {
      setError('Failed to fetch crypto data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 60000)
    return () => clearInterval(id)
  }, [])

  return (
    <PanelWrapper title="CRYPTO TOP 10" loading={loading} error={error} source={source} onRefresh={fetchData}>
      <table className="data-table" style={{ width: '100%', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', width: '8%' }}>#</th>
            <th style={{ textAlign: 'left', width: '28%' }}>COIN</th>
            <th style={{ width: '20%' }}>PRICE</th>
            <th style={{ width: '16%' }}>24H%</th>
            <th style={{ width: '14%' }}>7D%</th>
            <th style={{ width: '14%' }}>MKT CAP</th>
          </tr>
        </thead>
        <tbody>
          {coins.map(coin => (
            <tr key={coin.id}>
              <td style={{ textAlign: 'left' }} className="text-muted">{coin.market_cap_rank}</td>
              <td style={{ textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span className="text-accent font-bold">{coin.symbol.toUpperCase()}</span>
                <span className="text-muted ml-1 text-[11px]">{coin.name.slice(0, 10)}</span>
              </td>
              <td className="font-mono">
                {coin.current_price >= 1
                  ? formatCurrency(coin.current_price)
                  : `$${coin.current_price.toFixed(6)}`
                }
              </td>
              <td className={coin.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}>
                {formatPercent(coin.price_change_percentage_24h)}
              </td>
              <td className={coin.price_change_percentage_7d_in_currency >= 0 ? 'positive' : 'negative'}>
                {formatPercent(coin.price_change_percentage_7d_in_currency)}
              </td>
              <td className="text-neutral font-mono">{formatNumber(coin.market_cap)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PanelWrapper>
  )
}
