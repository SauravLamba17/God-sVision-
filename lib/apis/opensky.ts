import axios from 'axios'

// MOCK DATA — used when OpenSky is rate-limited (429)
const MOCK_AIRCRAFT: Aircraft[] = [
  { icao24:'a0b1c2', callsign:'UAL234', originCountry:'United States', longitude:-87.65, latitude:41.97, altitude:35000, onGround:false, velocity:480, heading:270, verticalRate:0, squawk:'1200' },
  { icao24:'b1c2d3', callsign:'DAL456', originCountry:'United States', longitude:-73.78, latitude:40.64, altitude:0,     onGround:true,  velocity:0,   heading:90,  verticalRate:0, squawk:'7700' },
  { icao24:'c2d3e4', callsign:'BAW175', originCountry:'United Kingdom', longitude:-0.46, latitude:51.47, altitude:38000, onGround:false, velocity:510, heading:300, verticalRate:0, squawk:'1300' },
  { icao24:'d3e4f5', callsign:'LFT882', originCountry:'France',         longitude:2.55,  latitude:48.99, altitude:32000, onGround:false, velocity:460, heading:185, verticalRate:-200, squawk:'2100' },
  { icao24:'e4f5a6', callsign:'SWA1234', originCountry:'United States', longitude:-105.0,latitude:39.85, altitude:33000, onGround:false, velocity:490, heading:90,  verticalRate:0, squawk:'0001' },
  { icao24:'f5a6b7', callsign:'CCA901', originCountry:'China',          longitude:121.3, latitude:31.15, altitude:36000, onGround:false, velocity:505, heading:40,  verticalRate:100, squawk:'1234' },
  { icao24:'a6b7c8', callsign:'EZY445', originCountry:'United Kingdom', longitude:13.40, latitude:52.51, altitude:28000, onGround:false, velocity:440, heading:220, verticalRate:-300, squawk:'3300' },
  { icao24:'b7c8d9', callsign:'ANA787', originCountry:'Japan',          longitude:139.77,latitude:35.68, altitude:0,     onGround:true,  velocity:0,   heading:0,   verticalRate:0, squawk:'0000' },
  { icao24:'c8d9e0', callsign:'AFR001', originCountry:'France',         longitude:-43.17,latitude:-22.8, altitude:37000, onGround:false, velocity:520, heading:30,  verticalRate:0, squawk:'4400' },
  { icao24:'d9e0f1', callsign:'QFA002', originCountry:'Australia',      longitude:151.2, latitude:-33.9, altitude:39000, onGround:false, velocity:515, heading:270, verticalRate:0, squawk:'5500' },
  { icao24:'e0f1a2', callsign:'AAL100', originCountry:'United States', longitude:-118.4, latitude:33.94, altitude:0,     onGround:true,  velocity:0,   heading:0,   verticalRate:0, squawk:'0000' },
  { icao24:'f1a2b3', callsign:'SIA21',  originCountry:'Singapore',      longitude:103.98,latitude:1.35,  altitude:35000, onGround:false, velocity:500, heading:300, verticalRate:0, squawk:'6600' },
]

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

  try {
    const { data } = await axios.get('https://opensky-network.org/api/states/all', {
      params,
      timeout: 15000,
      headers: { 'User-Agent': 'GodVision/1.0' }
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
    if (err?.response?.status === 429 || err?.message?.includes('429')) {
      return MOCK_AIRCRAFT
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
