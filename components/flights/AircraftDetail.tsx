'use client'
import type { Aircraft } from '@/lib/flights'
import { altitudeBand, formatVerticalRate, formatLastContact } from '@/lib/flights'

/**
 * Every field here comes straight from an OpenSky state vector.
 *
 * OpenSky's free state-vector API carries position and kinematics ONLY. It has
 * no flight route, no origin/destination airport, no scheduled or estimated
 * arrival time, no "time remaining", and no aircraft type or airline — those
 * need a schedule/route source (AviationStack, FlightAware and similar, all
 * paid). So none of them appear here, estimated or otherwise, and a field the
 * vector omits is dropped from the list rather than filled with a placeholder.
 */
export default function AircraftDetail({ a, compact = false }: { a: Aircraft; compact?: boolean }) {
  const band = altitudeBand(a)

  const rows: [string, string][] = []
  if (a.altitude != null) rows.push(['ALT', `${Math.round(a.altitude).toLocaleString()} ft`])
  if (a.velocity != null) rows.push(['SPD', `${Math.round(a.velocity).toLocaleString()} kts`])
  if (a.heading != null) rows.push(['HDG', `${Math.round(a.heading)}°`])
  const vs = formatVerticalRate(a.verticalRate)
  if (vs) rows.push(['V/S', vs])
  if (a.latitude != null && a.longitude != null) {
    rows.push(['POS', `${a.latitude.toFixed(3)}, ${a.longitude.toFixed(3)}`])
  }
  if (a.squawk) rows.push(['SQUAWK', a.squawk])
  rows.push(['ICAO24', a.icao24.toUpperCase()])
  const seen = formatLastContact(a.lastContact)
  if (seen) rows.push(['POS AGE', seen])

  return (
    <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: compact ? 10 : 11, minWidth: compact ? 190 : 230 }}>
      <div style={{ color: band.color, fontWeight: 700, fontSize: compact ? 12 : 14 }}>
        {a.callsign || a.icao24.toUpperCase()}
        {a.onGround && (
          <span style={{ color: 'var(--text-muted)', fontSize: 9, marginLeft: 6 }}>ON GROUND</span>
        )}
      </div>
      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{a.originCountry || 'Unknown origin'}</div>

      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
          <span style={{ color: 'var(--text-muted)' }}>{k}</span>
          <span style={{ color: 'var(--text-primary)' }}>{v}</span>
        </div>
      ))}

      <div
        style={{
          color: 'var(--text-muted)', fontSize: 8, marginTop: 5,
          borderTop: '1px solid var(--border-dim)', paddingTop: 3, lineHeight: 1.4,
        }}
      >
        OpenSky state vector — position &amp; kinematics only.
        {!compact && ' Route, destination and ETA are not available from this feed.'}
      </div>
    </div>
  )
}
