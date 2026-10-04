import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { setCache, getCache } from '@/lib/cache'
import { priorSessionClose } from '@/lib/apis/yahoo'
import { z } from 'zod'
import { parseQuery } from '@/lib/validation'
import '@/lib/feedHealth' // registers axios feed-health interceptors

const Query = z.object({ type: z.enum(['all']).default('all') })

const COMMODITY_TICKERS = {
  'WTI': 'CL=F',
  'BRENT': 'BZ=F',
  'NAT_GAS': 'NG=F',
  'GOLD': 'GC=F',
  'SILVER': 'SI=F',
  'COPPER': 'HG=F',
  'PLATINUM': 'PL=F',
  'PALLADIUM': 'PA=F',
  'HEATING_OIL': 'HO=F',
  'CORN': 'ZC=F',
  'WHEAT': 'ZW=F',
  'SOYBEANS': 'ZS=F',
}

export async function GET(request: NextRequest) {
  // `type` feeds the cache key — free-form values would mint unbounded entries.
  const q = parseQuery(request, Query)
  if (q.error) return q.error
  const { type } = q.data

  const key = `commodities_${type}`
  const cached = await getCache(key)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })

  try {
    const tickers = Object.values(COMMODITY_TICKERS)
    const results = await Promise.allSettled(
      tickers.map(t => axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=5d`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 8000
      }))
    )

    const commodities = Object.entries(COMMODITY_TICKERS).map(([name, ticker], i) => {
      const res = results[i]
      if (res.status === 'fulfilled') {
        const chart = res.value.data?.chart?.result?.[0]
        const meta = chart?.meta || {}
        // Grain futures (ZC/ZW/ZS) are quoted in US cents ('USX'); without this
        // corn at 497.75¢ rendered as $497.75/bu.
        const scale = meta.currency === 'USX' ? 0.01 : 1
        const price = meta.regularMarketPrice != null ? meta.regularMarketPrice * scale : meta.regularMarketPrice
        const prevClose = (priorSessionClose(chart) ?? NaN) * scale
        const change = price && prevClose ? price - prevClose : 0
        const changePct = prevClose ? (change / prevClose) * 100 : 0
        return { name, ticker, price, change, changePct, currency: meta.currency === 'USX' ? 'USD' : (meta.currency || 'USD'), unit: getUnit(name) }
      }
      return { name, ticker, price: null, change: null, changePct: null, currency: 'USD', unit: getUnit(name) }
    })

    await setCache(key, commodities, 300)
    return NextResponse.json({ data: commodities, source: 'live' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    if (cached) return NextResponse.json({ data: cached.data, source: 'cached', error: msg })
    return NextResponse.json({ error: msg })
  }
}

function getUnit(name: string): string {
  const units: Record<string, string> = {
    WTI: 'bbl', BRENT: 'bbl', NAT_GAS: 'MMBtu', HEATING_OIL: 'gal',
    GOLD: 'oz', SILVER: 'oz', PLATINUM: 'oz', PALLADIUM: 'oz',
    COPPER: 'lb', CORN: 'bu', WHEAT: 'bu', SOYBEANS: 'bu'
  }
  return units[name] || ''
}
