import { NextRequest, NextResponse } from 'next/server'
import { getRecentEarthquakes, getSignificantEarthquakes } from '@/lib/apis/usgs'
import { setCache, getCache } from '@/lib/cache'
import { z } from 'zod'
import { parseQuery, numParam } from '@/lib/validation'

const Query = z.object({ type: z.enum(['recent', 'significant']).default('recent'), minMag: numParam(0, 10).default(2.5) })

export async function GET(request: NextRequest) {
  const q = parseQuery(request, Query)
  if (q.error) return q.error
  const { type, minMag } = q.data

  const key = `earthquakes_${type}_${minMag}`
  const cached = await getCache(key)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })

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
