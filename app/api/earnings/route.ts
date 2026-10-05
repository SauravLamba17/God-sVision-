import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'
import { getQuotes } from '@/lib/apis/yahoo'
import { z } from 'zod'
import { parseQuery, ticker } from '@/lib/validation'
import { getUpcoming, type Upcoming } from '@/lib/apis/earnings'

const Query = z.object({ ticker: ticker.optional() })

export async function GET(req: Request) {
  const q = parseQuery(req, Query)
  if (q.error) return q.error
  const ticker = q.data.ticker ?? ''

  if (ticker) {
    const cacheKey = `earnings_ticker_v3_${ticker.toUpperCase()}`
    const cached = await getCache(cacheKey)
    if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })

    // Get current price for context + look up upcoming date from our list
    const upcoming = (await getUpcoming().catch(() => [] as Upcoming[])).find(e => e.ticker === ticker.toUpperCase())
    const quotes = await getQuotes([ticker.toUpperCase()])
    const q = quotes[0] || null

    const data = {
      ticker: ticker.toUpperCase(),
      nextEarningsDate: upcoming?.date || null,
      epsEstimate:      upcoming?.epsEstimate || null,
      revenueEstimate:  null,
      currentPrice:     q?.regularMarketPrice || null,
      history: [], // live history requires quoteSummary (crumb auth) — not available
    }

    await setCache(cacheKey, data, 3600)
    return NextResponse.json({ data, source: 'live' })
  }

  // Upcoming earnings list
  try {
    const data = await getUpcoming()
    return NextResponse.json({ data, source: 'live' })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message, data: [] })
  }
}
