'use client'
import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { Aircraft, Bounds } from '@/lib/flights'
import { altitudeBand } from '@/lib/flights'
import AircraftDetail from './AircraftDetail'

// Above this zoom each aircraft gets a real rotated plane glyph; below it they
// render as plain SVG circles. A divIcon is a DOM node per aircraft and a world
// view holds thousands — that is what makes a naive flight map crawl. Circles
// are one SVG path each and stay smooth at global zoom.
const PLANE_ICON_MIN_ZOOM = 5

// Hard ceiling on rendered markers regardless of zoom, so a pathological
// viewport can never lock the main thread. Viewport filtering upstream means
// this is rarely reached above zoom 4.
const MAX_RENDERED = 1500

// divIcons would otherwise be rebuilt on every render; heading is bucketed to 5°
// (visually indistinguishable) so this cache stays small and hits constantly.
const iconCache = new Map<string, L.DivIcon>()

function planeIcon(color: string, heading: number | null, highlighted: boolean): L.DivIcon {
  const hdg = heading == null ? 0 : Math.round(heading / 5) * 5
  const key = `${color}:${hdg}:${highlighted}`
  const hit = iconCache.get(key)
  if (hit) return hit

  const icon = L.divIcon({
    className: 'flight-marker',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    // The glyph points north at 0°, matching OpenSky's true_track (degrees
    // clockwise from north), so rotation maps 1:1 with no offset.
    html: `<div class="flight-glyph${highlighted ? ' flight-glyph-active' : ''}" style="transform:rotate(${hdg}deg);color:${color}">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
        <path d="M12 2 L13.6 9.2 L22 13.2 L22 15 L13.6 12.8 L13.2 19 L16 20.8 L16 22 L12 21 L8 22 L8 20.8 L10.8 19 L10.4 12.8 L2 15 L2 13.2 L10.4 9.2 Z"/>
      </svg>
    </div>`,
  })
  iconCache.set(key, icon)
  return icon
}

/** Reports the map's visible bounds + zoom upward so the parent can filter. */
function ViewportTracker({ onChange }: { onChange: (b: Bounds, zoom: number) => void }) {
  const map = useMapEvents({
    moveend: () => emit(),
    zoomend: () => emit(),
  })

  const emit = () => {
    const b = map.getBounds()
    onChange(
      { minLat: b.getSouth(), maxLat: b.getNorth(), minLon: b.getWest(), maxLon: b.getEast() },
      map.getZoom(),
    )
  }

  // Emit once on mount so the first paint filters to the initial viewport
  // instead of briefly laying out every aircraft on Earth.
  useEffect(() => { emit() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/** Pans/zooms to the focused aircraft. */
function FocusController({ target }: { target: Aircraft | null }) {
  const map = useMap()
  const lastFocused = useRef<string | null>(null)

  useEffect(() => {
    if (!target || target.latitude == null || target.longitude == null) {
      lastFocused.current = null
      return
    }
    // Only fly when the target actually changes — otherwise every 30s refresh
    // would yank the map back and fight the user's own panning.
    if (lastFocused.current === target.icao24) return
    lastFocused.current = target.icao24
    map.flyTo([target.latitude, target.longitude], Math.max(map.getZoom(), 7), { duration: 1.2 })
  }, [target, map])

  return null
}

interface Props {
  aircraft: Aircraft[]
  focused: Aircraft | null
  onSelect: (a: Aircraft) => void
  onViewportChange: (b: Bounds, zoom: number) => void
  zoom: number
}

export default function FlightMap({ aircraft, focused, onSelect, onViewportChange, zoom }: Props) {
  const rendered = useMemo(() => aircraft.slice(0, MAX_RENDERED), [aircraft])
  const usePlaneIcons = zoom >= PLANE_ICON_MIN_ZOOM

  return (
    <MapContainer
      center={[30, 0]}
      zoom={3}
      minZoom={2}
      worldCopyJump
      style={{ position: 'absolute', inset: 0, height: '100%', width: '100%', background: 'var(--bg-terminal)' }}
    >
      {/* CartoDB now stamps "API KEY REQUIRED" across every keyless tile, so the
          basemap read as broken. Esri's dark canvas is keyless, free with
          attribution, and the same flat dark grey the terminal theme wants. */}
      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri" />
      <ViewportTracker onChange={onViewportChange} />
      <FocusController target={focused} />

      {rendered.map(a => {
        if (a.latitude == null || a.longitude == null) return null
        const band = altitudeBand(a)
        const isFocused = focused?.icao24 === a.icao24

        // Tooltip only — no per-marker Popup. react-leaflet renders these
        // children lazily (nothing until the layer actually opens), but a Popup
        // would still add a second Leaflet layer object per aircraft, and at
        // 1,500 markers that is pure overhead. Click detail lives in the single
        // pinned card the page renders instead.
        const tooltip = (
          <Tooltip direction="top" offset={[0, usePlaneIcons ? -10 : -4]} opacity={1}>
            <AircraftDetail a={a} compact />
          </Tooltip>
        )

        return usePlaneIcons ? (
          <Marker
            key={a.icao24}
            position={[a.latitude, a.longitude]}
            icon={planeIcon(band.color, a.heading, isFocused)}
            zIndexOffset={isFocused ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(a) }}
          >
            {tooltip}
          </Marker>
        ) : (
          <CircleMarker
            key={a.icao24}
            center={[a.latitude, a.longitude]}
            radius={isFocused ? 7 : a.onGround ? 2 : 3.5}
            fillColor={band.color}
            color={isFocused ? '#ffffff' : band.color}
            fillOpacity={0.85}
            weight={isFocused ? 2 : 1}
            className={isFocused ? 'flight-circle-active' : undefined}
            eventHandlers={{ click: () => onSelect(a) }}
          >
            {tooltip}
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
