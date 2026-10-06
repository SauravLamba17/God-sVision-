'use client'
import { useEffect, useState } from 'react'
import PanelWrapper from './PanelWrapper'
import { signed } from '@/lib/format'

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
      } else if (json.error) {
        setError(`Macro data unavailable — ${json.error}`)
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
                {ind.change !== null ? formatChange(ind.change, ind.unit) : '—'}
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
  // FRED units: WALCL and RSAFS are in $ millions, HOUST in thousands of units,
  // T10Y2Y in percentage points.
  if (unit === 'T') return `$${(v / 1e6).toFixed(2)}T`
  if (unit === 'B') return `$${(v / 1e3).toFixed(1)}B`
  if (unit === 'K') return `${v.toFixed(0)}K`
  if (unit === 'bps') return (v * 100).toFixed(0)
  return v.toFixed(2)
}

// Same FRED units as formatValue; the raw change printed "+8225.00" for a
// $8.2B move in retail sales.
function formatChange(v: number, unit: string): string {
  // signed(): a change that rounds to zero shows unsigned ("0.00"), never "+0.00"/"-0.00"
  if (unit === 'T' || unit === 'B') return `${signed(v / 1e3, 1)}B`
  if (unit === 'K') return `${signed(v, 0)}K`
  if (unit === 'bps') return `${signed(v * 100, 0)}bps`
  return signed(v, 2)
}
