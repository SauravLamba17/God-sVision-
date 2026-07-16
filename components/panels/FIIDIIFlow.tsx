'use client'
import { useEffect, useState } from 'react'

interface FlowData {
  fiiNetEquity: number
  diiNetEquity: number
  fiiNetDebt: number
  fiiYTDEquity: number
  diiYTDEquity: number
  lastUpdated: string
}

function FlowBar({ value, label }: { value: number; label: string }) {
  const isPos   = value >= 0
  const color   = isPos ? 'var(--text-positive)' : 'var(--text-negative)'
  const arrow   = isPos ? '▲' : '▼'
  const dispVal = Math.abs(value) >= 10000
    ? `₹${(Math.abs(value) / 100).toFixed(0)} Cr`
    : `₹${Math.abs(value).toLocaleString('en-IN')} Cr`

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color }}>
          {arrow} {isPos ? '+' : '-'}{dispVal}
        </span>
      </div>
      <div style={{ height: 3, background: 'var(--bg-header)', borderRadius: 2 }}>
        <div style={{
          height: 3, borderRadius: 2,
          width: `${Math.min(100, Math.abs(value) / 50)}%`,
          background: color, opacity: 0.8,
        }} />
      </div>
    </div>
  )
}

export default function FIIDIIFlow() {
  const [data, setData] = useState<FlowData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/india/macro')
        const j = await res.json()
        if (j.data?.fiiDii) setData(j.data.fiiDii)
      } finally { setLoading(false) }
    }
    load()
    const id = setInterval(load, 3_600_000)
    return () => clearInterval(id)
  }, [])

  if (loading) return <div style={{ padding: 12, fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#FF9933' }}>LOADING FII/DII DATA...</div>
  if (!data) return null

  const fiiSentiment = data.fiiNetEquity > 0 ? 'BUYING (Bullish)' : 'SELLING (Bearish)'
  const fiiColor     = data.fiiNetEquity > 0 ? 'var(--text-positive)' : 'var(--text-negative)'

  return (
    <div style={{ fontFamily: 'IBM Plex Mono', border: '1px solid #1e293b', borderLeft: '2px solid #FF9933', background: 'var(--bg-panel)', width: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <div style={{ padding: '5px 10px', borderBottom: '1px solid #1e293b', background: 'var(--bg-header)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#FF9933', letterSpacing: '0.08em' }}>📊 FII / DII FLOWS</span>
        <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>NSE Data · {data.lastUpdated}</span>
      </div>

      <div style={{ padding: '10px 12px' }}>
        <FlowBar value={data.fiiNetEquity}  label="FII Net Equity (Today)" />
        <FlowBar value={data.diiNetEquity}  label="DII Net Equity (Today)" />
        <FlowBar value={data.fiiNetDebt}    label="FII Net Debt (Today)" />

        <div style={{ borderTop: '1px solid #1b2e1b', marginTop: 8, paddingTop: 8 }}>
          <div style={{ fontSize: 8, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.08em' }}>YTD ACCUMULATION</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>FII YTD</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: data.fiiYTDEquity > 0 ? 'var(--text-positive)' : 'var(--text-negative)' }}>
              {data.fiiYTDEquity > 0 ? '+' : ''}₹{(data.fiiYTDEquity / 100).toFixed(0)} Cr
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>DII YTD</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: data.diiYTDEquity > 0 ? 'var(--text-positive)' : 'var(--text-negative)' }}>
              {data.diiYTDEquity > 0 ? '+' : ''}₹{(data.diiYTDEquity / 100).toFixed(0)} Cr
            </span>
          </div>
        </div>

        <div style={{ marginTop: 8, padding: '4px 6px', background: `${fiiColor}10`, border: `1px solid ${fiiColor}30`, borderRadius: 3 }}>
          <span style={{ fontSize: 8, color: fiiColor }}>FII {fiiSentiment} — {data.fiiNetEquity > 0 ? 'bullish for Nifty' : 'bearish pressure on Nifty'}</span>
        </div>
      </div>
    </div>
  )
}
