'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { altitudeColor } from '@/lib/utils'

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })
const CircleMarker = dynamic(() => import('react-leaflet').then(m => m.CircleMarker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false })

interface Aircraft {
  icao24: string
  callsign: string
  originCountry: string
  longitude: number | null
  latitude: number | null
  altitude: number | null
  onGround: boolean
  velocity: number | null
  heading: number | null
  squawk: string | null
}

interface RegionCounts {
  total: number
  usa: number
  europe: number
  asia: number
}

export default function FlightsPage() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([])
  const [counts, setCounts] = useState<RegionCounts>({ total: 0, usa: 0, europe: 0, asia: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isMounted, setIsMounted] = useState(false)
  const [selected, setSelected] = useState<Aircraft | null>(null)
  const [rateLimited, setRateLimited] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const fetchFlights = async () => {
    try {
      const res = await fetch('/api/flights')
      const json = await res.json()
      if (json.data) {
        setAircraft(json.data.aircraft || [])
        setCounts(json.data.counts || { total: 0, usa: 0, europe: 0, asia: 0 })
      }
      setRateLimited(!!json.rateLimited)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchFlights()
    const id = setInterval(fetchFlights, 10000)
    return () => clearInterval(id)
  }, [])

  const filtered = search
    ? aircraft.filter(a => a.callsign?.toLowerCase().includes(search.toLowerCase()) || a.originCountry?.toLowerCase().includes(search.toLowerCase()))
    : aircraft

  const altColor = (alt: number | null) => {
    if (!alt) return 'var(--text-muted)'
    if (alt > 30000) return '#2196f3'
    if (alt > 15000) return 'var(--text-positive)'
    return '#ffd600'
  }

  if (!isMounted) return (
    <div className="flex items-center justify-center h-full">
      <span className="font-mono text-[11px] text-positive">LOADING FLIGHT RADAR<span className="blink-cursor" /></span>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Stats Bar */}
      <div style={{ background: 'var(--bg-terminal)', borderBottom: '1px solid #1b2e1b', padding: '6px 12px' }} className="flex items-center gap-6 flex-shrink-0">
        <div className="font-mono text-[10px] text-accent font-bold">LIVE FLIGHT TRACKER — OPENSKY NETWORK</div>
        {[
          { label: 'TOTAL TRACKED', value: counts.total, color: 'var(--text-accent)' },
          { label: 'OVER USA', value: counts.usa, color: '#2196f3' },
          { label: 'OVER EUROPE', value: counts.europe, color: 'var(--text-positive)' },
          { label: 'OVER ASIA', value: counts.asia, color: '#ffd600' },
        ].map(stat => (
          <div key={stat.label} className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted">{stat.label}</span>
            <span className="font-mono text-[14px] font-bold" style={{ color: stat.color }}>{stat.value.toLocaleString()}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="SEARCH CALLSIGN..."
            className="input-terminal"
            style={{ width: 180 }}
          />
        </div>
      </div>

      {rateLimited && (
        <div style={{
          fontFamily: 'IBM Plex Mono',
          fontSize: '9px',
          color: 'var(--text-warning)',
          padding: '4px 12px',
          background: 'var(--bg-terminal)',
          borderBottom: '1px solid #1b2e1b',
        }} className="flex-shrink-0">
          ⚠ OpenSky rate limit reached — showing last known positions
        </div>
      )}

      {/* Altitude Legend */}
      <div style={{ background: '#000', borderBottom: '1px solid #0d1f0d', padding: '4px 12px' }} className="flex items-center gap-6">
        <span className="font-mono text-[9px] text-muted">ALTITUDE:</span>
        {[['> 30,000ft', '#2196f3'], ['15,000-30,000ft', 'var(--text-positive)'], ['< 15,000ft', '#ffd600'], ['ON GROUND', 'var(--text-muted)']].map(([label, color]) => (
          <div key={label} className="flex items-center gap-1">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color as string, display: 'inline-block' }} />
            <span className="font-mono text-[9px] text-muted">{label}</span>
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="flex-1" style={{ position: 'relative', overflow: 'hidden' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="font-mono text-[11px] text-positive">FETCHING FLIGHT DATA<span className="blink-cursor" /></span>
          </div>
        ) : (
          <MapContainer center={[30, 0]} zoom={3} style={{ position: 'absolute', inset: 0, height: '100%', width: '100%' }} attributionControl={false}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            {filtered.map(a => (
              a.longitude !== null && a.latitude !== null ? (
                <CircleMarker
                  key={a.icao24}
                  center={[a.latitude!, a.longitude!]}
                  radius={a.onGround ? 2 : 3}
                  fillColor={altColor(a.altitude)}
                  color={altColor(a.altitude)}
                  fillOpacity={0.85}
                  weight={1}
                  eventHandlers={{ click: () => setSelected(a) }}
                >
                  <Popup>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#c8e6c9', background: 'var(--bg-terminal)', padding: 6, minWidth: 160 }}>
                      <div style={{ color: 'var(--text-accent)', fontWeight: 700, fontSize: 13 }}>{a.callsign || a.icao24}</div>
                      <div style={{ color: '#546e7a' }}>{a.originCountry}</div>
                      <div>ALT: <span style={{ color: altColor(a.altitude) }}>{a.altitude ? `${Math.round(a.altitude).toLocaleString()}ft` : 'GROUND'}</span></div>
                      <div>SPD: <span style={{ color: '#c8e6c9' }}>{a.velocity ? `${Math.round(a.velocity)}kts` : 'N/A'}</span></div>
                      <div>HDG: <span style={{ color: '#c8e6c9' }}>{a.heading ? `${Math.round(a.heading)}°` : 'N/A'}</span></div>
                      {a.squawk && <div>SQK: <span style={{ color: '#c8e6c9' }}>{a.squawk}</span></div>}
                    </div>
                  </Popup>
                </CircleMarker>
              ) : null
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  )
}
