import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getQuotes } from '@/lib/apis/yahoo'
import { z } from 'zod'
import { parseBody, parseQuery, ticker, shortText } from '@/lib/validation'
import { checkLimits, LIMITS, tooManyRequests } from '@/lib/rateLimit'

const PostBody = z.object({
  ticker,
  name: shortText(100).optional(),
  assetType: z.string().trim().toUpperCase().regex(/^[A-Z_]{1,20}$/, 'invalid assetType').optional(),
  note: shortText(500).optional(),
})
const DeleteQuery = z.object({ ticker })

// Session-scoped: never store this in a shared cache. Belt-and-braces alongside
// next.config.js no longer setting s-maxage on /api/:path*.
const PRIVATE: Record<string, string> = { 'Cache-Control': 'private, no-store' }


export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id ?? null
    // No session must never fall through to the shared ownerless (userId: null) rows.
    if (!userId) return NextResponse.json({ error: 'Sign in required' }, { status: 401, headers: PRIVATE })

    const items = await prisma.watchlist.findMany({
      where: { userId },
      orderBy: { addedAt: 'asc' },
    })
    if (items.length === 0) return NextResponse.json({ data: [] }, { headers: PRIVATE })

    const tickers = items.map(i => i.ticker)
    const quotes = await getQuotes(tickers)
    const quoteMap = new Map(quotes.map((q: any) => [q.symbol, q]))
    const enriched = items.map(item => ({
      ...item,
      price: quoteMap.get(item.ticker)?.regularMarketPrice ?? null,
      change: quoteMap.get(item.ticker)?.regularMarketChange ?? null,
      changePct: quoteMap.get(item.ticker)?.regularMarketChangePercent ?? null,
    }))
    return NextResponse.json({ data: enriched }, { headers: PRIVATE })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { headers: PRIVATE })
  }
}

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, PostBody, PRIVATE)
  if (parsed.error) return parsed.error
  const { ticker, name, assetType, note } = parsed.data
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id ?? null
    // No session must never fall through to the shared ownerless (userId: null) rows.
    if (!userId) return NextResponse.json({ error: 'Sign in required' }, { status: 401, headers: PRIVATE })
    const rl = await checkLimits([LIMITS.writes(userId)])
    if (!rl.ok) return tooManyRequests(rl.retryAfter, 'changes', PRIVATE)

    const item = await prisma.watchlist.upsert({
      where: { userId_ticker: { userId, ticker } },
      update: { name: name || ticker, assetType: assetType || 'STOCK', note: note || '' },
      create: { ticker, name: name || ticker, assetType: assetType || 'STOCK', note: note || '', userId },
    })
    return NextResponse.json({ data: item }, { headers: PRIVATE })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { headers: PRIVATE })
  }
}

export async function DELETE(req: NextRequest) {
  const q = parseQuery(req, DeleteQuery, PRIVATE)
  if (q.error) return q.error
  const { ticker } = q.data
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id ?? null
    // No session must never fall through to the shared ownerless (userId: null) rows.
    if (!userId) return NextResponse.json({ error: 'Sign in required' }, { status: 401, headers: PRIVATE })
    const rl = await checkLimits([LIMITS.writes(userId)])
    if (!rl.ok) return tooManyRequests(rl.retryAfter, 'changes', PRIVATE)

    await prisma.watchlist.deleteMany({
      where: { ticker, userId },
    })
    return NextResponse.json({ success: true }, { headers: PRIVATE })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { headers: PRIVATE })
  }
}
