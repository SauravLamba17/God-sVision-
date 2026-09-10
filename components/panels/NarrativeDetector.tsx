'use client'
import { useEffect, useState } from 'react'

interface Narrative {
  title: string
  description: string
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  intensity: 'HIGH' | 'MEDIUM' | 'LOW'
  relatedTickers: string[]
  headlineCount: number
}

interface NarrativeData {
  narratives: Narrative[]
  generatedAt: number
  headlinesAnalyzed: number
  keyConfigured?: boolean
}

const SENT_COLORS = { BULLISH: 'var(--text-positive)', BEARISH: 'var(--text-negative)', NEUTRAL: 'var(--text-warning)' }
const INT_COLORS = { HIGH: 'var(--text-negative)', MEDIUM: 'var(--text-warning)', LOW: 'var(--text-muted)' }

export default function NarrativeDetector({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<NarrativeData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/narratives')
        const j = await res.json()
        if (j.data) setData(j.data)
      } finally { setLoading(false) }
    }
    load()
    const id = setInterval(load, 900000) // 15 min
    return () => clearInterval(id)
  }, [])

  if (loading) return (
    <div style={{ padding: compact ? 8 : 12, fontFamily: 'IBM Plex Mono', fontSize: 'var(--fs-body)', color: 'var(--text-accent)' }}>
      {compact ? 'DETECTING NARRATIVES...' : 'AI DETECTING MARKET NARRATIVES...'}
    </div>
  )

  if (!data || data.narratives.length === 0) {
    if (data?.keyConfigured === false) return (
      <div style={{ padding: compact ? 8 : 12, fontFamily: 'IBM Plex Mono', fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>
        AI narratives unavailable — GEMINI_API_KEY not configured
      </div>
    )
    return (
      <div style={{ padding: compact ? 8 : 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>
          Analyzing market headlines for emerging narratives...
        </div>
        {[100, 85, 92].map((w, i) => (
          <div key={i} className="skeleton" style={{ height: 10, width: `${w}%`, borderRadius: 2 }} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'IBM Plex Mono' }}>
      {!compact && (
        <div style={{ padding: '6px 10px', borderBottom: '1px solid #1b2e1b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--fs-header)', color: 'var(--text-accent)', letterSpacing: '0.03em', fontWeight: 700 }}>⚡ AI NARRATIVE DETECTOR</span>
          <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>
            {data.headlinesAnalyzed} headlines · {new Date(data.generatedAt).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false })} ET
          </span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 0 : 1 }}>
        {data.narratives.map((n, i) => (
          <div key={i} style={{
            padding: compact ? '6px 8px' : '8px 10px',
            borderBottom: '1px solid #0d1526',
            background: i === 0 ? 'rgba(255,109,0,0.03)' : 'transparent',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: compact ? 0 : 4 }}>
              <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', minWidth: 12 }}>{i + 1}</span>
              <span style={{ fontSize: compact ? 13 : 13, fontWeight: 700, color: SENT_COLORS[n.sentiment], letterSpacing: '0.01em' }}>
                {n.title}
              </span>
              <span style={{ fontSize: 'var(--fs-badge)', color: INT_COLORS[n.intensity], background: `${INT_COLORS[n.intensity]}18`, padding: '1px 4px', borderRadius: 2, marginLeft: 'auto' }}>
                {n.intensity}
              </span>
              <span style={{ fontSize: 'var(--fs-badge)', color: SENT_COLORS[n.sentiment], background: `${SENT_COLORS[n.sentiment]}18`, padding: '1px 4px', borderRadius: 2 }}>
                {n.sentiment}
              </span>
            </div>
            {!compact && (
              <>
                <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', lineHeight: 1.6, marginLeft: 18, marginBottom: 4 }}>{n.description}</div>
                <div style={{ display: 'flex', gap: 4, marginLeft: 18, flexWrap: 'wrap' }}>
                  {n.relatedTickers.map(t => (
                    <span key={t} style={{ fontSize: 'var(--fs-badge)', color: 'var(--text-accent)', background: 'rgba(255,109,0,0.1)', padding: '1px 5px', borderRadius: 2 }}>{t}</span>
                  ))}
                  <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', marginLeft: 4 }}>{n.headlineCount} headlines</span>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
