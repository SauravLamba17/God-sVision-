import { NextRequest, NextResponse } from 'next/server'
import { getRecentEarthquakes, getSignificantEarthquakes } from '@/lib/apis/usgs'
import { setCache, getCache } from '@/lib/cache'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'recent'
  const minMag = parseFloat(searchParams.get('minMag') || '2.5')

  const key = `earthquakes_${type}_${minMag}`
  const cached = await getCache(key)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cache' })

  try {
    const data = type === 'significant'
      ? await getSignificantEarthquakes()
      : await getRecentEarthquakes(minMag)
    await setCache(key, data, 60)
    return NextResponse.json({ data, source: 'live' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    if (cached) return NextResponse.json({ data: cached.data, source: 'cached', error: msg })
    return NextResponse.json({ error: msg })
  }
}
