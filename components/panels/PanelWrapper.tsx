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
  /** Ignored since the Saffron Command restyle: every panel is a neutral card. */
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
      className={`gv-card flex flex-col ${fullHeight ? 'h-full' : ''} ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{
        borderBottom: 'var(--bw) solid var(--divider)',
        padding: '8px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        // gap + wrap so a wider title (13px) plus badges/controls degrades by
        // wrapping rather than overflowing the header box in narrow panels.
        flexWrap: 'wrap', gap: '2px 8px',
        flexShrink: 0, position: 'relative', zIndex: 1,
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 8px', minWidth: 0, flexShrink: 0, maxWidth: '100%' }}>
          <span title={title} style={{
            color: 'var(--text)',
            fontSize: 'var(--fs-header)', fontWeight: 'var(--fw-bold)',
            letterSpacing: '0.02em',
            minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {title}
          </span>

          {status && !hideAgeBadge && <DataStatusBadge status={status} asOf={asOf} source={sourceName} />}
          {headerExtra}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onRefresh && (
            <button type="button" onClick={onRefresh} className="gv-icon-btn" title="Refresh" aria-label="Refresh">
              ↻
            </button>
          )}
          <span suppressHydrationWarning className="gv-num" style={{
            fontSize: 'var(--fs-meta)', color: 'var(--text-muted)',
          }}>
            {lastUpdated ? formatTimestamp(lastUpdated) : '------'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative', zIndex: 1 }}>
        {loading ? (
          <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>
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
