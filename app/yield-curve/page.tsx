'use client'
import { useEffect, useState } from 'react'
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts'
import PanelWrapper from '@/components/panels/PanelWrapper'
import { arrow, pct, signed } from '@/lib/format'

interface MaturityPoint { label: string; value: number | null; prev: number | null; change: number | null; months: number }
interface Spreads { '10Y-2Y': number | null; '10Y-3M': number | null; '30Y-5Y': number | null; '5Y-2Y': number | null }
interface HistPoint { date: string; y10: number | null; y2: number | null; y3m: number | null; spread_10_2: number | null; spread_10_3m: number | null }

function SpreadBadge({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null
  const inv = value < 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 14px', background: inv ? 'var(--down-soft)' : 'var(--up-soft)', border: `var(--bw) solid ${inv ? 'var(--down)' : 'var(--up)'}`, borderRadius: 'var(--radius-inner)', minWidth: 100 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: inv ? 'var(--text-negative)' : 'var(--text-positive)' }}>
        {pct(value, 2)}
      </span>
      <span style={{ fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.06em', marginTop: 2 }}>{label} SPREAD</span>
      {inv && <span style={{ fontSize: 8, color: 'var(--text-negative)', marginTop: 2 }}>⚠ INVERTED</span>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--surface-2)', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius-inner)', padding: '8px 12px', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
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
  const [curveSource, setCurveSource] = useState<string | undefined>() // API status → PanelWrapper badge
  const [histSource, setHistSource] = useState<string | undefined>() // API status → PanelWrapper badge
  const [histLoad, setHistLoad]= useState(true)
  const [error,    setError]   = useState<string|null>(null)
  const [tab,      setTab]     = useState<'curve'|'spreads'>('curve')

  useEffect(() => {
    fetch('/api/yield-curve?mode=current')
      .then(r => r.json())
      .then(json => {
        setCurveSource(json.source)
        if (json.error) { setError(json.error); return }
        setCurve(json.data.curve)
        setSpreads(json.data.spreads)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))

    fetch('/api/yield-curve?mode=history')
      .then(r => r.json())
      .then(json => { setHistSource(json.source); if (json.data) setHistory(json.data) })
      .catch(() => { /* history chart shows its empty state */ })
      .finally(() => setHistLoad(false))
  }, [])

  const curveChartData = curve.map(m => ({ name: m.label, yield: m.value }))
  const inverted10_2   = (spreads?.['10Y-2Y'] ?? 1) < 0
  const inverted10_3m  = (spreads?.['10Y-3M'] ?? 1) < 0

  return (
    <div style={{ padding: 8, height: '100%', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
      {/* Header */}
      <div className="gv-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', flexWrap: 'wrap', flexShrink: 0 }}>
        <span style={{ fontSize: 'var(--fs-header)', fontWeight: 'var(--fw-bold)', color: 'var(--text)' }}>
          US TREASURY YIELD CURVE
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Source: FRED / Federal Reserve</span>
        {(inverted10_2 || inverted10_3m) && (
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-negative)', padding: '2px 8px', background: 'var(--down-soft)', border: 'var(--bw) solid var(--down)', borderRadius: 4 }}>
            ⚠ YIELD CURVE INVERTED — RECESSION SIGNAL
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {(['curve', 'spreads'] as const).map(t => (
            <button key={t} type="button" className="gv-tab" aria-pressed={tab === t} onClick={() => setTab(t)}>
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
          <PanelWrapper title="CURRENT YIELD CURVE" loading={loading} error={error} source={curveSource}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={curveChartData}>
                <CartesianGrid stroke="var(--divider)" strokeDasharray="2 4" />
                <XAxis dataKey="name" tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text-muted)' }} />
                <YAxis domain={['auto','auto']} tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text-muted)' }} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="yield" stroke="var(--accent-text)" fill="var(--accent-soft)" strokeWidth={2} dot={{ fill: 'var(--text-accent)', r: 3 }} />
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
                      {m.change !== null ? `${arrow(m.change, 3)}${signed(m.change, 3)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PanelWrapper>
        </div>

        {/* Right: historical */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PanelWrapper title="HISTORICAL YIELDS (2Y / 10Y)" loading={histLoad} source={histSource}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history.slice(-252)}>
                <CartesianGrid stroke="var(--divider)" strokeDasharray="2 4" />
                <XAxis dataKey="date" tick={{ fontFamily: 'var(--font-mono)', fontSize: 8, fill: 'var(--text-muted)' }} tickFormatter={v => v.slice(5)} />
                <YAxis domain={['auto','auto']} tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text-muted)' }} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="y10" name="10Y" stroke="var(--accent-text)" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="y2"  name="2Y"  stroke="var(--info)" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="y3m" name="3M"  stroke="var(--warning)" strokeWidth={1}   dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </PanelWrapper>

          <PanelWrapper title="10Y-2Y SPREAD (Recession Indicator)" loading={histLoad} source={histSource}>
            <div style={{ padding: '4px 8px', fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>
              When spread {"<"} 0 (inverted): historically precedes recession by 12-18 months
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={history.slice(-252)}>
                <CartesianGrid stroke="var(--divider)" strokeDasharray="2 4" />
                <XAxis dataKey="date" tick={{ fontFamily: 'var(--font-mono)', fontSize: 8, fill: 'var(--text-muted)' }} tickFormatter={v => v.slice(5)} />
                <YAxis domain={['auto','auto']} tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text-muted)' }} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="var(--down)" strokeDasharray="4 2" />
                <Area type="monotone" dataKey="spread_10_2" name="10Y-2Y"
                  stroke="var(--accent-text)" fill="url(#spreadGrad)" strokeWidth={1.5}
                  dot={false}
                />
                <defs>
                  <linearGradient id="spreadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--up)" stopOpacity={0.3}/>
                    <stop offset="50%" stopColor="var(--down)" stopOpacity={0.05}/>
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
