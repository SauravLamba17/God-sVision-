import { getCache, setCache } from '@/lib/cache'
import { WORLD_CITIES, INDIA_CITIES } from '@/lib/apis/openweather'
import { aqiBand, type CityAqi } from '@/lib/aqi'
import { trackedFetch as fetch } from '@/lib/feedHealth' // records feed health; same fetch semantics

/**
 * Per-city air quality for the weather panels.
 *
 * NOT OpenAQ: v1/v2 now answer HTTP 410 ("retired"), and v3 answers 401 without
 * an X-API-Key, so there is no keyless OpenAQ path left. Open-Meteo's air
 * quality API is keyless, takes the lat/lon already on the shared city lists
 * (OpenAQ took a city NAME and had no station for several of them), returns the
 * US EPA AQI directly rather than making us derive it from raw PM2.5, and is
 * already this codebase's weather fallback — same vendor, same reliability.
 */
const AQ_API = 'https://air-quality-api.open-meteo.com/v1/air-quality'

// Air quality moves on the hour upstream, so half an hour of cache costs
// nothing in freshness.
const TTL_SECONDS = 1800

export async function fetchAirQuality(region: 'world' | 'india'): Promise<CityAqi[]> {
  const cities = region === 'india' ? INDIA_CITIES : WORLD_CITIES
  const cacheKey = `air_quality_${region}`

  const cached = await getCache<CityAqi[]>(cacheKey)
  if (cached && !cached.stale) return cached.data

  // One batched request — Open-Meteo accepts comma-separated coordinates and
  // answers with one result object per city, in order.
  const url =
    `${AQ_API}?latitude=${cities.map(c => c.lat).join(',')}` +
    `&longitude=${cities.map(c => c.lon).join(',')}` +
    `&current=us_aqi,pm2_5`

  try {
    const res = await fetch(url, { next: { revalidate: 900 }, signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error(`Open-Meteo air quality responded ${res.status}`)

    const json = await res.json()
    // A single-city request comes back as an object, a multi-city one as an array.
    const rows: any[] = Array.isArray(json) ? json : [json]

    const data: CityAqi[] = cities.map((c, i) => {
      const aqiRaw = rows[i]?.current?.us_aqi
      const pmRaw = rows[i]?.current?.pm2_5
      const aqi = typeof aqiRaw === 'number' && Number.isFinite(aqiRaw) ? Math.round(aqiRaw) : null
      return {
        city: c.name,
        aqi,
        pm25: typeof pmRaw === 'number' && Number.isFinite(pmRaw) ? pmRaw : null,
        // A city the upstream has no reading for stays in the list with a null
        // band, so the caller renders "no data" rather than dropping the card
        // or inventing a number.
        band: aqi === null ? null : aqiBand(aqi),
      }
    })

    await setCache(cacheKey, data, TTL_SECONDS)
    return data
  } catch {
    if (cached) return cached.data
    // Every city null — the weather cards then render temperature only.
    return cities.map(c => ({ city: c.name, aqi: null, pm25: null, band: null }))
  }
}
