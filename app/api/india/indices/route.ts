import { NextResponse } from 'next/server'
import { getIndiaIndicesCached } from '@/lib/apis/cachedLoaders'

// ISR: regenerated at most every 60s (prices/tickers). Without this the route was
// prerendered at build and served build-time data forever.
export const revalidate = 60
export async function GET() {
  try {
    const { data, source } = await getIndiaIndicesCached()
    return NextResponse.json({ data, source })
  } catch (err) {
    return NextResponse.json({ error: String(err), data: { indices: [], marketStatus: 'CLOSED', fetchedAt: Date.now() }, source: 'unavailable' })
  }
}
