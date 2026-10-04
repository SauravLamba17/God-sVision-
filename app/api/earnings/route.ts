import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'
import { getQuotes } from '@/lib/apis/yahoo'

// Upcoming earnings from Nasdaq's public calendar (no key). This replaced a
// hand-curated list of July 2026 dates and invented EPS/revenue estimates that
// went stale the week it was written.
const NASDAQ_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
}
const MIN_MARKET_CAP = 10e9 // keep the list to large caps
const DAYS_AHEAD = 14

interface Upcoming { ticker: string; date: string; epsEstimate: number | null; epsLow: null; epsHigh: null; revenueEstimate: null; timing: string }

const num = (s?: string) => {
  const n = parseFloat(String(s ?? '').replace(/[$,()]/g, ''))
  return Number.isFinite(n) ? (String(s).includes('(') ? -n : n) : null
}

async function fetchUpcoming(): Promise<Upcoming[]> {
  const days: string[] = []
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = new Date(Date.now() + i * 86400000)
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) days.push(d.toISOString().slice(0, 10))
  }
  const results = await Promise.allSettled(days.map(async date => {
    const res = await fetch(`https://api.nasdaq.com/api/calendar/earnings?date=${date}`, { headers: NASDAQ_HEADERS, next: { revalidate: 3600 }, signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error(`nasdaq ${res.status}`)
    const rows: any[] = (await res.json())?.data?.rows ?? []
    return rows
      .filter(r => (num(r.marketCap) ?? 0) >= MIN_MARKET_CAP)
      .map(r => ({
        ticker: r.symbol, date, epsEstimate: num(r.epsForecast), epsLow: null, epsHigh: null, revenueEstimate: null,
        timing: r.time === 'time-pre-market' ? 'BMO' : r.time === 'time-after-hours' ? 'AMC' : '—',
      }))
  }))
  if (results.every(r => r.status === 'rejected')) throw new Error('Nasdaq earnings calendar unavailable')
  return results.flatMap(r => (r.status === 'fulfilled' ? r.value : []))
}

async function getUpcoming(): Promise<Upcoming[]> {
  const cached = await getCache<Upcoming[]>('earnings_upcoming_v3')
  if (cached && !cached.stale) return cached.data
  try {
    const data = await fetchUpcoming()
    await setCache('earnings_upcoming_v3', data, 3600)
    return data
  } catch (e) {
    if (cached) return cached.data
    throw e
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker') || ''

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
