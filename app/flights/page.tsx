'use client'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Aircraft, Bounds, RegionCounts } from '@/lib/flights'
import { ALTITUDE_BANDS, altitudeBand, inBounds, matchesSearch } from '@/lib/flights'
import AircraftDetail from '@/components/flights/AircraftDetail'

// The map uses react-leaflet hooks (useMap/useMapEvents), which have to be
// imported directly rather than per-component — so the whole map is one
// ssr:false chunk instead of the per-component dynamic() the older page used.
const FlightMap = dynamic(() => import('@/components/flights/FlightMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <span className="font-mono text-[11px] text-positive">INITIALISING MAP<span className="blink-cursor" /></span>
    </div>
  ),
})

// Server caches OpenSky for 30s; polling faster than that only re-reads the
// same cache entry, so this matches it.
const POLL_MS = 30_000

const EMPTY_COUNTS: RegionCounts = { total: 0, usa: 0, europe: 0, asia: 0 }

export default function FlightsPage() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([])
  const [counts, setCounts] = useState<RegionCounts>(EMPTY_COUNTS)
  const [loading, setLoading] = useState(true)
  const [rateLimited, setRateLimited] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const [snapshotTime, setSnapshotTime] = useState<number | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [focused, setFocused] = useState<Aircraft | null>(null)
  const [viewport, setViewport] = useState<Bounds | null>(null)
  const [zoom, setZoom] = useState(3)
  const [tick, setTick] = useState(0)

  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => { setIsMounted(true) }, [])

  const fetchFlights = useCallback(async () => {
    try {
      const res = await fetch('/api/flights')
      const json = await res.json()
      if (json.data?.aircraft) {
        setAircraft(json.data.aircraft)
        setCounts(json.data.counts || EMPTY_COUNTS)
      }
      setRateLimited(!!json.rateLimited)
      setTruncated(!!json.truncated)
      setSnapshotTime(json.snapshotTime ?? null)
      setFetchedAt(json.fetchedAt ?? Date.now())
      setErrorMsg(json.error ?? null)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFlights()
    const id = setInterval(fetchFlights, POLL_MS)
    return () => clearInterval(id)
  }, [fetchFlights])

  // Drives the "last updated Xs ago" counter without re-fetching.
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Search is deliberately client-side: the response already carries callsign
  // and icao24 for every aircraft, so matching costs no extra OpenSky credits.
  const searchResults = useMemo(
    () => (search.trim() ? aircraft.filter(a => matchesSearch(a, search)) : []),
    [aircraft, search],
  )

  // Only aircraft actually inside the current viewport get handed to Leaflet.
  // Without this, a world view asks it to lay out thousands of markers that are
  // off-screen anyway.
  const visible = useMemo(() => {
    const base = search.trim() ? searchResults : aircraft
    if (!viewport) return base
    // While searching, keep matches visible even if they are off-viewport —
    // the map is about to fly to them.
    return search.trim() ? base : base.filter(a => inBounds(a, viewport))
  }, [aircraft, searchResults, search, viewport])

  // A search focuses its top match automatically. Guarded so the 30s refresh
  // does not keep resetting a different aircraft the user clicked in the list.
  useEffect(() => {
    if (!search.trim()) return
    if (searchResults.length === 0) return
    setFocused(prev =>
      prev && searchResults.some(a => a.icao24 === prev.icao24) ? prev : searchResults[0],
    )
  }, [search, searchResults])

  // Keep the pinned card's numbers current as new positions arrive.
  useEffect(() => {
    setFocused(prev => (prev ? aircraft.find(a => a.icao24 === prev.icao24) ?? prev : prev))
  }, [aircraft])

  const onViewportChange = useCallback((b: Bounds, z: number) => {
    setViewport(b)
    setZoom(z)
  }, [])

  const freshness = useMemo(() => {
    // Prefer OpenSky's own snapshot time — that is when the positions were
    // actually measured, not when our server happened to hand them over.
    const basis = snapshotTime != null ? snapshotTime * 1000 : fetchedAt
    if (!basis) return null
    return Math.max(0, Math.round((Date.now() - basis) / 1000))
  }, [snapshotTime, fetchedAt, tick])

  if (!isMounted) return (
    <div className="flex items-center justify-center h-full">
      <span className="font-mono text-[11px] text-positive">LOADING FLIGHT RADAR<span className="blink-cursor" /></span>
    </div>
  )

  const noSearchMatch = search.trim().length > 0 && searchResults.length === 0

  return (
    <div className="flex flex-col h-full">
      {/* Stats Bar */}
      <div
        style={{ background: 'var(--bg-terminal)', borderBottom: '1px solid var(--border-color)', padding: '6px 12px' }}
        className="flex items-center gap-6 flex-shrink-0 flex-wrap"
      >
        <div className="font-mono text-[10px] text-accent font-bold">LIVE FLIGHT TRACKER — OPENSKY NETWORK</div>
        {[
          { label: 'TRACKED', value: counts.total, color: 'var(--text-accent)' },
          { label: 'IN VIEW', value: visible.length, color: 'var(--text-primary)' },
          { label: 'USA', value: counts.usa, color: '#2196f3' },
          { label: 'EUROPE', value: counts.europe, color: '#00e676' },
          { label: 'ASIA', value: counts.asia, color: '#ffd600' },
        ].map(stat => (
          <div key={stat.label} className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted">{stat.label}</span>
            <span className="font-mono text-[14px] font-bold" style={{ color: stat.color }}>
              {stat.value.toLocaleString()}
            </span>
          </div>
        ))}

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted">UPDATED</span>
          <span className="font-mono text-[11px]" style={{ color: freshness != null && freshness < 90 ? 'var(--text-positive)' : 'var(--text-warning)' }}>
            {freshness == null ? '—' : `${freshness}s ago`}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="SEARCH CALLSIGN / ICAO24…"
            className="input-terminal"
            style={{ width: 220 }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="btn-terminal text-[9px]">CLEAR</button>
          )}
          <button onClick={fetchFlights} className="btn-terminal text-[9px]">↻</button>
        </div>
      </div>

      {/* Honest status banners — never a blank map with no explanation. */}
      {rateLimited && (
        <Banner tone="warning">
          ⚠ Live flight data temporarily rate-limited (OpenSky anonymous quota is 400 credits/day per IP) — showing last known positions
        </Banner>
      )}
      {!rateLimited && errorMsg && (
        <Banner tone="warning">⚠ Flight feed error: {errorMsg} — showing last known positions</Banner>
      )}
      {truncated && (
        <Banner tone="muted">
          {counts.total.toLocaleString()} aircraft airborne; map is showing the first {aircraft.length.toLocaleString()}
        </Banner>
      )}
      {noSearchMatch && (
        <Banner tone="muted">No matching aircraft currently tracked for “{search.trim()}”</Banner>
      )}

      {/* Altitude Legend */}
      <div
        style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-dim)', padding: '4px 12px' }}
        className="flex items-center gap-6 flex-shrink-0"
      >
        <span className="font-mono text-[9px] text-muted">ALTITUDE:</span>
        {ALTITUDE_BANDS.map(band => (
          <div key={band.label} className="flex items-center gap-1">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: band.color, display: 'inline-block' }} />
            <span className="font-mono text-[9px] text-muted">{band.label}</span>
          </div>
        ))}
        <span className="font-mono text-[9px] text-muted ml-auto">
          {zoom >= 5 ? 'PLANE ICONS — ROTATED TO TRACK' : 'ZOOM IN FOR HEADING ICONS'}
        </span>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Map */}
        <div className="flex-1" style={{ position: 'relative', overflow: 'hidden' }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <span className="font-mono text-[11px] text-positive">FETCHING FLIGHT DATA<span className="blink-cursor" /></span>
            </div>
          ) : (
            <>
              {aircraft.length === 0 && !rateLimited && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 500, pointerEvents: 'none' }} className="flex items-center justify-center">
                  <div
                    style={{
                      fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--text-muted)',
                      background: 'rgba(0,0,0,0.75)', border: '1px solid var(--border-color)',
                      borderRadius: 4, padding: '10px 16px', textAlign: 'center',
                    }}
                  >
                    No aircraft data available right now — this may be temporary
                  </div>
                </div>
              )}
              <FlightMap
                aircraft={visible}
                focused={focused}
                zoom={zoom}
                onSelect={setFocused}
                onViewportChange={onViewportChange}
              />

              {focused && (
                <div
                  style={{
                    position: 'absolute', left: 10, bottom: 10, zIndex: 1000,
                    background: 'var(--bg-panel)', border: '1px solid var(--border-medium)',
                    borderRadius: 4, padding: '8px 10px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
                  }}
                >
                  <button
                    onClick={() => setFocused(null)}
                    aria-label="Close aircraft details"
                    style={{
                      position: 'absolute', top: 4, right: 6, background: 'none', border: 'none',
                      color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                  <AircraftDetail a={focused} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar list — same click-to-focus pattern as the earthquake list on /map */}
        <div
          style={{ width: 260, flexShrink: 0, borderLeft: '1px solid var(--border-color)', background: 'var(--bg-terminal)', overflowY: 'auto' }}
        >
          <div className="panel-header sticky top-0" style={{ zIndex: 2 }}>
            <span className="panel-header-title">
              {search.trim() ? `MATCHES (${searchResults.length})` : `IN VIEW (${visible.length})`}
            </span>
          </div>
          {(search.trim() ? searchResults : visible).slice(0, 200).map(a => {
            const band = altitudeBand(a)
            const isFocused = focused?.icao24 === a.icao24
            return (
              <div
                key={a.icao24}
                onClick={() => setFocused(a)}
                className="px-2 py-1.5 cursor-pointer hover:bg-header"
                style={{
                  borderBottom: '1px solid var(--border-dim)',
                  background: isFocused ? 'var(--bg-header)' : undefined,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold" style={{ color: band.color }}>
                    {a.callsign || a.icao24.toUpperCase()}
                  </span>
                  <span className="font-mono text-[9px] text-muted">
                    {a.onGround ? 'GND' : a.altitude != null ? `${Math.round(a.altitude).toLocaleString()}ft` : '—'}
                  </span>
                </div>
                <p className="text-muted text-[9px] font-mono truncate">{a.originCountry || 'Unknown origin'}</p>
              </div>
            )
          })}
          {!loading && visible.length === 0 && !search.trim() && (
            <div className="px-2 py-4 text-center">
              <span className="font-mono text-[10px] text-muted">No aircraft in this view — pan or zoom out</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Banner({ tone, children }: { tone: 'warning' | 'muted'; children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 9,
        color: tone === 'warning' ? 'var(--text-warning)' : 'var(--text-muted)',
        padding: '4px 12px',
        background: 'var(--bg-terminal)',
        borderBottom: '1px solid var(--border-dim)',
      }}
      className="flex-shrink-0"
    >
      {children}
    </div>
  )
}
