import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'
import { fetchIndiaForex, getUsdInr } from '@/lib/apis/india'

// ISR: regenerated at most every 60s (prices/tickers). Without this the route was
// prerendered at build and served build-time data forever.
export const revalidate = 60

export async function GET() {
  const key    = 'india_forex'
  const cached = await getCache(key)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })

  const exchangeRate = await getUsdInr()

  try {
    const pairs = await fetchIndiaForex(exchangeRate)
    const result = { pairs, usdInr: exchangeRate, fetchedAt: Date.now() }
    await setCache(key, result, 60)
    return NextResponse.json({ data: result, source: 'live' })
  } catch (err) {
    const fallback = await getCache(key)
    if (fallback) return NextResponse.json({ data: fallback.data, source: 'stale' })
    return NextResponse.json({ error: String(err) })
  }
}
