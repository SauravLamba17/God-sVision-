import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseBody } from '@/lib/validation'
import { checkLimits, LIMITS, tooManyRequests } from '@/lib/rateLimit'
import { portfolioImpact, resolveHolding } from '@/lib/scenario/engine'
import { cachedPrices } from '@/lib/scenario/prices'
import { SENSITIVITIES } from '@/lib/scenario/data'
import { ScenarioParams } from '@/lib/scenario/schema'

// Stress the signed-in user's own holdings. Session-scoped: never cached anywhere,
// reads only this user's rows; holdings without a reliable link are "not estimated".
// Weighted by current value: prices the app already has cached, else one shared, cached
// Yahoo lookup keyed only by the sorted ticker list (lib/scenario/prices.ts); a holding
// still without a price is weighted by cost and labelled.
const PRIVATE: Record<string, string> = { 'Cache-Control': 'private, no-store' }

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id ?? null
    if (!userId) return NextResponse.json({ error: 'Sign in required' }, { status: 401, headers: PRIVATE })
    const parsed = await parseBody(req, ScenarioParams, PRIVATE)
    if (parsed.error) return parsed.error
    // Rate-limit count and holdings read are independent: one database round trip instead of two.
    // createdAt order = the Portfolio page's order, so its cached batch quote is found.
    const [rl, holdings] = await Promise.all([
      checkLimits([LIMITS.scenario(userId)]),
      prisma.portfolioHolding.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { ticker: true, quantity: true, buyPrice: true } }),
    ])
    if (!rl.ok) return tooManyRequests(rl.retryAfter, 'portfolio stress tests', PRIVATE)
    const prices = await cachedPrices(holdings.map(h => h.ticker), t => resolveHolding(SENSITIVITIES, t))
    const data = portfolioImpact(SENSITIVITIES, parsed.data as Parameters<typeof portfolioImpact>[1], holdings, prices)
    return NextResponse.json({ data: { ...data, holdings: holdings.length } }, { headers: PRIVATE })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400, headers: PRIVATE })
  }
}
