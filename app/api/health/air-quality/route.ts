import { NextRequest, NextResponse } from 'next/server'
import { fetchAirQuality } from '@/lib/apis/airQuality'

export async function GET(req: NextRequest) {
  const region = req.nextUrl.searchParams.get('region') === 'india' ? 'india' : 'world'

  try {
    const data = await fetchAirQuality(region)
    return NextResponse.json({ data, source: 'live' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg, data: [], source: 'unavailable' })
  }
}
