import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { parseBody, parseQuery, ticker, shortText, positiveAmount, isoDate, id } from '@/lib/validation'
import { checkLimits, LIMITS, tooManyRequests } from '@/lib/rateLimit'

const PostBody = z.object({
  ticker,
  name: shortText(100).optional(),
  quantity: positiveAmount,
  buyPrice: positiveAmount,
  buyDate: isoDate,
})
const DeleteQuery = z.object({ id })

// Session-scoped: never store this in a shared cache. Belt-and-braces alongside
// next.config.js no longer setting s-maxage on /api/:path*.
const PRIVATE: Record<string, string> = { 'Cache-Control': 'private, no-store' }


export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id ?? null
    // No session must never fall through to the shared ownerless (userId: null) rows.
    if (!userId) return NextResponse.json({ error: 'Sign in required' }, { status: 401, headers: PRIVATE })
    const holdings = await prisma.portfolioHolding.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ data: holdings }, { headers: PRIVATE })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'DB error'
    return NextResponse.json({ error: msg }, { headers: PRIVATE })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id ?? null
    // No session must never fall through to the shared ownerless (userId: null) rows.
    if (!userId) return NextResponse.json({ error: 'Sign in required' }, { status: 401, headers: PRIVATE })
    const parsed = await parseBody(request, PostBody, PRIVATE)
    if (parsed.error) return parsed.error
    const rl = await checkLimits([LIMITS.writes(userId)])
    if (!rl.ok) return tooManyRequests(rl.retryAfter, 'changes', PRIVATE)
    const { ticker, name, quantity, buyPrice, buyDate } = parsed.data
    const holding = await prisma.portfolioHolding.create({
      data: { ticker, name: name || ticker, quantity, buyPrice, buyDate: new Date(buyDate), userId },
    })
    return NextResponse.json({ data: holding }, { headers: PRIVATE })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'DB error'
    return NextResponse.json({ error: msg }, { headers: PRIVATE })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id ?? null
    // No session must never fall through to the shared ownerless (userId: null) rows.
    if (!userId) return NextResponse.json({ error: 'Sign in required' }, { status: 401, headers: PRIVATE })
    const q = parseQuery(request, DeleteQuery, PRIVATE)
    if (q.error) return q.error
    const rl = await checkLimits([LIMITS.writes(userId)])
    if (!rl.ok) return tooManyRequests(rl.retryAfter, 'changes', PRIVATE)
    const { id } = q.data
    // id AND userId in one statement: count 0 = missing or not yours — same
    // 404 either way, so ids can't be probed (matches /api/transactions).
    const { count } = await prisma.portfolioHolding.deleteMany({ where: { id, userId } })
    if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: PRIVATE })
    return NextResponse.json({ success: true }, { headers: PRIVATE })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'DB error'
    return NextResponse.json({ error: msg }, { headers: PRIVATE })
  }
}
