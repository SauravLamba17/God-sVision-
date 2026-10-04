import { NextResponse } from 'next/server'
import { fetchISSData } from '@/lib/apis/iss'

// ISR: regenerated at most every 60s (prices/tickers). Without this the route was
// prerendered at build and served build-time data forever.
export const revalidate = 60

export async function GET() {
  try {
    const data = await fetchISSData()
    return NextResponse.json({ data, source: data.position ? 'live' : 'unavailable' }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, data: null, source: 'unavailable' })
  }
}
