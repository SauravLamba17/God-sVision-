import { NextRequest, NextResponse } from 'next/server'
import { getWeather, getForecast, getNOAAAlerts, WORLD_CITIES, INDIA_CITIES } from '@/lib/apis/openweather'
import { setCache, getCache } from '@/lib/cache'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'cities'
  const region = searchParams.get('region') || 'world'
  const lat = parseFloat(searchParams.get('lat') || '40.71')
  const lon = parseFloat(searchParams.get('lon') || '-74.01')
  const city = searchParams.get('city') || 'New York'

  try {
    if (type === 'current') {
      const key = `weather_${city}`
      const cached = await getCache(key)
      if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cache' })
      const data = await getWeather(lat, lon, city)
      await setCache(key, data, 600)
      return NextResponse.json({ data, source: 'live' })
    }

    if (type === 'forecast') {
      const key = `forecast_${city}`
      const cached = await getCache(key)
      if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cache' })
      const data = await getForecast(lat, lon)
      await setCache(key, data, 600)
      return NextResponse.json({ data, source: 'live' })
    }

    if (type === 'noaa') {
      const key = 'noaa_alerts'
      const cached = await getCache(key)
      if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cache' })
      const data = await getNOAAAlerts()
      await setCache(key, data, 300)
      return NextResponse.json({ data, source: 'live' })
    }

    const cityList = region === 'india' ? INDIA_CITIES : WORLD_CITIES
    const key = region === 'india' ? 'weather_cities_india' : 'weather_cities'
    const cached = await getCache(key)
    if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cache' })
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
    return NextResponse.json({ error: msg, data: [], source: 'empty' })
  }
}
