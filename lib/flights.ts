// Shared flight types + presentation helpers. Client and server both import
// this; keep it free of anything Node-only.

export interface Aircraft {
  icao24: string
  callsign: string
  originCountry: string
  longitude: number | null
  latitude: number | null
  altitude: number | null
  onGround: boolean
  velocity: number | null
  heading: number | null
  verticalRate: number | null
  squawk: string | null
  lastContact: number | null
}

export interface Bounds {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
}

export interface RegionCounts {
  total: number
  usa: number
  europe: number
  asia: number
}

// Bands match the colours the rest of the terminal already uses for altitude
// (see lib/utils.ts altitudeColor and the existing map legend) so the flight
// map reads the same as every other panel.
export const ALTITUDE_BANDS = [
  { label: 'CRUISE > 30,000ft', color: '#2196f3' },
  { label: '15,000-30,000ft', color: '#00e676' },
  { label: '< 15,000ft', color: '#ffd600' },
  { label: 'ON GROUND', color: '#546e7a' },
] as const

export function altitudeBand(a: Pick<Aircraft, 'altitude' | 'onGround'>): { label: string; color: string } {
  if (a.onGround) return ALTITUDE_BANDS[3]
  if (a.altitude == null) return ALTITUDE_BANDS[3]
  if (a.altitude > 30000) return ALTITUDE_BANDS[0]
  if (a.altitude > 15000) return ALTITUDE_BANDS[1]
  return ALTITUDE_BANDS[2]
}

/** OpenSky reports vertical rate in ft/min after conversion; null means it sent none. */
export function formatVerticalRate(rate: number | null): string | null {
  if (rate == null) return null
  const r = Math.round(rate)
  if (Math.abs(r) < 100) return 'LEVEL'
  return `${r > 0 ? '▲ CLIMB' : '▼ DESCEND'} ${Math.abs(r).toLocaleString()} ft/min`
}

/** `lastContact` is epoch SECONDS from OpenSky, not milliseconds. */
export function formatLastContact(ts: number | null): string | null {
  if (!ts) return null
  const secs = Math.max(0, Math.round(Date.now() / 1000 - ts))
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

export function inBounds(a: Aircraft, b: Bounds): boolean {
  if (a.latitude == null || a.longitude == null) return false
  return a.latitude >= b.minLat && a.latitude <= b.maxLat && a.longitude >= b.minLon && a.longitude <= b.maxLon
}

/** Matches a search term against the two identifiers OpenSky actually gives us. */
export function matchesSearch(a: Aircraft, term: string): boolean {
  const q = term.trim().toLowerCase()
  if (!q) return true
  return a.callsign.toLowerCase().includes(q) || a.icao24.toLowerCase().includes(q)
}
