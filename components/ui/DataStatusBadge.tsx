'use client'
import type { DataStatus } from '@/lib/dataStatus'

// The one freshness badge. Status comes from the API (via toDataStatus) — this
// component never decides "live" on its own.
const STYLE: Record<DataStatus, { label: string; color: string; meaning: string }> = {
  'live':             { label: 'LIVE',        color: 'var(--text-positive)', meaning: 'Live from the provider' },
  'delayed':          { label: 'DELAYED',     color: 'var(--text-warning)',  meaning: 'Delayed by the provider' },
  'cached':           { label: 'CACHED',      color: '#38bdf8',              meaning: 'Served from cache within its refresh window' },
  'stale':            { label: 'STALE',       color: 'var(--text-warning)',  meaning: 'Older than its refresh window — the provider is failing' },
  'estimate':         { label: 'ESTIMATE',    color: '#a78bfa',              meaning: 'Model- or rule-derived, not observed data' },
  'static-reference': { label: 'REFERENCE',   color: 'var(--text-muted)',    meaning: 'Static reference values, not a live feed' },
  'unavailable':      { label: 'UNAVAILABLE', color: 'var(--text-negative)', meaning: 'No data available right now' },
}

function formatAsOf(asOf: string | number): string | null {
  const d = new Date(asOf)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function DataStatusBadge({ status, asOf, source }: { status: DataStatus; asOf?: string | number | null; source?: string }) {
  const s = STYLE[status]
  const when = asOf != null ? formatAsOf(asOf) : null
  const title = [s.meaning, source && `Source: ${source}`, when && `As of ${when}`].filter(Boolean).join(' · ')
  return (
    <span
      title={title}
      aria-label={`Data status: ${s.label}. ${title}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontFamily: 'IBM Plex Mono', fontSize: 'var(--fs-badge)', fontWeight: 700,
        letterSpacing: '0.06em', color: s.color, cursor: 'help', whiteSpace: 'nowrap',
      }}
    >
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: s.color, display: 'inline-block',
        animation: status === 'live' ? 'pulseLive 2s ease-in-out infinite' : undefined,
      }} />
      {s.label}
    </span>
  )
}
