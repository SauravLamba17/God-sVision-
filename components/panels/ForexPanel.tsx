'use client'
import { useEffect, useState } from 'react'
import PanelWrapper from './PanelWrapper'

const MATRIX_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY']

export default function ForexPanel() {
  const [matrix, setMatrix] = useState<Record<string, Record<string, number>>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState('live')

  const fetchData = async () => {
    try {
      const res = await fetch('/api/forex?type=matrix')
      const json = await res.json()
      if (json.data) {
        setMatrix(json.data)
        setSource(json.source)
        setError(null)
      }
    } catch {
      setError('Failed to fetch forex data')
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
    <PanelWrapper title="FX CROSS RATES" loading={loading} error={error} source={source} onRefresh={fetchData}>
      <div className="overflow-x-auto">
        <table className="data-table text-[11px]">
          <thead>
            <tr>
              <th style={{ textAlign: 'left', width: 40 }}>↓/→</th>
              {MATRIX_CURRENCIES.map(c => (
                <th key={c} className="text-accent">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX_CURRENCIES.map(base => (
              <tr key={base}>
                <td style={{ textAlign: 'left' }}>
                  <span className="text-accent font-bold">{base}</span>
                </td>
                {MATRIX_CURRENCIES.map(quote => {
                  const rate = matrix[base]?.[quote]
                  const isSame = base === quote
                  return (
                    <td key={quote} className={isSame ? 'text-muted' : 'font-mono text-primary'}>
                      {isSame ? '—' : rate ? (
                        rate >= 100 ? rate.toFixed(2) :
                        rate >= 10 ? rate.toFixed(3) :
                        rate >= 1 ? rate.toFixed(4) :
                        rate.toFixed(4)
                      ) : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelWrapper>
  )
}
