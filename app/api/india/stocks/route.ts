import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'
import { fetchNifty50Quotes, getIndianMarketStatus } from '@/lib/apis/india'
export async function GET() {
  const key    = 'india_stocks'
  const cached = getCache(key)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })

  try {
    const quotes  = await fetchNifty50Quotes()
    const status  = getIndianMarketStatus()
    const ttl     = status === 'OPEN' ? 30 : 300
    const sorted  = [...quotes].sort((a, b) => b.changePct - a.changePct)
    const result  = {
      quotes,
      gainers: sorted.slice(0, 10),
      losers:  sorted.slice(-10).reverse(),
      active:  [...quotes].sort((a, b) => b.volume - a.volume).slice(0, 10),
      marketStatus: status,
      fetchedAt: Date.now(),
    }
    setCache(key, result, ttl)
    return NextResponse.json({ data: result, source: 'live' })
  } catch (err) {
    const fallback = getCache(key)
    if (fallback) return NextResponse.json({ data: fallback.data, source: 'stale' })
    return NextResponse.json({ error: String(err) })
  }
}
