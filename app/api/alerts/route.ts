import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import yahooFinance from 'yahoo-finance2'
import { z } from 'zod'
import { parseBody, parseQuery, ticker, shortText, positiveAmount, id } from '@/lib/validation'
import { checkLimits, LIMITS, tooManyRequests } from '@/lib/rateLimit'
import { track } from '@/lib/feedHealth'

const GetQuery = z.object({ check: z.enum(['prices']).optional() })
const PostBody = z.discriminatedUnion('type', [
  z.object({ type: z.literal('price'), ticker, condition: z.enum(['above', 'below']), targetPrice: positiveAmount }),
  z.object({ type: z.literal('news'), keyword: shortText(100).min(1, 'keyword required') }),
])
const DeleteQuery = z.object({ id, type: z.enum(['price', 'news']).default('price') })

// Session-scoped: never store this in a shared cache. Belt-and-braces alongside
// next.config.js no longer setting s-maxage on /api/:path*.
const PRIVATE: Record<string, string> = { 'Cache-Control': 'private, no-store' }


export async function GET(request: NextRequest) {
  const q = parseQuery(request, GetQuery, PRIVATE)
  if (q.error) return q.error
  const { check } = q.data
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id ?? null
  // No session must never fall through to the shared ownerless (userId: null) rows.
  if (!userId) return NextResponse.json({ error: 'Sign in required' }, { status: 401, headers: PRIVATE })

  try {
    if (check === 'prices') {
      const alerts = await prisma.priceAlert.findMany({ where: { userId, active: true, triggered: false } })
      if (alerts.length === 0) return NextResponse.json({ data: [], triggered: [] }, { headers: PRIVATE })

      const tickers = [...new Set(alerts.map(a => a.ticker))]
      let prices: Record<string, number> = {}
      try {
        const quotes = await track('Yahoo Finance (yahoo-finance2)', () => (yahooFinance as any).quote(tickers))
        const arr = Array.isArray(quotes) ? quotes : [quotes]
        arr.forEach((q: any) => { if (q?.symbol) prices[q.symbol] = q.regularMarketPrice })
      } catch { /* silent */ }

      const triggered: number[] = []
      for (const alert of alerts) {
        const price = prices[alert.ticker]
        if (!price) continue
        const hit =
          (alert.condition === 'above' && price >= alert.targetPrice) ||
          (alert.condition === 'below' && price <= alert.targetPrice)
        if (hit) {
          await prisma.priceAlert.update({ where: { id: alert.id }, data: { triggered: true, triggeredAt: new Date() } })
          triggered.push(alert.id)
        }
      }
      return NextResponse.json({ data: alerts, triggered, prices }, { headers: PRIVATE })
    }

    const [priceAlerts, newsAlerts] = await Promise.all([
      prisma.priceAlert.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      prisma.newsAlert.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ])
    return NextResponse.json({ data: { priceAlerts, newsAlerts } }, { headers: PRIVATE })
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
    const body = parsed.data

    if (body.type === 'price') {
      const alert = await prisma.priceAlert.create({
        data: { ticker: body.ticker, condition: body.condition, targetPrice: body.targetPrice, userId },
      })
      return NextResponse.json({ data: alert }, { headers: PRIVATE })
    }

    const alert = await prisma.newsAlert.create({ data: { keyword: body.keyword, userId } })
    return NextResponse.json({ data: alert }, { headers: PRIVATE })
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
    const { id, type } = q.data

    // id AND userId in one statement: count 0 = missing or not yours — same
    // 404 either way, so ids can't be probed (matches /api/transactions).
    const { count } = type === 'price'
      ? await prisma.priceAlert.deleteMany({ where: { id, userId } })
      : await prisma.newsAlert.deleteMany({ where: { id, userId } })
    if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: PRIVATE })

    return NextResponse.json({ success: true }, { headers: PRIVATE })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'DB error'
    return NextResponse.json({ error: msg }, { headers: PRIVATE })
  }
}
