import { NextResponse } from 'next/server'
import { getIndiaForexCached } from '@/lib/apis/cachedLoaders'

// ISR: regenerated at most every 60s (prices/tickers). Without this the route was
// prerendered at build and served build-time data forever.
export const revalidate = 60

export async function GET() {
  try {
    const { data, source } = await getIndiaForexCached()
    return NextResponse.json({ data, source })
  } catch (err) {
    return NextResponse.json({ error: String(err) })
  }
}
