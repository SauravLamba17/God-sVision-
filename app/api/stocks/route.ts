import { NextRequest, NextResponse } from 'next/server'
import { getQuotes, getQuote, getChartData, getQuoteSummary, getOptionsChain, getMarketMovers, DEFAULT_TICKERS } from '@/lib/apis/yahoo'
import { setCache, getCache } from '@/lib/cache'
import { z } from 'zod'
import { parseQuery, ticker, tickerList } from '@/lib/validation'

const Query = z.object({
  ticker: ticker.optional(),
  type: z.enum(['quotes', 'movers', 'chart', 'summary', 'options']).default('quotes'),
  period: z.enum(['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max']).default('3mo'),
  tickers: tickerList(60).optional(),
})

// Cache-Control header values for browser-side caching between tab switches
const CACHE_HEADER = 'public, max-age=120, stale-while-revalidate=300'

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': CACHE_HEADER },
  })
}

export async function GET(request: NextRequest) {
  const q = parseQuery(request, Query)
  if (q.error) return q.error
  const { ticker, type, period } = q.data

  if (type === 'movers') {
    const cacheKey = 'market_movers'
    const cached = await getCache(cacheKey)
    if (cached && !cached.stale) return json({ data: cached.data, source: 'cached' })
    try {
      const data = await getMarketMovers()
      await setCache(cacheKey, data, 60)
      return json({ data, source: 'live' })
    } catch {
      if (cached) return json({ data: cached.data, source: 'stale' })
      return json({ data: { gainers: [], losers: [] }, source: 'unavailable' })
    }
  }

  if (type === 'chart' && ticker) {
    const cacheKey = `chart_${ticker}_${period}`
    const cached = await getCache(cacheKey)
    if (cached && !cached.stale) return json({ data: cached.data, source: 'cached' })
    try {
      const data = await getChartData(ticker, period)
      await setCache(cacheKey, data, 300)
      return json({ data, source: 'live' })
    } catch (err: any) {
      if (cached) return json({ data: cached.data, source: 'stale' })
      return json({ error: err.message, data: [], source: 'unavailable' })
    }
  }

  if (type === 'summary' && ticker) {
    const cacheKey = `summary_${ticker}`
    const cached = await getCache(cacheKey)
    if (cached && !cached.stale) return json({ data: cached.data, source: 'cached' })
    try {
      const data = await getQuoteSummary(ticker)
      if (data) await setCache(cacheKey, data, 300)
      return json({ data, source: 'live' })
    } catch {
      if (cached) return json({ data: cached.data, source: 'stale' })
      return json({ data: null, source: 'unavailable' })
    }
  }

  if (type === 'options' && ticker) {
    const cacheKey = `options_${ticker}`
    const cached = await getCache(cacheKey)
    if (cached && !cached.stale) return json({ data: cached.data, source: 'cached' })
    try {
      const data = await getOptionsChain(ticker)
      if (data) await setCache(cacheKey, data, 300)
      return json({ data, source: 'live' })
    } catch {
      if (cached) return json({ data: cached.data, source: 'stale' })
      return json({ data: null, source: 'unavailable' })
    }
  }

  // Batch via ?tickers=
  const tickerList = q.data.tickers
  if (tickerList && tickerList.length > 0) {
    const cacheKey = `quotes_${tickerList.join(',')}`
    const cached = await getCache(cacheKey)
    if (cached && !cached.stale) return json({ data: cached.data, source: 'cached' })
    const data = await getQuotes(tickerList)
    if (data.length > 0) {
      await setCache(cacheKey, data, 300)
      return json({ data, source: 'live' })
    }
    // Empty — serve stale or empty
    if (cached) return json({ data: cached.data, source: 'stale' })
    return json({ data: [], source: 'unavailable' })
  }

  // Single ticker via ?ticker=
  if (ticker) {
    const cacheKey = `quote_${ticker}`
    const cached = await getCache(cacheKey)
    if (cached && !cached.stale) return json({ data: cached.data, source: 'cached' })
    try {
      const data = await getQuote(ticker)
      await setCache(cacheKey, data, 300)
      return json({ data, source: 'live' })
    } catch {
      if (cached) return json({ data: cached.data, source: 'stale' })
      return json({ data: null, source: 'unavailable' })
    }
  }

  // Default: fetch DEFAULT_TICKERS
  const cacheKey = `quotes_${DEFAULT_TICKERS.join(',')}`
  const cached = await getCache(cacheKey)
  if (cached && !cached.stale) return json({ data: cached.data, source: 'cached' })
  const data = await getQuotes(DEFAULT_TICKERS)
  if (data.length > 0) {
    await setCache(cacheKey, data, 300)
    return json({ data, source: 'live' })
  }
  if (cached) return json({ data: cached.data, source: 'stale' })
  return json({ data: [], source: 'unavailable' })
}
