'use client'
import { useEffect, useState, useCallback } from 'react'
import { PanelEmpty } from '@/components/ui/Panel'

// Shape mirrors what NSE actually publishes. The previous version also showed
// "FII Net Debt" and a "YTD ACCUMULATION" block; NSE's cash-market endpoint
// carries neither, and both were hardcoded constants, so they are gone rather
// than rendered from invented numbers.
interface FlowData {
  fiiNetEquity: number
  fiiBuy: number
  fiiSell: number
  diiNetEquity: number
  diiBuy: number
  diiSell: number
  lastUpdated: string
}

const fmtCr = (v: number) => `₹${Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`

function FlowBar({ value, label, buy, sell }: { value: number; label: string; buy: number; sell: number }) {
  const isPos = value >= 0
  const color = isPos ? 'var(--text-positive)' : 'var(--text-negative)'
  const arrow = isPos ? '▲' : '▼'

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color }}>
          {arrow} {isPos ? '+' : '-'}{fmtCr(value)}
        </span>
      </div>
      <div style={{ height: 3, background: 'var(--bg-header)', borderRadius: 2 }}>
        <div style={{
          height: 3, borderRadius: 2,
          // Net flow scaled against the day's gross turnover, so the bar is a
          // real proportion rather than an arbitrary divisor.
          width: `${buy + sell > 0 ? Math.min(100, (Math.abs(value) / (buy + sell)) * 100) : 0}%`,
          background: color, opacity: 0.8,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 'var(--fs-badge)', color: 'var(--text-muted)' }}>Buy {fmtCr(buy)}</span>
        <span style={{ fontSize: 'var(--fs-badge)', color: 'var(--text-muted)' }}>Sell {fmtCr(sell)}</span>
      </div>
    </div>
  )
}

export default function FIIDIIFlow() {
  const [data, setData] = useState<FlowData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/india/fii-dii')
      const j = await res.json()
      setData(j.data ?? null)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 3_600_000)
    return () => clearInterval(id)
  }, [load])

  if (loading) return <PanelEmpty title="📊 FII / DII FLOWS" accent="#FF9933" message="Loading FII/DII data…" />
  if (!data) {
    return (
      <PanelEmpty
        title="📊 FII / DII FLOWS"
        accent="#FF9933"
        message="Live FII/DII data unavailable — NSE did not respond"
        onRetry={load}
      />
    )
  }

  const fiiSentiment = data.fiiNetEquity > 0 ? 'BUYING (Bullish)' : 'SELLING (Bearish)'
  const fiiColor = data.fiiNetEquity > 0 ? 'var(--text-positive)' : 'var(--text-negative)'

  return (
    <div style={{ fontFamily: 'IBM Plex Mono', border: '1px solid #1e293b', borderLeft: '2px solid #FF9933', background: 'var(--bg-panel)', width: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <div style={{ padding: '5px 10px', borderBottom: '1px solid #1e293b', background: 'var(--bg-header)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: '#FF9933', letterSpacing: '0.08em' }}>📊 FII / DII FLOWS</span>
        {/* The date now comes from NSE's own payload, so this label is accurate. */}
        <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>NSE cash mkt · {data.lastUpdated}</span>
      </div>

      <div style={{ padding: '10px 12px' }}>
        <FlowBar value={data.fiiNetEquity} label="FII/FPI Net Equity" buy={data.fiiBuy} sell={data.fiiSell} />
        <FlowBar value={data.diiNetEquity} label="DII Net Equity" buy={data.diiBuy} sell={data.diiSell} />

        <div style={{ marginTop: 8, padding: '4px 6px', background: `${fiiColor}10`, border: `1px solid ${fiiColor}30`, borderRadius: 3 }}>
          <span style={{ fontSize: 'var(--fs-meta)', color: fiiColor }}>
            FII {fiiSentiment} — {data.fiiNetEquity > 0 ? 'bullish for Nifty' : 'bearish pressure on Nifty'}
          </span>
        </div>
      </div>
    </div>
  )
}
