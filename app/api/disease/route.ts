import { NextRequest, NextResponse } from 'next/server'
import { fetchGlobalStats, fetchCountryStats, fetchHistoricalGlobal } from '@/lib/apis/disease'

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') || 'all'

  try {
    if (type === 'global') {
      const data = await fetchGlobalStats()
      return NextResponse.json({ data, source: 'live' })
    }
    if (type === 'history') {
      const days = parseInt(req.nextUrl.searchParams.get('days') || '90')
      const data = await fetchHistoricalGlobal(days)
      return NextResponse.json({ data, source: 'live' })
    }

    // Default: return global + countries
    const [global_, countries] = await Promise.allSettled([
      fetchGlobalStats(),
      fetchCountryStats(50),
    ])
    return NextResponse.json({
      data: {
        global: global_.status === 'fulfilled' ? global_.value : null,
        countries: countries.status === 'fulfilled' ? countries.value : [],
      },
      source: 'live',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
