import { NextRequest, NextResponse } from 'next/server'
import { fetchGlobalStats, fetchCountryStats, fetchHistoricalGlobal } from '@/lib/apis/disease'
import { z } from 'zod'
import { parseQuery, intParam } from '@/lib/validation'

const Query = z.object({ type: z.enum(['all', 'global', 'history']).default('all'), days: intParam(1, 3650).default(90) })

export async function GET(req: NextRequest) {
  const q = parseQuery(req, Query)
  if (q.error) return q.error
  const { type, days } = q.data

  try {
    if (type === 'global') {
      const data = await fetchGlobalStats()
      return NextResponse.json({ data, source: 'live' })
    }
    if (type === 'history') {
      const data = await fetchHistoricalGlobal(days)
      return NextResponse.json({ data, source: 'live' })
    }

    // Default: return global + countries
    const [global_, countries] = await Promise.allSettled([
      fetchGlobalStats(),
      fetchCountryStats(50),
    ])
    const global = global_.status === 'fulfilled' ? global_.value : null
    const countryList = countries.status === 'fulfilled' ? countries.value : []
    return NextResponse.json({
      data: { global, countries: countryList },
      // Both upstream calls failing used to still say 'live'.
      source: global || countryList.length ? 'live' : 'unavailable',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, source: 'unavailable' })
  }
}
