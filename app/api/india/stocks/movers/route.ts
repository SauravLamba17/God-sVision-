import { NextResponse } from 'next/server'
import { getNifty50QuotesCached } from '@/lib/apis/cachedLoaders'

// ISR: regenerated at most every 60s (prices/tickers). Without this the route was
// prerendered at build and served build-time data forever.
export const revalidate = 60

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
  try {
    const { data, source } = await getNifty50QuotesCached()
    const { quotes, marketStatus } = data
    const sorted = [...quotes].sort((a, b) => b.changePct - a.changePct)
    const result = {
      gainers: sorted.slice(0, 10).map(toMoverRow),
      losers:  sorted.slice(-10).reverse().map(toMoverRow),
      active:  [...quotes].sort((a, b) => b.volume - a.volume).slice(0, 10).map(toMoverRow),
      marketStatus,
      fetchedAt: data.fetchedAt,
    }
    return NextResponse.json({ data: result, source })
  } catch (err) {
    return NextResponse.json({ error: String(err) })
  }
}
