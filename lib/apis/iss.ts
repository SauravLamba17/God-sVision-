import { getCache, setCache } from '@/lib/cache'

export interface ISSPosition {
  lat: number
  lng: number
  timestamp: number
  altitude: number
  velocity: number
}

export interface Astronaut {
  name: string
  craft: string
}

export interface ISSData {
  position: ISSPosition
  astronauts: Astronaut[]
}

export async function fetchISSPosition(): Promise<ISSPosition> {
  try {
    const res = await fetch('http://api.open-notify.org/iss-now.json', {
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    return {
      lat: parseFloat(data.iss_position.latitude),
      lng: parseFloat(data.iss_position.longitude),
      timestamp: data.timestamp * 1000,
      altitude: 408,    // constant ~408 km
      velocity: 27600,  // constant ~27,600 km/h
    }
  } catch {
    return { lat: 0, lng: 0, timestamp: Date.now(), altitude: 408, velocity: 27600 }
  }
}

export async function fetchAstronauts(): Promise<Astronaut[]> {
  const cacheKey = 'iss_astronauts'
  const cached = await getCache(cacheKey)
  if (cached && !cached.stale) return cached.data as Astronaut[]

  try {
    const res = await fetch('http://api.open-notify.org/astros.json', {
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    const astronauts: Astronaut[] = data.people || []
    await setCache(cacheKey, astronauts, 86400) // cache 24h
    return astronauts
  } catch {
    return [
      { name: 'Oleg Kononenko', craft: 'ISS' },
      { name: 'Nikolai Chub', craft: 'ISS' },
      { name: 'Tracy Dyson', craft: 'ISS' },
    ]
  }
}

// Compute ISS ground track for next 90 minutes (one orbit)
// ISS orbital period ≈ 92.5 minutes, inclination ≈ 51.6°
export function computeGroundTrack(currentLat: number, currentLng: number): [number, number][] {
  const points: [number, number][] = []
  const orbitalPeriodMs = 92.5 * 60 * 1000
  const steps = 90
  const now = Date.now()

  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * orbitalPeriodMs
    const angle = (t / orbitalPeriodMs) * 360
    const lng = ((currentLng + angle * (360 / orbitalPeriodMs) * (orbitalPeriodMs / 1000 / 60)) % 360 + 540) % 360 - 180
    const lat = 51.6 * Math.sin((angle * Math.PI) / 180 + Math.asin(currentLat / 51.6))
    points.push([Math.max(-85, Math.min(85, lat)), lng])
  }
  return points
}

export async function fetchISSData(): Promise<ISSData> {
  const [position, astronauts] = await Promise.all([
    fetchISSPosition(),
    fetchAstronauts(),
  ])
  return { position, astronauts }
}
