import { NextRequest, NextResponse } from 'next/server'
import { getAllAircraft, getRegionCounts, OpenSkyRateLimitError } from '@/lib/apis/opensky'
import { setCache, getCache } from '@/lib/cache'

// OpenSky refreshes state vectors every 5-10s, so anything under ~30s of cache
// buys no freshness and just burns credits (a global /states/all costs 4 of the
// 400 daily anonymous credits — about 100 calls/day for the WHOLE Vercel egress
// IP, shared with every other tenant in the region). 30s keeps one page open all
// day well inside budget while still reading as near-real-time.
const CACHE_TTL_SECONDS = 30

// Upstash rejects values over ~1MB, and a full global snapshot is ~6,700
// aircraft (~1.2MB of JSON) — over the line, which would make every cache write
// fail silently and send every single request straight to OpenSky. Cap what we
// ship; counts below are still computed on the FULL set so the stats bar stays
// truthful about how many aircraft are really up.
const MAX_AIRCRAFT_SHIPPED = 3000

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const bounds = searchParams.get('bounds')

  const key = bounds ? `flights_${bounds}` : 'flights_all'
  const cached = await getCache<any>(key)
  if (cached && !cached.stale) {
    return NextResponse.json({ ...cached.data, source: 'cache' })
  }

  try {
    const parsedBounds = bounds ? JSON.parse(bounds) : undefined
    const { aircraft, creditsRemaining, snapshotTime, authenticated } = await getAllAircraft(parsedBounds)

    const counts = getRegionCounts(aircraft)
    const shipped = aircraft.slice(0, MAX_AIRCRAFT_SHIPPED)

    const payload = {
      data: { aircraft: shipped, counts },
      truncated: aircraft.length > shipped.length,
      snapshotTime,
      creditsRemaining,
      authenticated,
      fetchedAt: Date.now(),
    }

    await setCache(key, payload, CACHE_TTL_SECONDS)
    return NextResponse.json({ ...payload, source: 'live' })
  } catch (error) {
    if (error instanceof OpenSkyRateLimitError) {
      // Genuinely rate limited — return the last good cache (even if stale)
      // rather than frozen mock data, or an honest empty state.
      if (cached) {
        return NextResponse.json({ ...cached.data, source: 'stale', rateLimited: true })
      }
      return NextResponse.json({
        data: { aircraft: [], counts: { total: 0, usa: 0, europe: 0, asia: 0 } },
        rateLimited: true,
        message: 'OpenSky rate limit reached',
      })
    }

    const msg = error instanceof Error ? error.message : 'Unknown error'
    if (cached) return NextResponse.json({ ...cached.data, source: 'stale', error: msg })
    return NextResponse.json(
      { error: msg, data: { aircraft: [], counts: { total: 0, usa: 0, europe: 0, asia: 0 } } },
      { status: 200 },
    )
  }
}
