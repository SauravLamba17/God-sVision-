'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { magnitudeColor, timeAgo } from '@/lib/utils'

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })
const CircleMarker = dynamic(() => import('react-leaflet').then(m => m.CircleMarker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false })

interface Earthquake {
  id: string
  magnitude: number
  place: string
  time: number
  lat: number
  lng: number
  depth: number
  tsunami: number
}

interface Aircraft {
  icao24: string
  callsign: string
  originCountry: string
  longitude: number
  latitude: number
  altitude: number
  velocity: number
  heading: number
  squawk: string
}

interface LayerState {
  earthquakes: boolean
  flights: boolean
  weather: boolean
}

export default function MapPage() {
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([])
  const [aircraft, setAircraft] = useState<Aircraft[]>([])
  const [layers, setLayers] = useState<LayerState>({ earthquakes: true, flights: false, weather: false })
  const [selectedQuake, setSelectedQuake] = useState<Earthquake | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    const fetchEQ = async () => {
      try {
        const res = await fetch('/api/earthquakes?minMag=2.5')
        const json = await res.json()
        if (json.data) setEarthquakes(json.data)
      } catch { /* silent */ }
    }
    fetchEQ()
    const id = setInterval(fetchEQ, 60000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!layers.flights) return
    const fetchFlights = async () => {
      try {
        const res = await fetch('/api/flights')
        const json = await res.json()
        if (json.data?.aircraft) setAircraft(json.data.aircraft.slice(0, 500))
      } catch { /* silent */ }
    }
    fetchFlights()
    const id = setInterval(fetchFlights, 10000)
    return () => clearInterval(id)
  }, [layers.flights])

  const toggleLayer = (layer: keyof LayerState) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }))
  }

  const altColor = (alt: number | null) => {
    if (!alt) return 'var(--text-muted)'
    if (alt > 30000) return '#2196f3'
    if (alt > 15000) return 'var(--text-positive)'
    return '#ffd600'
  }

  if (!isMounted) return (
    <div className="flex items-center justify-center h-full">
      <span className="font-mono text-[11px] text-positive">LOADING MAP<span className="blink-cursor" /></span>
    </div>
  )

  return (
    <div className="flex h-full">
      {/* Map */}
      <div className="flex-1 relative" style={{ overflow: 'hidden' }}>
        <MapContainer
          center={[20, 0]}
          zoom={3}
          style={{ position: 'absolute', inset: 0, height: '100%', width: '100%', background: 'var(--bg-terminal)' }}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; CartoDB'
          />

          {/* Earthquake Layer */}
          {layers.earthquakes && earthquakes.map(q => (
            <CircleMarker
              key={q.id}
              center={[q.lat, q.lng]}
              radius={Math.max(3, q.magnitude * 2)}
              fillColor={magnitudeColor(q.magnitude)}
              color={magnitudeColor(q.magnitude)}
              fillOpacity={0.7}
              weight={1}
              eventHandlers={{ click: () => setSelectedQuake(q) }}
            >
              <Popup>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#c8e6c9', background: 'var(--bg-terminal)', padding: 6 }}>
                  <div style={{ color: 'var(--text-accent)', fontWeight: 700 }}>M{q.magnitude.toFixed(1)} EARTHQUAKE</div>
                  <div>{q.place}</div>
                  <div style={{ color: '#546e7a' }}>Depth: {q.depth.toFixed(0)}km</div>
                  <div style={{ color: '#546e7a' }}>{timeAgo(q.time)}</div>
                  {q.tsunami === 1 && <div style={{ color: 'var(--text-negative)', fontWeight: 700 }}>⚠ TSUNAMI WARNING</div>}
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {/* Flight Layer */}
          {layers.flights && aircraft.map(a => (
            a.longitude && a.latitude ? (
              <CircleMarker
                key={a.icao24}
                center={[a.latitude, a.longitude]}
                radius={2}
                fillColor={altColor(a.altitude)}
                color={altColor(a.altitude)}
                fillOpacity={0.8}
                weight={1}
              >
                <Popup>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#c8e6c9', background: 'var(--bg-terminal)', padding: 6 }}>
                    <div style={{ color: 'var(--text-accent)', fontWeight: 700 }}>{a.callsign || a.icao24}</div>
                    <div>{a.originCountry}</div>
                    <div style={{ color: '#546e7a' }}>Alt: {a.altitude ? `${Math.round(a.altitude).toLocaleString()}ft` : 'N/A'}</div>
                    <div style={{ color: '#546e7a' }}>Speed: {a.velocity ? `${Math.round(a.velocity)}kts` : 'N/A'}</div>
                    <div style={{ color: '#546e7a' }}>Hdg: {a.heading ? `${Math.round(a.heading)}°` : 'N/A'}</div>
                    {a.squawk && <div style={{ color: '#546e7a' }}>Squawk: {a.squawk}</div>}
                  </div>
                </Popup>
              </CircleMarker>
            ) : null
          ))}
        </MapContainer>

        {/* Layer Controls */}
        <div style={{
          position: 'absolute', top: 10, right: 10, zIndex: 1000,
          background: 'var(--bg-terminal)', border: '1px solid #1b2e1b', padding: '8px 12px',
        }}>
          <div className="font-mono text-[10px] text-accent font-bold mb-2">MAP LAYERS</div>
          {[
            { key: 'earthquakes', label: '🌍 EARTHQUAKES', count: earthquakes.length },
            { key: 'flights', label: '✈ FLIGHTS', count: aircraft.length },
            { key: 'weather', label: '🌧 WEATHER', count: 0 },
          ].map(layer => (
            <label key={layer.key} className="flex items-center gap-2 mb-1 cursor-pointer">
              <input
                type="checkbox"
                checked={layers[layer.key as keyof LayerState]}
                onChange={() => toggleLayer(layer.key as keyof LayerState)}
                style={{ accentColor: 'var(--text-accent)' }}
              />
              <span className="font-mono text-[10px] text-primary">{layer.label}</span>
              {layer.count > 0 && (
                <span className="font-mono text-[9px] text-muted">({layer.count})</span>
              )}
            </label>
          ))}
        </div>

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 10, left: 10, zIndex: 1000,
          background: 'var(--bg-terminal)', border: '1px solid #1b2e1b', padding: '8px 12px',
        }}>
          <div className="font-mono text-[9px] text-accent mb-1">EARTHQUAKE MAGNITUDE</div>
          {[['≥7.0', 'var(--text-negative)'], ['5.0-6.9', 'var(--text-accent)'], ['3.0-4.9', '#ffd600'], ['<3.0', '#546e7a']].map(([label, color]) => (
            <div key={label} className="flex items-center gap-2 mb-0.5">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color as string, display: 'inline-block' }} />
              <span className="font-mono text-[9px] text-muted">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Sidebar: Earthquake List */}
      <div style={{ width: 260, flexShrink: 0, borderLeft: '1px solid #1b2e1b', background: 'var(--bg-terminal)', overflowY: 'auto' }}>
        <div className="panel-header sticky top-0">
          <span className="panel-header-title">RECENT EARTHQUAKES</span>
        </div>
        {earthquakes.slice(0, 25).map(q => (
          <div
            key={q.id}
            className="px-2 py-1.5 cursor-pointer hover:bg-header"
            style={{ borderBottom: '1px solid #0d1f0d' }}
            onClick={() => setSelectedQuake(q)}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[13px] font-bold" style={{ color: magnitudeColor(q.magnitude) }}>
                M{q.magnitude.toFixed(1)}
              </span>
              <span className="font-mono text-[9px] text-muted">{timeAgo(q.time)}</span>
            </div>
            <p className="text-primary text-[10px] leading-tight mt-0.5">{q.place}</p>
            <p className="text-muted text-[9px] font-mono">Depth: {q.depth.toFixed(0)}km</p>
            {q.tsunami === 1 && <p className="text-negative text-[9px] font-mono animate-pulse">⚠ TSUNAMI</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
