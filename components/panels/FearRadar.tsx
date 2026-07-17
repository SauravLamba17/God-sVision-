'use client'
import { useEffect, useRef, useState } from 'react'

interface FearSignal {
  name: string
  weight: number
  rawValue: number
  score: number
  label: string
}

interface FearRadarData {
  score: number
  label: string
  signals: FearSignal[]
  timestamp: number
}

const ZONE_COLORS = [
  { from: 0, to: 20, color: 'var(--text-positive)', label: 'EXTREME GREED' },
  { from: 20, to: 40, color: '#86efac', label: 'GREED' },
  { from: 40, to: 60, color: 'var(--text-warning)', label: 'NEUTRAL' },
  { from: 60, to: 80, color: '#fb923c', label: 'FEAR' },
  { from: 80, to: 100, color: 'var(--text-negative)', label: 'EXTREME FEAR' },
]

function getColor(score: number): string {
  return ZONE_COLORS.find(z => score <= z.to)?.color ?? 'var(--text-negative)'
}

function polarToXY(angleDeg: number, r: number, cx: number, cy: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToXY(startAngle, r, cx, cy)
  const end = polarToXY(endAngle, r, cx, cy)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

// Gauge goes from -150° to +150° (total 300°), starts at left (-150 = bottom-left)
const GAUGE_START = -150
const GAUGE_END = 150
const TOTAL_ARC = 300

function scoreToAngle(score: number): number {
  return GAUGE_START + (score / 100) * TOTAL_ARC
}

function GaugeArc({ cx, cy, r, score }: { cx: number; cy: number; r: number; score: number }) {
  return (
    <g>
      {/* Background arc */}
      <path d={describeArc(cx, cy, r, GAUGE_START, GAUGE_END)} fill="none" stroke="#1b2e1b" strokeWidth={14} />
      {/* Colored zones */}
      {ZONE_COLORS.map(z => (
        <path
          key={z.label}
          d={describeArc(cx, cy, r, GAUGE_START + (z.from / 100) * TOTAL_ARC, GAUGE_START + (z.to / 100) * TOTAL_ARC)}
          fill="none"
          stroke={z.color}
          strokeWidth={14}
          opacity={0.35}
        />
      ))}
      {/* Score arc */}
      <path
        d={describeArc(cx, cy, r, GAUGE_START, scoreToAngle(score))}
        fill="none"
        stroke={getColor(score)}
        strokeWidth={14}
        strokeLinecap="round"
      />
    </g>
  )
}

function Needle({ cx, cy, r, score }: { cx: number; cy: number; r: number; score: number }) {
  const angle = scoreToAngle(score)
  const tip = polarToXY(angle, r - 10, cx, cy)
  const base1 = polarToXY(angle + 90, 8, cx, cy)
  const base2 = polarToXY(angle - 90, 8, cx, cy)
  return (
    <g style={{ transition: 'all 1s ease' }}>
      <polygon
        points={`${tip.x},${tip.y} ${base1.x},${base1.y} ${base2.x},${base2.y}`}
        fill={getColor(score)}
        opacity={0.9}
      />
      <circle cx={cx} cy={cy} r={6} fill="#0f172a" stroke={getColor(score)} strokeWidth={2} />
    </g>
  )
}

export default function FearRadar({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<FearRadarData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/fear-radar')
        const j = await res.json()
        if (j.data) setData(j.data)
      } catch { /* network/parse errors — silently degrade */ }
      finally { setLoading(false) }
    }
    load()
    const id = setInterval(load, 300000) // 5 min
    return () => clearInterval(id)
  }, [])

  if (loading) return (
    <div style={{ padding: compact ? 8 : 16, fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-accent)' }}>
      LOADING FEAR INDEX...
    </div>
  )

  if (!data) return null

  const cx = 120, cy = 110, r = 80
  const W = 240, H = compact ? 150 : 210

  return (
    <div style={{ fontFamily: 'IBM Plex Mono' }}>
      {!compact && (
        <div style={{ padding: '6px 10px', borderBottom: '1px solid #1b2e1b', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>FEAR RADAR — 5-SIGNAL INDEX</span>
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{new Date(data.timestamp).toLocaleTimeString()}</span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: compact ? 'center' : 'flex-start', gap: 8, padding: compact ? 4 : 0 }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <GaugeArc cx={cx} cy={cy} r={r} score={data.score} />
          <Needle cx={cx} cy={cy} r={r} score={data.score} />
          {/* Zone labels */}
          {!compact && ZONE_COLORS.map(z => {
            const midAngle = GAUGE_START + ((z.from + z.to) / 2 / 100) * TOTAL_ARC
            const pos = polarToXY(midAngle, r + 22, cx, cy)
            return (
              <text key={z.label} x={pos.x} y={pos.y} textAnchor="middle" fontSize={7} fill={z.color} opacity={0.7}
                transform={`rotate(${midAngle}, ${pos.x}, ${pos.y})`}>
                {z.from}
              </text>
            )
          })}
          {/* Score display */}
          <text x={cx} y={cy + 30} textAnchor="middle" fontSize={compact ? 22 : 28} fontWeight={700}
            fill={getColor(data.score)} fontFamily="IBM Plex Mono">
            {data.score}
          </text>
          <text x={cx} y={cy + (compact ? 44 : 50)} textAnchor="middle" fontSize={compact ? 7 : 8}
            fill={getColor(data.score)} fontFamily="IBM Plex Mono" letterSpacing="0.1em">
            {data.label}
          </text>
        </svg>
        {!compact && (
          <div style={{ flex: 1, paddingTop: 8 }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.1em' }}>SIGNAL BREAKDOWN</div>
            {data.signals.map(sig => (
              <div key={sig.name} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{sig.name}</span>
                  <span style={{ fontSize: 9, color: getColor(sig.score) }}>{sig.label}</span>
                </div>
                <div style={{ height: 3, background: 'var(--border-color)', borderRadius: 2, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${sig.score}%`, background: getColor(sig.score), borderRadius: 2, transition: 'width 1s ease' }} />
                </div>
                <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 1 }}>{Math.round(sig.weight * 100)}% weight · score {sig.score}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
