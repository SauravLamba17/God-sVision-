import { NextRequest, NextResponse } from 'next/server'
import { getForexRates, getForexMatrix, MAJOR_PAIRS } from '@/lib/apis/forex'
import { getPolicyRates } from '@/lib/apis/fred'
import { setCache, getCache } from '@/lib/cache'
import { z } from 'zod'
import { parseQuery } from '@/lib/validation'

const Query = z.object({ type: z.enum(['rates', 'matrix', 'pairs', 'central_banks']).default('rates') })

export async function GET(request: NextRequest) {
  const q = parseQuery(request, Query)
  if (q.error) return q.error
  const { type } = q.data

  try {
    if (type === 'matrix') {
      const key = 'forex_matrix'
      const cached = await getCache(key)
      if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })
      const data = await getForexMatrix()
      await setCache(key, data, 60)
      return NextResponse.json({ data, source: 'live' })
    }

    if (type === 'pairs') {
      const key = 'forex_rates_usd'
      const cached = await getCache(key)
      if (cached && !cached.stale) {
        return NextResponse.json({ data: { rates: cached.data, pairs: MAJOR_PAIRS }, source: 'cached' })
      }
      const data = await getForexRates('USD')
      await setCache(key, data.rates, 60)
      return NextResponse.json({ data: { rates: data.rates, pairs: MAJOR_PAIRS }, source: 'live' })
    }

    if (type === 'central_banks') {
      const cached = await getCache('policy_rates')
      if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })
      const data = await getPolicyRates()
      if (!data) return NextResponse.json({ data: null, error: 'Policy rates unavailable — FRED unreachable' })
      await setCache('policy_rates', data, 6 * 3600)
      return NextResponse.json({ data, source: 'live' })
    }

    const key = 'forex_rates_usd'
    const cached = await getCache(key)
    if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })
    const data = await getForexRates('USD')
    await setCache(key, data, 60)
    return NextResponse.json({ data, source: 'live' })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg })
  }
}
