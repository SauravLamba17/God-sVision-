import { NextRequest, NextResponse } from 'next/server'
import { getMacroIndicators, getYieldCurve, getFedBalanceSheet } from '@/lib/apis/fred'
import { setCache, getCache } from '@/lib/cache'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'indicators'

  try {
    if (type === 'yield_curve') {
      const key = 'yield_curve'
      const cached = getCache(key)
      if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cache' })
      const data = await getYieldCurve()
      setCache(key, data, 3600)
      return NextResponse.json({ data, source: 'live' })
    }

    if (type === 'fed_balance') {
      const key = 'fed_balance_sheet'
      const cached = getCache(key)
      if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cache' })
      const data = await getFedBalanceSheet()
      setCache(key, data, 3600)
      return NextResponse.json({ data, source: 'live' })
    }

    const key = 'macro_indicators'
    const cached = getCache(key)
    if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cache' })
    const data = await getMacroIndicators()
    setCache(key, data, 3600)
    return NextResponse.json({ data, source: 'live' })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg, data: null, source: 'empty' })
  }
}
