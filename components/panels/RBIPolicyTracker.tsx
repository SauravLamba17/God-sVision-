'use client'
import { useEffect, useState } from 'react'

interface MacroData {
  repoRate: number
  reverseRepoRate: number
  crrRate: number
  slrRate: number
  rbiStance: string
  lastPolicyAction: string
  rateHistory: { date: string; rate: number; action: string }[]
  nextMPC: { date: string; resolution: string; daysAway: number }
  fetchedAt: number
}

export default function RBIPolicyTracker() {
  const [data, setData] = useState<MacroData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/india/macro')
        const j = await res.json()
        if (j.data) setData(j.data)
      } finally { setLoading(false) }
    }
    load()
    const id = setInterval(load, 3_600_000)
    return () => clearInterval(id)
  }, [])

  if (loading) return (
    <div style={{ padding: 12, fontFamily: 'IBM Plex Mono', fontSize: 'var(--fs-body)', color: '#FF9933' }}>
      LOADING RBI DATA...
    </div>
  )
  if (!data) return null

  const stanceColor = data.rbiStance === 'HAWKISH' ? 'var(--text-negative)' : data.rbiStance === 'DOVISH' ? 'var(--text-positive)' : 'var(--text-warning)'
  const minRate = Math.min(...data.rateHistory.map(r => r.rate))
  const maxRate = Math.max(...data.rateHistory.map(r => r.rate))
  const rateRange = maxRate - minRate || 1

  return (
    <div style={{ fontFamily: 'IBM Plex Mono', border: '1px solid #1e293b', borderLeft: '2px solid #FF9933', background: 'var(--bg-panel)', width: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ padding: '5px 10px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-header)' }}>
        <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: '#FF9933', letterSpacing: '0.08em' }}>🏦 RBI POLICY TRACKER</span>
        <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>MPC · {data.nextMPC.daysAway}d to next</span>
      </div>

      <div style={{ padding: '8px 10px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8 }}>
        {/* Rates */}
        <div>
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.08em' }}>KEY RATES</div>
          {[
            { label: 'Repo Rate',         value: data.repoRate,        unit: '%' },
            { label: 'Reverse Repo',      value: data.reverseRepoRate, unit: '%' },
            { label: 'CRR',               value: data.crrRate,         unit: '%' },
            { label: 'SLR',               value: data.slrRate,         unit: '%' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>{item.label}</span>
              <span style={{ fontSize: 'var(--fs-meta)', fontWeight: 700, color: '#FF9933' }}>{item.value.toFixed(2)}{item.unit}</span>
            </div>
          ))}
        </div>

        {/* Stance + Next Meeting */}
        <div>
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.08em' }}>STANCE</div>
          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: stanceColor, marginBottom: 8 }}>{data.rbiStance}</div>
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.08em' }}>NEXT MPC</div>
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-primary)' }}>{new Date(data.nextMPC.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', marginTop: 2 }}>Resolution: {new Date(data.nextMPC.resolution).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
          <div style={{ fontSize: 'var(--fs-meta)', color: '#FF9933', marginTop: 4 }}>{data.nextMPC.daysAway}d away</div>
        </div>
      </div>

      {/* Rate History mini bar chart */}
      <div style={{ padding: '0 10px 10px', borderTop: '1px solid #1b2e1b' }}>
        <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', margin: '6px 0 4px', letterSpacing: '0.08em' }}>RATE HISTORY (last 6)</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 28 }}>
          {data.rateHistory.slice().reverse().map((r, i) => {
            const h = Math.max(4, ((r.rate - minRate) / rateRange) * 24 + 4)
            const col = r.action === 'HIKE' ? 'var(--text-negative)' : r.action === 'CUT' ? 'var(--text-positive)' : 'var(--text-warning)'
            return (
              <div key={i} title={`${r.date}: ${r.rate}% (${r.action})`}
                style={{ flex: 1, background: col, height: h, borderRadius: '2px 2px 0 0', opacity: 0.8 + i * 0.03 }} />
            )
          })}
        </div>
        <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', marginTop: 2 }}>{data.lastPolicyAction}</div>
      </div>
    </div>
  )
}
