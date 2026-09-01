import axios from 'axios'

// Thrown when OpenSky returns 429 — callers should show an honest
// "rate limited" state, never fabricate frozen mock aircraft.
export class OpenSkyRateLimitError extends Error {
  constructor() {
    super('OpenSky rate limit reached')
    this.name = 'OpenSkyRateLimitError'
  }
}

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
}

export async function getAllAircraft(bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number }): Promise<Aircraft[]> {
  const params: Record<string, number> = {}
  if (bounds) {
    params.lamin = bounds.minLat
    params.lamax = bounds.maxLat
    params.lomin = bounds.minLon
    params.lomax = bounds.maxLon
  }

  // Authenticated OpenSky requests get a far higher rate limit than
  // anonymous ones (~4000 credits/day vs almost nothing). Add
  // OPENSKY_USERNAME / OPENSKY_PASSWORD to .env.local to enable —
  // falls back to anonymous access if either is missing.
  const username = process.env.OPENSKY_USERNAME
  const password = process.env.OPENSKY_PASSWORD
  const auth = username && password ? { username, password } : undefined

  try {
    const { data } = await axios.get('https://opensky-network.org/api/states/all', {
      params,
      timeout: 15000,
      headers: { 'User-Agent': 'GodVision/1.0' },
      ...(auth ? { auth } : {}),
    })

    const states = data.states || []
    return states
      .filter((s: (string | number | null)[]) => s[5] !== null && s[6] !== null)
      .map((s: (string | number | null)[]) => ({
        icao24: String(s[0] || ''),
        callsign: String(s[1] || '').trim(),
        originCountry: String(s[2] || ''),
        longitude: s[5] as number | null,
        latitude: s[6] as number | null,
        altitude: s[7] ? (s[7] as number) * 3.28084 : null,
        onGround: Boolean(s[8]),
        velocity: s[9] ? (s[9] as number) * 1.94384 : null,
        heading: s[10] as number | null,
        verticalRate: s[11] as number | null,
        squawk: s[14] as string | null,
      }))
      .slice(0, 3000)
  } catch (err: any) {
    // OpenSky does not always answer an exhausted anonymous quota with 429 — on
    // shared datacenter egress (Vercel) it also returns 403 once the day's
    // credits are spent. Both are the same condition to a caller, and only this
    // branch produces the honest "rate limited, showing last known positions"
    // state; anything else falls through to a bare "no data available".
    const status = err?.response?.status
    if (status === 429 || status === 403 || err?.message?.includes('429')) {
      throw new OpenSkyRateLimitError()
    }
    throw err
  }
}

export function getRegionCounts(aircraft: Aircraft[]) {
  return {
    total: aircraft.length,
    usa: aircraft.filter(a => a.longitude !== null && a.latitude !== null && a.longitude >= -125 && a.longitude <= -66 && a.latitude >= 24 && a.latitude <= 50).length,
    europe: aircraft.filter(a => a.longitude !== null && a.latitude !== null && a.longitude >= -10 && a.longitude <= 40 && a.latitude >= 35 && a.latitude <= 72).length,
    asia: aircraft.filter(a => a.longitude !== null && a.latitude !== null && a.longitude >= 60 && a.longitude <= 150 && a.latitude >= 0 && a.latitude <= 55).length,
  }
}
