'use client'
import { useEffect, useState } from 'react'
import PanelWrapper from '@/components/panels/PanelWrapper'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface Commodity {
  name: string
  ticker: string
  price: number | null
  change: number | null
  changePct: number | null
  currency: string
  unit: string
}

const COMMODITY_GROUPS = {
  Energy: ['WTI', 'BRENT', 'NAT_GAS', 'HEATING_OIL'],
  Metals: ['GOLD', 'SILVER', 'COPPER', 'PLATINUM', 'PALLADIUM'],
  Agriculture: ['CORN', 'WHEAT', 'SOYBEANS'],
}

const COMMODITY_LABELS: Record<string, string> = {
  WTI: 'WTI Crude Oil',
  BRENT: 'Brent Crude Oil',
  NAT_GAS: 'Natural Gas',
  HEATING_OIL: 'Heating Oil',
  GOLD: 'Gold',
  SILVER: 'Silver',
  COPPER: 'Copper',
  PLATINUM: 'Platinum',
  PALLADIUM: 'Palladium',
  CORN: 'Corn',
  WHEAT: 'Wheat',
  SOYBEANS: 'Soybeans',
}

export default function CommoditiesPage() {
  const [data, setData] = useState<Commodity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState('live')

  const fetchData = async () => {
    try {
      const res = await fetch('/api/commodities')
      const json = await res.json()
      if (json.data) {
        setData(json.data)
        setSource(json.source)
        setError(null)
      }
    } catch (e) {
      setError('Failed to fetch commodity data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 300000)
    return () => clearInterval(id)
  }, [])

  const getByName = (name: string) => data.find(d => d.name === name)

  return (
    <div className="p-2 space-y-2">
      {/* Summary Row */}
      <div className="grid grid-cols-4 gap-2">
        {['GOLD', 'WTI', 'SILVER', 'COPPER'].map(name => {
          const c = getByName(name)
          return (
            <div key={name} style={{ border: '1px solid #1b2e1b', background: 'var(--bg-terminal)', padding: '10px 14px' }}>
              <div className="font-mono text-[10px] text-accent font-bold">{COMMODITY_LABELS[name]}</div>
              <div className="font-mono text-[22px] text-primary font-bold leading-tight mt-1">
                {c?.price ? formatCurrency(c.price) : 'N/A'}
              </div>
              <div className={`font-mono text-[11px] ${(c?.changePct || 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                {c?.changePct ? formatPercent(c.changePct) : 'â€”'} | {c?.unit && `per ${c.unit}`}
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {Object.entries(COMMODITY_GROUPS).map(([group, names]) => (
          <PanelWrapper key={group} title={`${group.toUpperCase()} COMMODITIES`} loading={loading} error={error} source={source} onRefresh={fetchData}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>COMMODITY</th>
                  <th>PRICE</th>
                  <th>CHG%</th>
                  <th>UNIT</th>
                </tr>
              </thead>
              <tbody>
                {names.map(name => {
                  const c = getByName(name)
                  return (
                    <tr key={name}>
                      <td style={{ textAlign: 'left' }}>
                        <span className="text-accent font-bold">{name.replace('_', ' ')}</span>
                        <br />
                        <span className="text-muted text-[9px]">{COMMODITY_LABELS[name]}</span>
                      </td>
                      <td className="font-mono">{c?.price ? formatCurrency(c.price) : 'N/A'}</td>
                      <td className={c?.changePct !== null && c?.changePct !== undefined ? (c.changePct >= 0 ? 'positive' : 'negative') : 'neutral'}>
                        {c?.changePct !== null && c?.changePct !== undefined ? formatPercent(c.changePct) : 'â€”'}
                      </td>
                      <td className="text-muted text-[10px]">/{c?.unit || 'â€”'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {group === 'Agriculture' && (
              <div className="px-2 py-2">
                <p className="font-mono text-[9px] text-muted">
                  Agriculture data via Yahoo Finance futures (ZC, ZW, ZS). Real-time agriculture APIs require premium access.
                  Data shown is delayed end-of-day futures prices.
                </p>
              </div>
            )}
          </PanelWrapper>
        ))}
      </div>

      {/* EIA Note */}
      <div style={{ border: '1px solid #1b2e1b', background: 'var(--bg-terminal)', padding: 12 }}>
        <div className="panel-header-title mb-2">EIA ENERGY DATA NOTE</div>
        <p className="font-mono text-[10px] text-muted">
          For detailed EIA petroleum inventory reports, natural gas storage, and weekly refinery data,
          set your EIA_API_KEY in .env.local (free at eia.gov). Current prices shown use Yahoo Finance futures contracts.
        </p>
      </div>
    </div>
  )
}
