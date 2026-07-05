import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import yahooFinance from 'yahoo-finance2'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const check = searchParams.get('check')
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id ?? null

  try {
    if (check === 'prices') {
      const alerts = await prisma.priceAlert.findMany({ where: { userId, active: true, triggered: false } })
      if (alerts.length === 0) return NextResponse.json({ data: [], triggered: [] })

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
      return NextResponse.json({ data: alerts, triggered, prices })
    }

    const [priceAlerts, newsAlerts] = await Promise.all([
      prisma.priceAlert.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      prisma.newsAlert.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ])
    return NextResponse.json({ data: { priceAlerts, newsAlerts } })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'DB error'
    return NextResponse.json({ error: msg })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id ?? null
    const body = await request.json()
    const { type, ticker, condition, targetPrice, keyword } = body

    if (type === 'price') {
      const alert = await prisma.priceAlert.create({
        data: { ticker: ticker.toUpperCase(), condition, targetPrice: parseFloat(targetPrice), userId },
      })
      return NextResponse.json({ data: alert })
    }

    if (type === 'news') {
      const alert = await prisma.newsAlert.create({ data: { keyword, userId } })
      return NextResponse.json({ data: alert })
    }

    return NextResponse.json({ error: 'Invalid alert type' }, { status: 400 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'DB error'
    return NextResponse.json({ error: msg })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id ?? null
    const { searchParams } = new URL(request.url)
    const id   = parseInt(searchParams.get('id') || '0')
    const type = searchParams.get('type') || 'price'

    if (type === 'price') await prisma.priceAlert.deleteMany({ where: { id, userId } })
    else                   await prisma.newsAlert.deleteMany({ where: { id, userId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'DB error'
    return NextResponse.json({ error: msg })
  }
}
