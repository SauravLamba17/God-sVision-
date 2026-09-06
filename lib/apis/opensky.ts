import axios from 'axios'
import type { Aircraft } from '@/lib/flights'

// Aircraft shape lives in lib/flights.ts so the client map and this server
// fetcher can never drift apart.
export type { Aircraft }

// Thrown when OpenSky refuses on quota — callers should show an honest
// "rate limited" state, never fabricate frozen mock aircraft.
export class OpenSkyRateLimitError extends Error {
  constructor() {
    super('OpenSky rate limit reached')
    this.name = 'OpenSkyRateLimitError'
  }
}


export interface AircraftResult {
  aircraft: Aircraft[]
  /** OpenSky's own X-Rate-Limit-Remaining for this IP/account, when it sends one. */
  creditsRemaining: number | null
  /** Epoch seconds of OpenSky's own snapshot — the real freshness of these positions. */
  snapshotTime: number | null
  authenticated: boolean
}

/**
 * A small share of ADS-B state vectors carry corrupt decodes — a live global
 * snapshot typically holds a couple: a track of 483.5° (the field is documented
 * 0-360) or a ground speed of 3,342 kts. Showing those verbatim would assert a
 * physically impossible fact; nulling them means the UI omits the field instead,
 * which is the honest reading of "we do not know this".
 * ponytail: fixed physical bounds, not a statistical outlier filter — enough for
 * junk this coarse, revisit if real values start getting clipped.
 */
export function sane(value: number | null | undefined, min: number, max: number, dp = 0): number | null {
  if (value == null || !Number.isFinite(value)) return null
  if (value < min || value > max) return null
  // Unit conversion invents digits the source never had: OpenSky sends a
  // barometric altitude of 10668 m, and 10668 * 3.28084 is 35000.00112 ft.
  // Reporting that claims micrometre precision on a reading good to ~25 ft, so
  // round back to the honest resolution. It also roughly halves the JSON we
  // ship, which is what the aircraft cap in the route is fighting.
  const f = 10 ** dp
  return Math.round(value * f) / f
}

const TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token'

let tokenCache: { token: string; expiresAt: number } | null = null

// OpenSky dropped HTTP Basic auth: "OpenSky exclusively supports the OAuth2
// client credentials flow. Basic authentication with username and password is
// no longer accepted." So OPENSKY_USERNAME/OPENSKY_PASSWORD do nothing — this
// needs an API client (client_id + client_secret) created in account settings.
// Anonymous access still works but is capped at 400 credits/day PER IP, which
// on shared Vercel egress is effectively always spent by someone else.
async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.OPENSKY_CLIENT_ID
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token

  try {
    const { data } = await axios.post(
      TOKEN_URL,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 },
    )
    // Tokens last 30 min; refresh a minute early so an in-flight call never
    // dies on a token that expired between issue and use.
    const ttl = (data.expires_in ?? 1800) - 60
    tokenCache = { token: data.access_token, expiresAt: Date.now() + ttl * 1000 }
    return tokenCache.token
  } catch {
    // Bad or revoked credentials shouldn't take the feature down — fall through
    // to anonymous, which still works (just on a much smaller credit budget).
    return null
  }
}

export async function getAllAircraft(bounds?: {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
}): Promise<AircraftResult> {
  const params: Record<string, number> = {}
  if (bounds) {
    params.lamin = bounds.minLat
    params.lamax = bounds.maxLat
    params.lomin = bounds.minLon
    params.lomax = bounds.maxLon
  }

  const token = await getAccessToken()

  try {
    const res = await axios.get('https://opensky-network.org/api/states/all', {
      params,
      timeout: 15000,
      headers: {
        'User-Agent': 'GodVision/1.0',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    const data = res.data
    const remaining = res.headers['x-rate-limit-remaining']
    const states = data.states || []

    const aircraft: Aircraft[] = states
      .filter((s: (string | number | null)[]) => s[5] !== null && s[6] !== null)
      .map((s: (string | number | null)[]) => ({
        icao24: String(s[0] || ''),
        callsign: String(s[1] || '').trim(),
        originCountry: String(s[2] || ''),
        // s[3] last_contact, s[4] time_position — s[4] is the position fix we plot.
        lastContact: (s[4] ?? s[3] ?? null) as number | null,
        longitude: s[5] as number | null,
        latitude: s[6] as number | null,
        // baro_altitude is metres; fall back to geo_altitude (s[13]) when the
        // barometric reading is missing, which OpenSky does report for some craft.
        altitude: sane(
          s[7] != null ? (s[7] as number) * 3.28084 : s[13] != null ? (s[13] as number) * 3.28084 : null,
          -1500, 60000,
        ),
        onGround: Boolean(s[8]),
        velocity: sane(s[9] != null ? (s[9] as number) * 1.94384 : null, 0, 700),
        heading: sane(s[10] as number | null, 0, 360, 1),
        // m/s → ft/min, the unit every cockpit and tracker actually shows.
        verticalRate: sane(s[11] != null ? (s[11] as number) * 196.85 : null, -8000, 8000),
        squawk: s[14] as string | null,
      }))

    return {
      aircraft,
      creditsRemaining: remaining != null ? Number(remaining) : null,
      snapshotTime: typeof data.time === 'number' ? data.time : null,
      authenticated: token !== null,
    }
  } catch (err: any) {
    // OpenSky does not always answer an exhausted quota with 429 — on shared
    // datacenter egress (Vercel) it also returns 403 once the day's credits are
    // spent. Both are the same condition to a caller, and only this branch
    // produces the honest "rate limited, showing last known positions" state.
    const status = err?.response?.status
    if (status === 429 || status === 403 || err?.message?.includes('429')) {
      throw new OpenSkyRateLimitError()
    }
    // A 401 means our token went stale mid-flight; drop it so the next call
    // mints a fresh one rather than looping on a dead token.
    if (status === 401) tokenCache = null
    throw err
  }
}

export function getRegionCounts(aircraft: Aircraft[]) {
  const inBox = (a: Aircraft, lo: number, hi: number, la: number, lb: number) =>
    a.longitude !== null && a.latitude !== null &&
    a.longitude >= lo && a.longitude <= hi && a.latitude >= la && a.latitude <= lb

  return {
    total: aircraft.length,
    usa: aircraft.filter(a => inBox(a, -125, -66, 24, 50)).length,
    europe: aircraft.filter(a => inBox(a, -10, 40, 35, 72)).length,
    asia: aircraft.filter(a => inBox(a, 60, 150, 0, 55)).length,
  }
}
