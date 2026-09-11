import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'
import { fetchNifty50Quotes, getIndianMarketStatus } from '@/lib/apis/india'

// fetchChart() names its fields price/changePct/volume, but every movers table
// in the app reads the Yahoo `regularMarket*` names that /api/stocks emits.
// Emitting that same shape here is what keeps the NIFTY MOVERS table from
// rendering a full column of N/A against correctly-resolved company names.
const toMoverRow = (q: any) => ({
  symbol:                     q.symbol,
  shortName:                  q.shortName,
  regularMarketPrice:         q.price,
  regularMarketChange:        q.change,
  regularMarketChangePercent: q.changePct,
  regularMarketVolume:        q.volume,
})

export async function GET() {
  const key    = 'india_movers'
  const cached = await getCache(key)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })

  try {
    const status  = getIndianMarketStatus()
    // A quote with no numeric price would otherwise sort as NaN and take a slot
    // in the top 10 that a real mover should have had.
    const quotes  = (await fetchNifty50Quotes())
      .filter(q => Number.isFinite(q.price) && Number.isFinite(q.changePct))
    const ttl     = status === 'OPEN' ? 30 : 300
    const sorted  = [...quotes].sort((a, b) => b.changePct - a.changePct)
    const result  = {
      gainers: sorted.slice(0, 10).map(toMoverRow),
      losers:  sorted.slice(-10).reverse().map(toMoverRow),
      active:  [...quotes].sort((a, b) => b.volume - a.volume).slice(0, 10).map(toMoverRow),
      marketStatus: status,
      fetchedAt: Date.now(),
    }
    await setCache(key, result, ttl)
    return NextResponse.json({ data: result, source: 'live' })
  } catch (err) {
    const fallback = await getCache(key)
    if (fallback) return NextResponse.json({ data: fallback.data, source: 'stale' })
    return NextResponse.json({ error: String(err) })
  }
}
