import { NextRequest, NextResponse } from 'next/server'
import { getEarthquakesCached } from '@/lib/apis/usgs'
import { z } from 'zod'
import { parseQuery, numParam } from '@/lib/validation'

const Query = z.object({ type: z.enum(['recent', 'significant']).default('recent'), minMag: numParam(0, 10).default(2.5) })

export async function GET(request: NextRequest) {
  const q = parseQuery(request, Query)
  if (q.error) return q.error
  const { type, minMag } = q.data

  try {
    const { data, source } = await getEarthquakesCached(type, minMag)
    return NextResponse.json({ data, source })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
}
