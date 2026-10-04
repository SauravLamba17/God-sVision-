import { NextRequest, NextResponse } from 'next/server'
import { getWeather, getForecast, getNOAAAlerts, WORLD_CITIES, INDIA_CITIES } from '@/lib/apis/openweather'
import { setCache, getCache } from '@/lib/cache'
import { z } from 'zod'
import { parseQuery, numParam, shortText } from '@/lib/validation'

const Query = z.object({
  type: z.enum(['cities', 'current', 'forecast', 'noaa']).default('cities'),
  region: z.enum(['world', 'india']).default('world'),
  lat: numParam(-90, 90).default(40.71),
  lon: numParam(-180, 180).default(-74.01),
  city: shortText(80).default('New York'),
})

export async function GET(request: NextRequest) {
  const q = parseQuery(request, Query)
  if (q.error) return q.error
  const { type, region, lat, lon, city } = q.data

  try {
    if (type === 'current') {
      const key = `weather_${city}`
      const cached = await getCache(key)
      if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })
      const data = await getWeather(lat, lon, city)
      await setCache(key, data, 600)
      return NextResponse.json({ data, source: 'live' })
    }

    if (type === 'forecast') {
      const key = `forecast_${city}`
      const cached = await getCache(key)
      if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })
      const data = await getForecast(lat, lon)
      await setCache(key, data, 600)
      return NextResponse.json({ data, source: 'live' })
    }

    if (type === 'noaa') {
      const key = 'noaa_alerts'
      const cached = await getCache(key)
      if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })
      const data = await getNOAAAlerts()
      await setCache(key, data, 300)
      return NextResponse.json({ data, source: 'live' })
    }

    const cityList = region === 'india' ? INDIA_CITIES : WORLD_CITIES
    const key = region === 'india' ? 'weather_cities_india' : 'weather_cities'
    const cached = await getCache(key)
    if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })
    const results = await Promise.allSettled(
      cityList.map(c => getWeather(c.lat, c.lon, c.name))
    )
    const data = results
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof getWeather>>> => r.status === 'fulfilled')
      .map(r => r.value)
      .filter(Boolean)
    await setCache(key, data, 600)
    return NextResponse.json({ data, source: 'live' })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg, data: [], source: 'unavailable' })
  }
}
