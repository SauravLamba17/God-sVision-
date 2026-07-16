'use client'
import { useState, useEffect, ReactNode } from 'react'
import { formatTimestamp } from '@/lib/utils'

interface PanelWrapperProps {
  title: string
  children: ReactNode
  className?: string
  source?: 'live' | 'cached' | 'cache' | 'static' | string
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
  fullHeight?: boolean
  accentColor?: string
  headerExtra?: ReactNode
}

export default function PanelWrapper({
  title,
  children,
  className = '',
  source,
  loading = false,
  error = null,
  onRefresh,
  fullHeight = false,
  accentColor = 'var(--text-accent)',
  headerExtra,
}: PanelWrapperProps) {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    if (!loading && !error) setLastUpdated(new Date())
  }, [loading, error])

  const isCached = source === 'cached' || source === 'cache' || source === 'stale'
  const isLive   = source === 'live'

  // Compute data age badge
  const ageMs   = lastUpdated ? Date.now() - lastUpdated.getTime() : null
  const ageBadge = ageMs === null ? null
    : ageMs < 5 * 60_000  ? { label: '● LIVE',    color: 'var(--text-positive)' }
    : ageMs < 30 * 60_000 ? { label: '● RECENT',  color: 'var(--text-warning)' }
    : { label: '⚠ DELAYED', color: 'var(--text-accent)' }

  return (
    <div
      className={`flex flex-col ${fullHeight ? 'h-full' : ''} ${className}`}
      style={{
        border: '1px solid #1e293b',
        borderLeft: `2px solid ${accentColor}`,
        background: 'linear-gradient(180deg, #0a0f1e 0%, #060d1a 100%)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      {/* Subtle glow in top-left corner from accent color */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: 120, height: 60,
        background: `radial-gradient(ellipse at top left, ${accentColor}0a 0%, transparent 70%)`,
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Header */}
      <div style={{
        background: 'linear-gradient(90deg, #0d1526 0%, #070e1b 100%)',
        borderBottom: '1px solid #1e293b',
        padding: '5px 10px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0, position: 'relative', zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            color: accentColor,
            fontFamily: 'IBM Plex Mono', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            textShadow: `0 0 12px ${accentColor}60`,
          }}>
            {title}
          </span>

          {ageBadge && (
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: ageBadge.color, letterSpacing: '0.06em' }}>
              {ageBadge.label}
            </span>
          )}
          {!ageBadge && isLive && (
            <span className="badge-live">
              <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: 'var(--text-positive)', animation: 'pulseLive 2s ease-in-out infinite' }} />
              LIVE
            </span>
          )}
          {headerExtra}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onRefresh && (
            <button
              onClick={onRefresh}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 14, lineHeight: 1,
                transition: 'color 0.15s',
                padding: '0 2px',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = accentColor)}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              title="Refresh"
            >
              ↻
            </button>
          )}
          <span suppressHydrationWarning style={{
            fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.04em',
          }}>
            {lastUpdated ? formatTimestamp(lastUpdated) : '------'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative', zIndex: 1 }}>
        {loading ? (
          <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontFamily: 'IBM Plex Mono', fontSize: 11,
              color: accentColor,
              textShadow: `0 0 8px ${accentColor}80`,
            }}>
              LOADING<span className="blink-cursor" />
            </span>
          </div>
        ) : error ? (
          <div className="error-state">
            ⚠ {isCached ? 'CACHED DATA' : 'DATA UNAVAILABLE'}
            {!isCached && <div style={{ marginTop: 4, fontSize: 9, color: 'var(--text-muted)' }}>{error}</div>}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
