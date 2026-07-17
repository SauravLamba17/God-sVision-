import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'
import { getQuotes } from '@/lib/apis/yahoo'

// Upcoming earnings dates (manually curated + updated periodically)
// These are approximate — within 2 weeks of now
const UPCOMING_EARNINGS: { ticker: string; date: string; epsEstimate: number | null; revenueEstimate: number | null }[] = [
  { ticker: 'AAPL',  date: '2026-07-31', epsEstimate: 1.57, revenueEstimate: 89.5e9 },
  { ticker: 'MSFT',  date: '2026-07-29', epsEstimate: 3.12, revenueEstimate: 68.9e9 },
  { ticker: 'GOOGL', date: '2026-07-29', epsEstimate: 2.18, revenueEstimate: 89.3e9 },
  { ticker: 'META',  date: '2026-07-29', epsEstimate: 6.32, revenueEstimate: 43.8e9 },
  { ticker: 'AMZN',  date: '2026-07-31', epsEstimate: 1.36, revenueEstimate: 159.2e9 },
  { ticker: 'NVDA',  date: '2026-08-27', epsEstimate: 0.89, revenueEstimate: 43.5e9 },
  { ticker: 'TSLA',  date: '2026-07-23', epsEstimate: 0.54, revenueEstimate: 27.2e9 },
  { ticker: 'JPM',   date: '2026-07-14', epsEstimate: 4.38, revenueEstimate: 43.1e9 },
  { ticker: 'V',     date: '2026-07-22', epsEstimate: 2.67, revenueEstimate: 9.7e9  },
  { ticker: 'JNJ',   date: '2026-07-16', epsEstimate: 2.61, revenueEstimate: 22.5e9 },
  { ticker: 'NFLX',  date: '2026-07-17', epsEstimate: 5.73, revenueEstimate: 11.1e9 },
  { ticker: 'AMD',   date: '2026-07-29', epsEstimate: 1.09, revenueEstimate: 7.7e9  },
  { ticker: 'INTC',  date: '2026-07-24', epsEstimate: 0.08, revenueEstimate: 12.8e9 },
  { ticker: 'GS',    date: '2026-07-15', epsEstimate: 10.85, revenueEstimate: 14.3e9 },
  { ticker: 'BAC',   date: '2026-07-15', epsEstimate: 0.87, revenueEstimate: 25.8e9 },
  { ticker: 'WFC',   date: '2026-07-11', epsEstimate: 1.33, revenueEstimate: 20.8e9 },
  { ticker: 'XOM',   date: '2026-08-01', epsEstimate: 1.92, revenueEstimate: 81.2e9 },
  { ticker: 'AVGO',  date: '2026-09-04', epsEstimate: 1.58, revenueEstimate: 14.9e9 },
  { ticker: 'PLTR',  date: '2026-08-04', epsEstimate: 0.13, revenueEstimate: 0.99e9 },
  { ticker: 'CRM',   date: '2026-08-26', epsEstimate: 2.59, revenueEstimate: 9.8e9  },
]

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker') || ''

  if (ticker) {
    const cacheKey = `earnings_ticker_v2_${ticker.toUpperCase()}`
    const cached = getCache(cacheKey)
    if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })

    // Get current price for context + look up upcoming date from our list
    const upcoming = UPCOMING_EARNINGS.find(e => e.ticker === ticker.toUpperCase())
    const quotes = await getQuotes([ticker.toUpperCase()])
    const q = quotes[0] || null

    const data = {
      ticker: ticker.toUpperCase(),
      nextEarningsDate: upcoming?.date || null,
      epsEstimate:      upcoming?.epsEstimate || null,
      revenueEstimate:  upcoming?.revenueEstimate || null,
      currentPrice:     q?.regularMarketPrice || null,
      history: [], // live history requires quoteSummary (crumb auth) — not available
    }

    setCache(cacheKey, data, 3600)
    return NextResponse.json({ data, source: 'live' })
  }

  // Upcoming earnings list — merge curated dates with live price data
  const cacheKey = 'earnings_upcoming_v2'
  const cached = getCache(cacheKey)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })

  try {
    const tickers = UPCOMING_EARNINGS.map(e => e.ticker)
    const quotes = await getQuotes(tickers)
    const priceMap: Record<string, number> = {}
    quotes.forEach((q: any) => { if (q?.symbol) priceMap[q.symbol] = q.regularMarketPrice })

    const now = new Date()
    const data = UPCOMING_EARNINGS
      .filter(e => new Date(e.date) >= new Date(now.getTime() - 3 * 86400000)) // include last 3 days
      .map(e => ({
        ...e,
        currentPrice: priceMap[e.ticker] || null,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    setCache(cacheKey, data, 3600)
    return NextResponse.json({ data, source: 'live' })
  } catch (err: any) {
    if (cached) return NextResponse.json({ data: cached.data, source: 'stale' })
    return NextResponse.json({ error: err?.message, data: [] })
  }
}
