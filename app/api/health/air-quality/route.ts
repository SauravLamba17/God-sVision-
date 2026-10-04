import { NextRequest, NextResponse } from 'next/server'
import { fetchAirQuality } from '@/lib/apis/airQuality'
import { z } from 'zod'
import { parseQuery } from '@/lib/validation'

const Query = z.object({ region: z.enum(['world', 'india']).default('world') })

export async function GET(req: NextRequest) {
  const q = parseQuery(req, Query)
  if (q.error) return q.error
  const { region } = q.data

  try {
    const data = await fetchAirQuality(region)
    return NextResponse.json({ data, source: 'live' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg, data: [], source: 'unavailable' })
  }
}
