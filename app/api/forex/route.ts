import { NextRequest, NextResponse } from 'next/server'
import { getForexRates, getForexMatrix, MAJOR_PAIRS, CENTRAL_BANK_RATES } from '@/lib/apis/forex'
import { setCache, getCache } from '@/lib/cache'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'rates'

  try {
    if (type === 'matrix') {
      const key = 'forex_matrix'
      const cached = getCache(key)
      if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cache' })
      const data = await getForexMatrix()
      setCache(key, data, 60)
      return NextResponse.json({ data, source: 'live' })
    }

    if (type === 'pairs') {
      const key = 'forex_rates_usd'
      const cached = getCache(key)
      if (cached && !cached.stale) {
        return NextResponse.json({ data: { rates: cached.data, pairs: MAJOR_PAIRS }, source: 'cache' })
      }
      const data = await getForexRates('USD')
      setCache(key, data.rates, 60)
      return NextResponse.json({ data: { rates: data.rates, pairs: MAJOR_PAIRS }, source: 'live' })
    }

    if (type === 'central_banks') {
      return NextResponse.json({ data: CENTRAL_BANK_RATES, source: 'static' })
    }

    const key = 'forex_rates_usd'
    const cached = getCache(key)
    if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cache' })
    const data = await getForexRates('USD')
    setCache(key, data, 60)
    return NextResponse.json({ data, source: 'live' })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg })
  }
}
