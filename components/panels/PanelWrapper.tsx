'use client'
import { useState, useEffect, ReactNode } from 'react'
import { formatTimestamp } from '@/lib/utils'
import { toDataStatus } from '@/lib/dataStatus'
import { DataStatusBadge } from '@/components/ui/DataStatusBadge'

interface PanelWrapperProps {
  title: string
  children: ReactNode
  className?: string
  /** The API's own status string (route `source` field) — drives the badge. */
  source?: 'live' | 'cached' | 'cache' | 'static' | string
  /** When the data was produced upstream, if the API says (tooltip only). */
  asOf?: string | number | null
  /** Provider name for the tooltip, e.g. "CoinGecko". */
  sourceName?: string
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
  fullHeight?: boolean
  accentColor?: string
  headerExtra?: ReactNode
  /** Suppress the status badge (for panels whose data is historical by nature). */
  hideAgeBadge?: boolean
}

export default function PanelWrapper({
  title,
  children,
  className = '',
  source,
  asOf,
  sourceName,
  loading = false,
  error = null,
  onRefresh,
  fullHeight = false,
  accentColor = 'var(--text-accent)',
  headerExtra,
  hideAgeBadge = false,
}: PanelWrapperProps) {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    if (!loading && !error) setLastUpdated(new Date())
  }, [loading, error])

  const isCached = source === 'cached' || source === 'cache' || source === 'stale'

  // Status comes ONLY from the API's own source field. This used to show
  // "● LIVE" whenever the browser had fetched within 5 minutes — whatever the
  // API said, and for panels that pass no source at all. No source → no badge.
  const status = loading ? null : error ? 'unavailable' : toDataStatus(source)

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
        // gap + wrap so a wider title (13px) plus badges/controls degrades by
        // wrapping rather than overflowing the header box in narrow panels.
        flexWrap: 'wrap', gap: '2px 8px',
        flexShrink: 0, position: 'relative', zIndex: 1,
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 8px', minWidth: 0, flexShrink: 0, maxWidth: '100%' }}>
          <span style={{
            color: accentColor,
            fontFamily: 'IBM Plex Mono', fontSize: 'var(--fs-header)', fontWeight: 700,
            letterSpacing: '0.02em', textTransform: 'uppercase',
            textShadow: `0 0 12px ${accentColor}60`,
            minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {title}
          </span>

          {status && !hideAgeBadge && <DataStatusBadge status={status} asOf={asOf} source={sourceName} />}
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
            fontFamily: 'IBM Plex Mono', fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', letterSpacing: '0.04em',
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
              fontFamily: 'IBM Plex Mono', fontSize: 'var(--fs-body)',
              color: accentColor,
              textShadow: `0 0 8px ${accentColor}80`,
            }}>
              LOADING<span className="blink-cursor" />
            </span>
          </div>
        ) : error ? (
          <div className="error-state">
            ⚠ {isCached ? 'CACHED DATA' : 'DATA UNAVAILABLE'}
            {!isCached && <div style={{ marginTop: 4, fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>{error}</div>}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
