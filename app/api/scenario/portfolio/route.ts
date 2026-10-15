import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseBody } from '@/lib/validation'
import { checkLimits, LIMITS, tooManyRequests } from '@/lib/rateLimit'
import { portfolioImpact } from '@/lib/scenario/engine'
import { SENSITIVITIES } from '@/lib/scenario/data'
import { ScenarioParams } from '@/lib/scenario/schema'

// Stress the signed-in user's own holdings. Session-scoped: never cached anywhere,
// reads only this user's rows; holdings without a reliable link are "not estimated".
const PRIVATE: Record<string, string> = { 'Cache-Control': 'private, no-store' }

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id ?? null
    if (!userId) return NextResponse.json({ error: 'Sign in required' }, { status: 401, headers: PRIVATE })
    const parsed = await parseBody(req, ScenarioParams, PRIVATE)
    if (parsed.error) return parsed.error
    const rl = await checkLimits([LIMITS.scenario(userId)])
    if (!rl.ok) return tooManyRequests(rl.retryAfter, 'portfolio stress tests', PRIVATE)
    const holdings = await prisma.portfolioHolding.findMany({ where: { userId }, select: { ticker: true, quantity: true, buyPrice: true } })
    const data = portfolioImpact(SENSITIVITIES, parsed.data as Parameters<typeof portfolioImpact>[1], holdings)
    return NextResponse.json({ data: { ...data, holdings: holdings.length } }, { headers: PRIVATE })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400, headers: PRIVATE })
  }
}
