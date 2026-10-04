import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import yahooFinance from 'yahoo-finance2'

// Session-scoped: never store this in a shared cache. Belt-and-braces alongside
// next.config.js no longer setting s-maxage on /api/:path*.
const PRIVATE: Record<string, string> = { 'Cache-Control': 'private, no-store' }


export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const check = searchParams.get('check')
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
        const quotes = await (yahooFinance as any).quote(tickers)
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
    const body = await request.json()
    const { type, ticker, condition, targetPrice, keyword } = body

    if (type === 'price') {
      const alert = await prisma.priceAlert.create({
        data: { ticker: ticker.toUpperCase(), condition, targetPrice: parseFloat(targetPrice), userId },
      })
      return NextResponse.json({ data: alert }, { headers: PRIVATE })
    }

    if (type === 'news') {
      const alert = await prisma.newsAlert.create({ data: { keyword, userId } })
      return NextResponse.json({ data: alert }, { headers: PRIVATE })
    }

    return NextResponse.json({ error: 'Invalid alert type' }, { status: 400, headers: PRIVATE })
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
    const { searchParams } = new URL(request.url)
    const id   = parseInt(searchParams.get('id') || '0')
    const type = searchParams.get('type') || 'price'

    if (type === 'price') await prisma.priceAlert.deleteMany({ where: { id, userId } })
    else                   await prisma.newsAlert.deleteMany({ where: { id, userId } })

    return NextResponse.json({ success: true }, { headers: PRIVATE })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'DB error'
    return NextResponse.json({ error: msg }, { headers: PRIVATE })
  }
}
