import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'
import { INDIA_MACRO, INDIA_MACRO_VINTAGE, INDIA_YIELD_CURVE, RBI_MPC_MEETINGS, getUsdInr } from '@/lib/apis/india'

// ISR: regenerated at most every 3600s (macro/central-bank/daily-flow data). Without this the route was
// prerendered at build and served build-time data forever.
export const revalidate = 3600

export async function GET() {
  const key    = 'india_macro'
  const cached = await getCache(key)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })

  // Live USD/INR
  const usdInr = await getUsdInr(3600)

  // Next MPC meeting
  const now       = new Date()
  // null once the hand-maintained schedule runs out — it used to fall back to
  // the LAST (past) meeting and render "-123d away".
  const nextMPC   = RBI_MPC_MEETINGS.find(m => new Date(m.date) > now) ?? null

  const result = {
    ...INDIA_MACRO,
    usdInr,
    yieldCurve: INDIA_YIELD_CURVE,
    nextMPC: nextMPC && { ...nextMPC, daysAway: Math.ceil((new Date(nextMPC.date).getTime() - now.getTime()) / 86_400_000) },
    rbiStance: 'NEUTRAL',
    lastPolicyAction: 'HOLD at 6.50% — Jun 2025',
    // Everything except usdInr on this response is a manually maintained
    // constant. The UI renders this so the panel can say so.
    isStaticReference: true,
    vintage: INDIA_MACRO_VINTAGE,
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
  // Not 'live': only usdInr is fetched. The rest are constants from india.ts.
  return NextResponse.json({ data: result, source: 'static-reference' })
}
