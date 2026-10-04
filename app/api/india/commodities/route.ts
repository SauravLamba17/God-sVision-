import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'
import { fetchMCXCommodities, getUsdInr } from '@/lib/apis/india'

export async function GET() {
  const key    = 'india_commodities'
  const cached = await getCache(key)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })

  const usdInr = await getUsdInr()
  if (usdInr === null) {
    // No live FX rate → no INR conversion, rather than converting at a guess.
    if (cached) return NextResponse.json({ data: cached.data, source: 'stale' })
    return NextResponse.json({ error: 'USD/INR rate unavailable' })
  }

  try {
    const commodities = await fetchMCXCommodities(usdInr)
    const result = { commodities, usdInr, fetchedAt: Date.now() }
    await setCache(key, result, 30)
    return NextResponse.json({ data: result, source: 'live' })
  } catch (err) {
    const fallback = await getCache(key)
    if (fallback) return NextResponse.json({ data: fallback.data, source: 'stale' })
    return NextResponse.json({ error: String(err) })
  }
}
