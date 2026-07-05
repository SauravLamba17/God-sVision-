import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQuotes } from '@/lib/apis/yahoo'

export async function GET() {
  try {
    const activeAlerts = await prisma.priceAlert.findMany({ where: { active: true, triggered: false } })
    if (activeAlerts.length === 0) return NextResponse.json({ triggered: [], checked: 0 })

    const tickers = [...new Set(activeAlerts.map(a => a.ticker))]
    const quotes = await getQuotes(tickers)
    const priceMap = new Map(quotes.map((q: any) => [q.symbol, q.regularMarketPrice as number]))

    const triggeredIds: number[] = []
    const triggerDetails: Array<{ ticker: string; condition: string; targetPrice: number; currentPrice: number }> = []

    for (const alert of activeAlerts) {
      const price = priceMap.get(alert.ticker)
      if (!price) continue
      const hit =
        (alert.condition === 'above' && price >= alert.targetPrice) ||
        (alert.condition === 'below' && price <= alert.targetPrice)
      if (hit) {
        triggeredIds.push(alert.id)
        triggerDetails.push({ ticker: alert.ticker, condition: alert.condition, targetPrice: alert.targetPrice, currentPrice: price })
        await prisma.priceAlert.update({
          where: { id: alert.id },
          data: { triggered: true, notified: true, triggeredAt: new Date() },
        })
      }
    }

    return NextResponse.json({ triggered: triggeredIds, details: triggerDetails, checked: activeAlerts.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, triggered: [] })
  }
}
