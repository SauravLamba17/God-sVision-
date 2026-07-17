'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const AIButton = dynamic(() => import('@/components/terminal/AIButton'), { ssr: false })

interface Asset { symbol: string; name: string; type: string }
interface CorrelationData { symbols: string[]; matrix: number[][]; period: number; generatedAt: number }

function corrColor(v: number): string {
  if (v >= 0.7) return 'var(--text-positive)'
  if (v >= 0.4) return '#86efac'
  if (v >= 0.1) return 'var(--text-warning)'
  if (v >= -0.1) return 'var(--text-primary)'
  if (v >= -0.4) return '#fb923c'
  if (v >= -0.7) return 'var(--text-negative)'
  return '#dc2626'
}

function corrBg(v: number): string {
  const abs = Math.abs(v)
  const isPos = v >= 0
  const alpha = Math.round(abs * 80)
  return isPos
    ? `rgba(34,197,94,${alpha / 100})`
    : `rgba(239,68,68,${alpha / 100})`
}

export default function CorrelationPage() {
  const [data, setData] = useState<CorrelationData | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<[number, number] | null>(null)
  const CELL = 58

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/correlation')
        const j = await res.json()
        if (j.data) setData(j.data)
        if (j.assets) setAssets(j.assets)
      } finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ padding: 40, fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--text-accent)', textAlign: 'center' }}>
      COMPUTING 90-DAY PEARSON CORRELATIONS FOR 10 ASSETS...
    </div>
  )

  if (!data) return null

  const { symbols, matrix } = data
  const n = symbols.length
  const W = (n + 1) * CELL + 20

  const selectedCorr = selected ? matrix[selected[0]][selected[1]] : null
  const selectedA = selected ? assets[selected[0]] : null
  const selectedB = selected ? assets[selected[1]] : null

  return (
    <div style={{ fontFamily: 'IBM Plex Mono', background: 'var(--bg-terminal)', minHeight: '100%', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #1b2e1b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-accent)', letterSpacing: '0.1em' }}>CROSS-ASSET CORRELATION MATRIX</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>90-Day Pearson Correlation · {n} Assets · Daily Returns</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Updated: {data ? new Date(data.generatedAt).toLocaleTimeString() : '—'}</span>
          <AIButton panelName="Correlation Matrix" panelData={{ symbols, matrix: matrix.map((row, i) => ({ asset: symbols[i], ...Object.fromEntries(symbols.map((s, j) => [s, row[j]])) })) }} context="Analyze this cross-asset correlation matrix. Identify which pairs are most correlated, most negatively correlated (hedges), and any surprising relationships. What does this tell us about current market regime?" />
        </div>
      </div>

      {/* Legend */}
      <div style={{ padding: '6px 16px', borderBottom: '1px solid #1b2e1b', display: 'flex', gap: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>SCALE:</span>
        {[[-1, 'INVERSE'], [-0.5, 'NEG'], [0, 'NEUTRAL'], [0.5, 'POS'], [1, 'PERFECT']].map(([v, label]) => (
          <span key={label as string} style={{ fontSize: 9, color: corrColor(v as number), background: corrBg(v as number), padding: '1px 6px', borderRadius: 2 }}>
            {label} {v !== undefined ? (v as number).toFixed(1) : ''}
          </span>
        ))}
      </div>

      <div style={{ padding: 16, overflowX: 'auto' }}>
        <svg width={W} height={W} style={{ display: 'block' }}>
          {/* Column headers */}
          {symbols.map((sym, j) => (
            <text key={`col-${j}`} x={CELL + j * CELL + CELL / 2} y={CELL - 6} textAnchor="middle" fontSize={9} fill="#475569" fontFamily="IBM Plex Mono">
              {sym.replace('-USD', '')}
            </text>
          ))}
          {/* Row headers + cells */}
          {symbols.map((sym, i) => (
            <g key={`row-${i}`}>
              <text x={CELL - 4} y={CELL + i * CELL + CELL / 2 + 4} textAnchor="end" fontSize={9} fill="#475569" fontFamily="IBM Plex Mono">
                {sym.replace('-USD', '')}
              </text>
              {symbols.map((_, j) => {
                const v = matrix[i][j]
                const isSelected = selected?.[0] === i && selected?.[1] === j
                return (
                  <g key={`cell-${i}-${j}`} onClick={() => setSelected(i !== j ? [i, j] : null)} style={{ cursor: i !== j ? 'pointer' : 'default' }}>
                    <rect
                      x={CELL + j * CELL + 1}
                      y={CELL + i * CELL + 1}
                      width={CELL - 2}
                      height={CELL - 2}
                      fill={i === j ? 'var(--bg-panel)' : corrBg(v)}
                      stroke={isSelected ? 'var(--text-accent)' : 'var(--bg-header)'}
                      strokeWidth={isSelected ? 2 : 0.5}
                      rx={2}
                    />
                    <text
                      x={CELL + j * CELL + CELL / 2}
                      y={CELL + i * CELL + CELL / 2 + 4}
                      textAnchor="middle"
                      fontSize={i === j ? 8 : 11}
                      fontWeight={i === j ? 400 : 600}
                      fill={i === j ? 'var(--text-muted)' : corrColor(v)}
                      fontFamily="IBM Plex Mono"
                    >
                      {i === j ? sym.replace('-USD', '') : v.toFixed(2)}
                    </text>
                  </g>
                )
              })}
            </g>
          ))}
        </svg>

        {/* Selected pair detail */}
        {selected && selectedA && selectedB && selectedCorr !== null && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-panel)', border: '1px solid #1b2e1b', borderRadius: 4, maxWidth: 600 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>SELECTED PAIR ANALYSIS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedA.symbol.replace('-USD', '')} / {selectedB.symbol.replace('-USD', '')}</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: corrColor(selectedCorr) }}>{selectedCorr.toFixed(2)}</span>
              <span style={{ fontSize: 10, color: corrColor(selectedCorr) }}>
                {selectedCorr >= 0.7 ? 'STRONG POSITIVE' : selectedCorr >= 0.4 ? 'MODERATE POSITIVE' : selectedCorr >= -0.4 ? 'NEUTRAL' : selectedCorr >= -0.7 ? 'MODERATE NEGATIVE' : 'STRONG NEGATIVE'}
              </span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 8 }}>
              {selectedA.name} vs {selectedB.name} — 90-day daily log return Pearson correlation
            </div>
            <AIButton
              panelName={`${selectedA.symbol}/${selectedB.symbol} Correlation`}
              panelData={{ asset1: selectedA, asset2: selectedB, correlation: selectedCorr }}
              context={`Analyze the correlation of ${selectedCorr.toFixed(2)} between ${selectedA.name} (${selectedA.symbol}) and ${selectedB.name} (${selectedB.symbol}) over 90 days. Is this expected? What does it tell us about the current market regime? Is this pair useful as a hedge? Has this relationship changed vs historical norms?`}
              style={{ marginTop: 0 }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
