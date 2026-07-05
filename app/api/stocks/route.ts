import { NextRequest, NextResponse } from 'next/server'
import { getQuotes, getQuote, getChartData, getQuoteSummary, getOptionsChain, getMarketMovers, DEFAULT_TICKERS } from '@/lib/apis/yahoo'
import { setCache, getCache } from '@/lib/cache'

// Cache-Control header values for browser-side caching between tab switches
const CACHE_HEADER = 'public, max-age=120, stale-while-revalidate=300'

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': CACHE_HEADER },
  })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')
  const type   = searchParams.get('type') || 'quotes'
  const period = searchParams.get('period') || '3mo'

  if (type === 'movers') {
    const cacheKey = 'market_movers'
    const cached = getCache(cacheKey)
    if (cached && !cached.stale) return json({ data: cached.data, source: 'cache' })
    try {
      const data = await getMarketMovers()
      setCache(cacheKey, data, 60)
      return json({ data, source: 'live' })
    } catch {
      if (cached) return json({ data: cached.data, source: 'stale' })
      return json({ data: { gainers: [], losers: [] }, source: 'empty' })
    }
  }

  if (type === 'chart' && ticker) {
    const cacheKey = `chart_${ticker}_${period}`
    const cached = getCache(cacheKey)
    if (cached && !cached.stale) return json({ data: cached.data, source: 'cache' })
    try {
      const data = await getChartData(ticker, period)
      setCache(cacheKey, data, 300)
      return json({ data, source: 'live' })
    } catch (err: any) {
      if (cached) return json({ data: cached.data, source: 'stale' })
      return json({ error: err.message, data: [], source: 'empty' })
    }
  }

  if (type === 'summary' && ticker) {
    const cacheKey = `summary_${ticker}`
    const cached = getCache(cacheKey)
    if (cached && !cached.stale) return json({ data: cached.data, source: 'cache' })
    try {
      const data = await getQuoteSummary(ticker)
      if (data) setCache(cacheKey, data, 300)
      return json({ data, source: 'live' })
    } catch {
      if (cached) return json({ data: cached.data, source: 'stale' })
      return json({ data: null, source: 'empty' })
    }
  }

  if (type === 'options' && ticker) {
    const cacheKey = `options_${ticker}`
    const cached = getCache(cacheKey)
    if (cached && !cached.stale) return json({ data: cached.data, source: 'cache' })
    try {
      const data = await getOptionsChain(ticker)
      if (data) setCache(cacheKey, data, 300)
      return json({ data, source: 'live' })
    } catch {
      if (cached) return json({ data: cached.data, source: 'stale' })
      return json({ data: null, source: 'empty' })
    }
  }

  // Batch via ?tickers=
  const tickerList = searchParams.get('tickers')?.split(',').filter(Boolean)
  if (tickerList && tickerList.length > 0) {
    const cacheKey = `quotes_${tickerList.join(',')}`
    const cached = getCache(cacheKey)
    if (cached && !cached.stale) return json({ data: cached.data, source: 'cache' })
    const data = await getQuotes(tickerList)
    if (data.length > 0) {
      setCache(cacheKey, data, 300)
      return json({ data, source: 'live' })
    }
    // Empty — serve stale or empty
    if (cached) return json({ data: cached.data, source: 'stale' })
    return json({ data: [], source: 'empty' })
  }

  // Single ticker via ?ticker=
  if (ticker) {
    const cacheKey = `quote_${ticker}`
    const cached = getCache(cacheKey)
    if (cached && !cached.stale) return json({ data: cached.data, source: 'cache' })
    try {
      const data = await getQuote(ticker)
      setCache(cacheKey, data, 300)
      return json({ data, source: 'live' })
    } catch {
      if (cached) return json({ data: cached.data, source: 'stale' })
      return json({ data: null, source: 'empty' })
    }
  }

  // Default: fetch DEFAULT_TICKERS
  const cacheKey = `quotes_${DEFAULT_TICKERS.join(',')}`
  const cached = getCache(cacheKey)
  if (cached && !cached.stale) return json({ data: cached.data, source: 'cache' })
  const data = await getQuotes(DEFAULT_TICKERS)
  if (data.length > 0) {
    setCache(cacheKey, data, 300)
    return json({ data, source: 'live' })
  }
  if (cached) return json({ data: cached.data, source: 'stale' })
  return json({ data: [], source: 'empty' })
}
