import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'
import { INDIA_MACRO, INDIA_YIELD_CURVE, RBI_MPC_MEETINGS, FII_DII_DATA } from '@/lib/apis/india'

export async function GET() {
  const key    = 'india_macro'
  const cached = await getCache(key)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })

  // Live USD/INR
  let usdInr = 83.5
  try {
    const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { signal: AbortSignal.timeout(5000) })
    const d = await r.json()
    if (d.rates?.INR) usdInr = d.rates.INR
  } catch { /* keep fallback */ }

  // Next MPC meeting
  const now       = new Date()
  const nextMPC   = RBI_MPC_MEETINGS.find(m => new Date(m.date) > now) ?? RBI_MPC_MEETINGS[RBI_MPC_MEETINGS.length - 1]
  const msToMPC   = new Date(nextMPC.date).getTime() - now.getTime()
  const daysToMPC = Math.ceil(msToMPC / 86_400_000)

  const result = {
    ...INDIA_MACRO,
    usdInr,
    yieldCurve: INDIA_YIELD_CURVE,
    nextMPC: { ...nextMPC, daysAway: daysToMPC },
    fiiDii: FII_DII_DATA,
    rbiStance: 'NEUTRAL',
    lastPolicyAction: 'HOLD at 6.50% — Jun 2025',
    rateHistory: [
      { date: '2024-02', rate: 6.50, action: 'HOLD' },
      { date: '2023-08', rate: 6.50, action: 'HOLD' },
      { date: '2023-02', rate: 6.50, action: 'HOLD' },
      { date: '2022-12', rate: 6.25, action: 'HIKE' },
      { date: '2022-09', rate: 5.90, action: 'HIKE' },
      { date: '2022-08', rate: 5.40, action: 'HIKE' },
    ],
    fetchedAt: Date.now(),
  }

  await setCache(key, result, 3600)
  return NextResponse.json({ data: result, source: 'live' })
}
