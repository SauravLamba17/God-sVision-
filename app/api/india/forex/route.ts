import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'
import { fetchIndiaForex } from '@/lib/apis/india'

export async function GET() {
  const key    = 'india_forex'
  const cached = getCache(key)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })

  // Fetch live USD/INR first
  let exchangeRate = 83.5
  try {
    const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { signal: AbortSignal.timeout(5000) })
    const d = await r.json()
    if (d.rates?.INR) exchangeRate = d.rates.INR
  } catch { /* keep fallback */ }

  try {
    const pairs = await fetchIndiaForex(exchangeRate)
    const result = { pairs, usdInr: exchangeRate, fetchedAt: Date.now() }
    setCache(key, result, 60)
    return NextResponse.json({ data: result, source: 'live' })
  } catch (err) {
    const fallback = getCache(key)
    if (fallback) return NextResponse.json({ data: fallback.data, source: 'stale' })
    return NextResponse.json({ error: String(err) })
  }
}
