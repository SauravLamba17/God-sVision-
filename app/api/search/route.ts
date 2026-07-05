import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { getCache, setCache } from '@/lib/cache'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()
  if (!q || q.length < 1) return NextResponse.json({ data: [] })

  const cacheKey = `search:${q.toLowerCase()}`
  const cached = getCache(cacheKey)
  if (cached) return NextResponse.json({ data: cached, source: 'cache' })

  try {
    const res = await axios.get('https://query2.finance.yahoo.com/v1/finance/search', {
      params: { q, quotesCount: 12, newsCount: 0, enableFuzzyQuery: false },
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 6000,
    })
    const quotes = ((res.data as any).quotes || [])
      .filter((q: any) => q.symbol && q.quoteType !== 'OPTION')
      .slice(0, 10)
      .map((q: any) => ({
        symbol:    q.symbol,
        shortname: q.shortname || q.longname || q.symbol,
        quoteType: q.quoteType || 'EQUITY',
        exchange:  q.exchDisp || q.exchange || '',
        sector:    q.sector || '',
      }))

    setCache(cacheKey, quotes, 30)
    return NextResponse.json({ data: quotes, source: 'live' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Search failed'
    return NextResponse.json({ error: msg, data: [] })
  }
}
