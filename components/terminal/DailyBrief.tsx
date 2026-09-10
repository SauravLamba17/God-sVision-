'use client'
import { useEffect, useRef, useState } from 'react'

function isAfter9AmET(): boolean {
  const now = new Date()
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  return etTime.getHours() >= 9
}

export default function DailyBrief() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [triggered, setTriggered] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchBrief = async () => {
    if (loading) return
    setLoading(true)
    setDone(false)
    setText('')
    setError('')

    try {
      const res = await fetch('/api/ai/brief')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.brief) {
        setText(data.brief)
        setDone(true)
      } else if (data.error) {
        setError(data.error)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch brief')
    } finally {
      setLoading(false)
    }
  }

  // Auto-trigger once at 9 AM ET on mount if it's already past 9 AM
  useEffect(() => {
    if (!triggered && isAfter9AmET()) {
      setTriggered(true)
      fetchBrief()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [text])

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div style={{
      border: '1px solid #1e293b',
      borderLeft: '2px solid #f59e0b',
      background: 'linear-gradient(180deg, #0a0f1e 0%, #060d1a 100%)',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(90deg, #0d1526 0%, #070e1b 100%)',
        borderBottom: '1px solid #1e293b',
        padding: '5px 10px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: 'IBM Plex Mono', fontSize: 'var(--fs-body)', fontWeight: 600,
            color: 'var(--text-warning)', letterSpacing: '0.08em',
            textShadow: '0 0 12px rgba(245,158,11,0.4)',
          }}>
            ⚡ AI MORNING BRIEF — {dateStr.toUpperCase()}
          </span>
          {loading && (
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 'var(--fs-meta)', color: 'var(--text-positive)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: 'var(--text-positive)', animation: 'pulseLive 1s infinite' }} />
              GENERATING
            </span>
          )}
        </div>
        <button
          onClick={fetchBrief}
          disabled={loading}
          style={{
            background: 'none', border: '1px solid #f59e0b40', cursor: loading ? 'default' : 'pointer',
            color: loading ? 'var(--text-muted)' : 'var(--text-warning)', fontSize: 'var(--fs-meta)',
            fontFamily: 'IBM Plex Mono', padding: '2px 8px', borderRadius: 2,
            letterSpacing: '0.06em',
          }}
        >
          {loading ? 'GENERATING...' : done ? '↻ REGENERATE' : 'GENERATE BRIEF'}
        </button>
      </div>

      {/* Content */}
      <div
        ref={containerRef}
        style={{
          padding: '12px 14px',
          fontFamily: 'IBM Plex Mono', fontSize: 'var(--fs-body)', lineHeight: 1.9,
          color: 'var(--text-secondary)',
          whiteSpace: 'pre-wrap',
          maxHeight: 180,
          overflowY: 'auto',
          minHeight: 60,
        }}
      >
        {error ? (
          <span style={{ color: 'var(--text-negative)' }}>⚠ {error}</span>
        ) : text ? (
          text
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>
            {isAfter9AmET()
              ? "Click GENERATE BRIEF for today's AI-powered market analysis..."
              : 'Daily brief generates at 9:00 AM ET. Click GENERATE BRIEF to preview now.'}
          </span>
        )}
      </div>

      {done && (
        <div style={{ borderTop: '1px solid #1e293b', padding: '3px 10px', fontFamily: 'IBM Plex Mono', fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>
          Powered by Gemini · GOD's Vision AI · {new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' })} ET
        </div>
      )}
    </div>
  )
}
