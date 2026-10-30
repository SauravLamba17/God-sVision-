'use client'
import { useEffect, useRef, useState } from 'react'

interface AIPanelProps {
  panelData: unknown
  panelName: string
  context?: string
  onClose: () => void
}

export default function AIPanel({ panelData, panelName, context, onClose }: AIPanelProps) {
  const [text, setText] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const cursorRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const res = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker: panelName, data: panelData, context, mode: 'USA' }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'AI analysis failed' }))
          setError(err.error || 'AI analysis failed')
          setDone(true)
          return
        }

        const reader = res.body?.getReader()
        if (!reader) return

        const decoder = new TextDecoder()

        while (true) {
          const { value, done: streamDone } = await reader.read()
          if (streamDone || cancelled) break
          const chunk = decoder.decode(value, { stream: true })
          if (chunk) setText(prev => prev + chunk)
        }
        if (!cancelled) setDone(true)
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Connection failed')
        setDone(true)
      }
    }

    run()
    return () => { cancelled = true }
  }, [panelData, panelName, context])

  // Suppress unused ref warning
  void cursorRef

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [text])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'var(--overlay)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: 'min(720px, 90vw)',
        maxHeight: '70vh',
        border: 'var(--bw) solid var(--border)',
        borderTop: 'var(--stripe) solid var(--stripe-color)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        background: 'var(--surface)',
        display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow)',
      }}>
        {/* Header */}
        <div style={{
          borderBottom: 'var(--bw) solid var(--divider)',
          padding: '10px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text)', fontSize: 'var(--fs-header)', fontWeight: 700 }}>
              ⚡ AI ANALYSIS — {panelName.toUpperCase()}
            </span>
            {!done && (
              <span style={{
                fontSize: 9, color: 'var(--text-positive)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'var(--text-positive)', animation: 'pulseLive 1s ease-in-out infinite' }} />
                STREAMING
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="gv-icon-btn" style={{ fontSize: 16 }}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div
          ref={containerRef}
          style={{
            flex: 1, overflow: 'auto', padding: '16px',
            fontSize: 12, lineHeight: 1.8,
            color: 'var(--text-2)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {error ? (
            <span style={{ color: 'var(--text-negative)' }}>⚠ {error}</span>
          ) : (
            <>
              {text}
              {!done && <span style={{ color: 'var(--text-accent)', animation: 'blink 1s step-end infinite' }}>▋</span>}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: 'var(--bw) solid var(--divider)',
          padding: '6px 16px',
          fontSize: 9, color: 'var(--text-muted)',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>Powered by Gemini · GOD's Vision AI</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  )
}
