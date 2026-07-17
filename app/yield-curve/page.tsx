'use client'
import { useEffect, useState } from 'react'
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts'
import PanelWrapper from '@/components/panels/PanelWrapper'

interface MaturityPoint { label: string; value: number | null; prev: number | null; change: number | null; months: number }
interface Spreads { '10Y-2Y': number | null; '10Y-3M': number | null; '30Y-5Y': number | null; '5Y-2Y': number | null }
interface HistPoint { date: string; y10: number | null; y2: number | null; y3m: number | null; spread_10_2: number | null; spread_10_3m: number | null }

function SpreadBadge({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null
  const inv = value < 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 14px', background: inv ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${inv ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`, borderRadius: 4, minWidth: 100 }}>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 16, fontWeight: 700, color: inv ? 'var(--text-negative)' : 'var(--text-positive)' }}>
        {value >= 0 ? '+' : ''}{value.toFixed(2)}%
      </span>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.06em', marginTop: 2 }}>{label} SPREAD</span>
      {inv && <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--text-negative)', marginTop: 2 }}>⚠ INVERTED</span>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-panel)', border: '1px solid #1e293b', padding: '8px 12px', fontFamily: 'IBM Plex Mono', fontSize: 10 }}>
      <div style={{ color: 'var(--text-accent)', marginBottom: 4, fontWeight: 700 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value !== null ? `${p.value?.toFixed(3)}%` : 'N/A'}
        </div>
      ))}
    </div>
  )
}

export default function YieldCurvePage() {
  const [curve,    setCurve]   = useState<MaturityPoint[]>([])
  const [spreads,  setSpreads] = useState<Spreads | null>(null)
  const [history,  setHistory] = useState<HistPoint[]>([])
  const [loading,  setLoading] = useState(true)
  const [histLoad, setHistLoad]= useState(true)
  const [error,    setError]   = useState<string|null>(null)
  const [tab,      setTab]     = useState<'curve'|'spreads'>('curve')

  useEffect(() => {
    fetch('/api/yield-curve?mode=current')
      .then(r => r.json())
      .then(json => {
        if (json.error) { setError(json.error); return }
        setCurve(json.data.curve)
        setSpreads(json.data.spreads)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))

    fetch('/api/yield-curve?mode=history')
      .then(r => r.json())
      .then(json => { if (json.data) setHistory(json.data) })
      .finally(() => setHistLoad(false))
  }, [])

  const curveChartData = curve.map(m => ({ name: m.label, yield: m.value }))
  const inverted10_2   = (spreads?.['10Y-2Y'] ?? 1) < 0
  const inverted10_3m  = (spreads?.['10Y-3M'] ?? 1) < 0

  return (
    <div style={{ padding: 8, height: '100%', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(90deg, #0d1526, #070e1b)', border: '1px solid #1e293b', borderLeft: '2px solid #38bdf8', padding: '6px 14px' }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, fontWeight: 700, color: 'var(--text-accent)', letterSpacing: '0.08em', textShadow: '0 0 12px rgba(56,189,248,0.4)' }}>
          US TREASURY YIELD CURVE
        </span>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)' }}>Source: FRED / Federal Reserve</span>
        {(inverted10_2 || inverted10_3m) && (
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, fontWeight: 700, color: 'var(--text-negative)', padding: '2px 8px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 3 }}>
            ⚠ YIELD CURVE INVERTED — RECESSION SIGNAL
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {(['curve', 'spreads'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, padding: '2px 10px', border: '1px solid', borderRadius: 3, cursor: 'pointer', background: tab === t ? 'rgba(56,189,248,0.1)' : 'transparent', color: tab === t ? 'var(--text-accent)' : 'var(--text-muted)', borderColor: tab === t ? 'var(--text-accent)' : 'var(--border-color)' }}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Spreads row */}
      <div style={{ display: 'flex', gap: 8 }}>
        {spreads && Object.entries(spreads).map(([k, v]) => <SpreadBadge key={k} label={k} value={v} />)}
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 8 }}>
        {/* Left: current curve + table */}
        <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PanelWrapper title="CURRENT YIELD CURVE" loading={loading} error={error} accentColor="#38bdf8">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={curveChartData}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="2 4" />
                <XAxis dataKey="name" tick={{ fontFamily: 'IBM Plex Mono', fontSize: 9, fill: 'var(--text-muted)' }} />
                <YAxis domain={['auto','auto']} tick={{ fontFamily: 'IBM Plex Mono', fontSize: 9, fill: 'var(--text-muted)' }} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="yield" stroke="#38bdf8" fill="rgba(56,189,248,0.08)" strokeWidth={2} dot={{ fill: 'var(--text-accent)', r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>

            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>MATURITY</th>
                  <th>YIELD</th>
                  <th>CHANGE</th>
                </tr>
              </thead>
              <tbody>
                {curve.map(m => (
                  <tr key={m.label}>
                    <td style={{ textAlign: 'left', color: 'var(--text-accent)', fontWeight: 700 }}>{m.label}</td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{m.value !== null ? `${m.value.toFixed(3)}%` : '—'}</td>
                    <td style={{ color: m.change !== null ? (m.change >= 0 ? 'var(--text-positive)' : 'var(--text-negative)') : 'var(--text-muted)' }}>
                      {m.change !== null ? `${m.change >= 0 ? '+' : ''}${m.change.toFixed(3)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PanelWrapper>
        </div>

        {/* Right: historical */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PanelWrapper title="HISTORICAL YIELDS (2Y / 10Y)" loading={histLoad} accentColor="#a78bfa">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history.slice(-252)}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="2 4" />
                <XAxis dataKey="date" tick={{ fontFamily: 'IBM Plex Mono', fontSize: 8, fill: 'var(--text-muted)' }} tickFormatter={v => v.slice(5)} />
                <YAxis domain={['auto','auto']} tick={{ fontFamily: 'IBM Plex Mono', fontSize: 9, fill: 'var(--text-muted)' }} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="y10" name="10Y" stroke="#38bdf8" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="y2"  name="2Y"  stroke="#a78bfa" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="y3m" name="3M"  stroke="#f59e0b" strokeWidth={1}   dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </PanelWrapper>

          <PanelWrapper title="10Y-2Y SPREAD (Recession Indicator)" loading={histLoad} accentColor="#ef4444">
            <div style={{ padding: '4px 8px', fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>
              When spread {"<"} 0 (inverted): historically precedes recession by 12-18 months
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={history.slice(-252)}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="2 4" />
                <XAxis dataKey="date" tick={{ fontFamily: 'IBM Plex Mono', fontSize: 8, fill: 'var(--text-muted)' }} tickFormatter={v => v.slice(5)} />
                <YAxis domain={['auto','auto']} tick={{ fontFamily: 'IBM Plex Mono', fontSize: 9, fill: 'var(--text-muted)' }} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 2" />
                <Area type="monotone" dataKey="spread_10_2" name="10Y-2Y"
                  stroke="#38bdf8" fill="url(#spreadGrad)" strokeWidth={1.5}
                  dot={false}
                />
                <defs>
                  <linearGradient id="spreadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="50%" stopColor="#ef4444" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
              </AreaChart>
            </ResponsiveContainer>
          </PanelWrapper>
        </div>
      </div>
    </div>
  )
}
