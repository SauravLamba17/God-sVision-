'use client'
import { useEffect, useState } from 'react'
import PanelWrapper from './PanelWrapper'

interface Indicator {
  key: string
  label: string
  value: number | null
  change: number | null
  unit: string
  date: string
}

export default function MacroPanel() {
  const [indicators, setIndicators] = useState<Indicator[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState('live')

  const fetchData = async () => {
    try {
      const res = await fetch('/api/macro')
      const json = await res.json()
      if (json.data) {
        setIndicators(json.data)
        setSource(json.source)
        setError(null)
      }
    } catch {
      setError('Failed to fetch macro data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 3600000)
    return () => clearInterval(id)
  }, [])

  return (
    <PanelWrapper title="US MACRO INDICATORS" loading={loading} error={error} source={source} onRefresh={fetchData}>
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>INDICATOR</th>
            <th>VALUE</th>
            <th>CHG</th>
            <th style={{ textAlign: 'left' }}>DATE</th>
          </tr>
        </thead>
        <tbody>
          {indicators.map(ind => (
            <tr key={ind.key}>
              <td style={{ textAlign: 'left' }}>
                <span className="text-primary">{ind.label}</span>
              </td>
              <td className="font-mono text-accent">
                {ind.value !== null ? `${formatValue(ind.value, ind.unit)}${ind.unit === '%' || ind.unit === 'bps' ? ind.unit : ''}` : 'N/A'}
              </td>
              <td className={ind.change !== null ? (ind.change >= 0 ? 'positive' : 'negative') : 'neutral'}>
                {ind.change !== null ? `${ind.change >= 0 ? '+' : ''}${ind.change.toFixed(2)}` : '—'}
              </td>
              <td style={{ textAlign: 'left' }} className="text-muted text-[9px]">{ind.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PanelWrapper>
  )
}

function formatValue(v: number, unit: string): string {
  if (unit === 'T') return `${(v / 1e12).toFixed(2)}T`
  if (unit === 'B') return `$${(v / 1e9).toFixed(1)}B`
  if (unit === 'K') return `${(v / 1000).toFixed(0)}K`
  return v.toFixed(2)
}
