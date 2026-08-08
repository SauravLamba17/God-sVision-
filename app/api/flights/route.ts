import { NextRequest, NextResponse } from 'next/server'
import { getAllAircraft, getRegionCounts, OpenSkyRateLimitError } from '@/lib/apis/opensky'
import { setCache, getCache } from '@/lib/cache'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const bounds = searchParams.get('bounds')

  const key = bounds ? `flights_${bounds}` : 'flights_all'
  const cached = await getCache(key)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cache' })

  try {
    const parsedBounds = bounds ? JSON.parse(bounds) : undefined
    const aircraft = await getAllAircraft(parsedBounds)
    const counts = getRegionCounts(aircraft)
    const data = { aircraft, counts }
    await setCache(key, data, 10)
    return NextResponse.json({ data, source: 'live' })
  } catch (error) {
    if (error instanceof OpenSkyRateLimitError) {
      // Genuinely rate limited — return the last good cache (even if
      // stale) rather than frozen mock data, or an honest empty state.
      if (cached) return NextResponse.json({ data: cached.data, source: 'stale', rateLimited: true })
      return NextResponse.json({
        data: { aircraft: [], counts: { total: 0, usa: 0, europe: 0, asia: 0 } },
        rateLimited: true,
        message: 'OpenSky rate limit reached',
      })
    }
    const msg = error instanceof Error ? error.message : 'Unknown error'
    if (cached) return NextResponse.json({ data: cached.data, source: 'cached', error: msg })
    return NextResponse.json({ error: msg, data: { aircraft: [], counts: { total: 0, usa: 0, europe: 0, asia: 0 } } }, { status: 200 })
  }
}
