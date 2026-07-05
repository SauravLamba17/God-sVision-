import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'
import { fetchMCXCommodities } from '@/lib/apis/india'

export async function GET() {
  const key    = 'india_commodities'
  const cached = getCache(key)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })

  let usdInr = 83.5
  try {
    const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { signal: AbortSignal.timeout(5000) })
    const d = await r.json()
    if (d.rates?.INR) usdInr = d.rates.INR
  } catch { /* keep fallback */ }

  try {
    const commodities = await fetchMCXCommodities(usdInr)
    const result = { commodities, usdInr, fetchedAt: Date.now() }
    setCache(key, result, 30)
    return NextResponse.json({ data: result, source: 'live' })
  } catch (err) {
    const fallback = getCache(key)
    if (fallback) return NextResponse.json({ data: fallback.data, source: 'stale' })
    return NextResponse.json({ error: String(err) })
  }
}
