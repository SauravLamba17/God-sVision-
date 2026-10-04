import { NextRequest, NextResponse } from 'next/server'
import { getMacroIndicators, getYieldCurve, getFedBalanceSheet } from '@/lib/apis/fred'
import { setCache, getCache } from '@/lib/cache'
import { z } from 'zod'
import { parseQuery } from '@/lib/validation'

const Query = z.object({ type: z.enum(['indicators', 'yield_curve', 'fed_balance']).default('indicators') })

export async function GET(request: NextRequest) {
  const q = parseQuery(request, Query)
  if (q.error) return q.error
  const { type } = q.data

  try {
    if (type === 'yield_curve') {
      const key = 'yield_curve'
      const cached = await getCache(key)
      if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })
      const data = await getYieldCurve()
      await setCache(key, data, 3600)
      return NextResponse.json({ data, source: 'live' })
    }

    if (type === 'fed_balance') {
      const key = 'fed_balance_sheet'
      const cached = await getCache(key)
      if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })
      const data = await getFedBalanceSheet()
      await setCache(key, data, 3600)
      return NextResponse.json({ data, source: 'live' })
    }

    const key = 'macro_indicators'
    const cached = await getCache(key)
    if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })
    const data = await getMacroIndicators()
    await setCache(key, data, 3600)
    return NextResponse.json({ data, source: 'live' })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg, data: null, source: 'unavailable' })
  }
}
