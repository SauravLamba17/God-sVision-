'use client'
import { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

interface YieldPoint {
  label: string
  value: number | null
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: unknown[]; label?: string }) => {
  if (!active || !payload?.length) return null
  const val = (payload[0] as { value?: number })?.value
  return (
    <div style={{ background: 'var(--bg-terminal)', border: '1px solid #1b2e1b', padding: '6px 10px', fontFamily: 'IBM Plex Mono' }}>
      <p style={{ color: '#546e7a', fontSize: 10 }}>{label}</p>
      <p style={{ color: 'var(--text-accent)', fontSize: 12 }}>{val?.toFixed(3)}%</p>
    </div>
  )
}

export default function YieldCurve() {
  const [data, setData] = useState<YieldPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [inverted, setInverted] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/macro?type=yield_curve')
        const json = await res.json()
        if (json.data) {
          const valid = json.data.filter((p: YieldPoint) => p.value !== null)
          setData(valid)
          if (valid.length >= 2) {
            const short = valid.find((p: YieldPoint) => p.label === '2Y')?.value
            const long = valid.find((p: YieldPoint) => p.label === '10Y')?.value
            if (short && long) setInverted(short > long)
          }
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    fetchData()
    const id = setInterval(fetchData, 3600000)
    return () => clearInterval(id)
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-32">
      <span className="font-mono text-[11px] text-positive">LOADING<span className="blink-cursor" /></span>
    </div>
  )

  return (
    <div>
      <div className="panel-header">
        <span className="panel-header-title">US TREASURY YIELD CURVE</span>
        <span className={`font-mono text-[10px] ${inverted ? 'text-negative' : 'text-positive'}`}>
          {inverted ? 'âš  INVERTED (RECESSION SIGNAL)' : 'âœ“ NORMAL'}
        </span>
      </div>
      <div className="p-2">
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 30 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#0d1f0d" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#546e7a', fontSize: 9, fontFamily: 'IBM Plex Mono' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-color)' }}
            />
            <YAxis
              tick={{ fill: '#546e7a', fontSize: 9, fontFamily: 'IBM Plex Mono' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v.toFixed(1)}%`}
              width={32}
            />
            <Tooltip content={(props) => <CustomTooltip active={props.active} payload={props.payload as unknown[] | undefined} label={props.label} />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={inverted ? 'var(--text-negative)' : 'var(--text-positive)'}
              fill={inverted ? '#ff174420' : '#00e67620'}
              strokeWidth={2}
              dot={{ fill: inverted ? 'var(--text-negative)' : 'var(--text-positive)', r: 3 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-4 mt-1">
          {data.map(p => (
            <div key={p.label} className="text-center">
              <div className="font-mono text-[9px] text-muted">{p.label}</div>
              <div className="font-mono text-[10px] text-accent">{p.value?.toFixed(2)}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
