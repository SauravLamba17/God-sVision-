import { NextResponse } from 'next/server'
import { getCryptoTop100 } from '@/lib/apis/coingecko'
import { getCache, setCache } from '@/lib/cache'

// Public ticker feed for the marketing landing page's marquee. Lives under
// /api/public so it inherits the same middleware exemption the Sheets API uses
// (matcher negative-lookahead + publicPaths), but unlike /api/public/gv it
// takes no API key — anonymous visitors are the entire audience.
//
// Only crypto is live. Equity indices, FX and commodities in the tape stay at
// the design's illustrative values: the Yahoo path is rate-limit fragile and
// this endpoint is hit by every anonymous visitor, so a landing-page marquee
// is not worth spending that budget on. The client merges these rows over its
// static array by symbol.
const CACHE_KEY = 'public_ticker'
const TTL = 60

// CoinGecko market rows we surface, in tape order.
const WANTED = ['BTC', 'ETH', 'SOL']

export interface TickerRow {
  symbol: string
  price: number
  changePercent: number
}

export async function GET() {
  const cached = await getCache<TickerRow[]>(CACHE_KEY)
  if (cached && !cached.stale) return NextResponse.json(cached.data)

  try {
    const markets = await getCryptoTop100()
    const rows: TickerRow[] = WANTED.flatMap(sym => {
      const m = markets.find((c: any) => c.symbol?.toUpperCase() === sym)
      if (!m || typeof m.current_price !== 'number') return []
      return [{
        symbol: sym,
        price: m.current_price,
        changePercent: m.price_change_percentage_24h ?? 0,
      }]
    })

    if (!rows.length) throw new Error('no usable rows from upstream')

    await setCache(CACHE_KEY, rows, TTL)
    return NextResponse.json(rows)
  } catch (e) {
    // Serve stale over nothing — the marquee would rather show a minute-old
    // price than fall back to the static array.
    if (cached) return NextResponse.json(cached.data)
    console.error('[public/ticker]', e)
    return NextResponse.json([], { status: 200 })
  }
}
