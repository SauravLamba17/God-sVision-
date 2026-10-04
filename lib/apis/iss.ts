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
  position: ISSPosition | null   // null = tracking feeds unreachable (never a placeholder)
  astronauts: Astronaut[] | null // null = crew feed unreachable
}

// Primary: wheretheiss.at (HTTPS; real altitude/velocity). Fallback: open-notify,
// which is plain HTTP and fails from Vercel — kept only as a second chance.
export async function fetchISSPosition(): Promise<ISSPosition | null> {
  try {
    const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544', {
      next: { revalidate: 60 }, signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`wheretheiss ${res.status}`)
    const d = await res.json()
    return {
      lat: d.latitude,
      lng: d.longitude,
      timestamp: d.timestamp * 1000,
      altitude: Math.round(d.altitude),
      velocity: Math.round(d.velocity),
    }
  } catch { /* try the fallback */ }

  try {
    const res = await fetch('http://api.open-notify.org/iss-now.json', {
      next: { revalidate: 60 }, signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    return {
      lat: parseFloat(data.iss_position.latitude),
      lng: parseFloat(data.iss_position.longitude),
      timestamp: data.timestamp * 1000,
      altitude: 408,    // open-notify has no altitude — nominal ~408 km
      velocity: 27600,  // nominal ~27,600 km/h
    }
  } catch {
    return null
  }
}

// Current crew from the community-maintained people-in-space feed. open-notify's
// astros.json is no longer updated (it still lists the 2024 crew).
export async function fetchAstronauts(): Promise<Astronaut[] | null> {
  try {
    const res = await fetch('https://corquaid.github.io/international-space-station-APIs/JSON/people-in-space.json', {
      next: { revalidate: 21600 }, signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`people-in-space ${res.status}`)
    const data = await res.json()
    const people: any[] = data.people ?? []
    return people.filter(p => p.iss).map(p => ({ name: p.name, craft: 'ISS' }))
  } catch {
    return null
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
