import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQuotes } from '@/lib/apis/yahoo'
import { sendAlertEmail } from '@/lib/resend'
import { sendPushNotification } from '@/lib/webpush'

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

        // Email + push are additional delivery channels alongside the existing
        // browser Notification() fired client-side in components/terminal/AlertChecker.tsx
        // — that logic is untouched. This never blocks/breaks the trigger loop.
        if (alert.userId) {
          try {
            const user = await prisma.user.findUnique({ where: { id: alert.userId } })
            if (user?.email) {
              await sendAlertEmail(user.email, `${alert.ticker} Alert Triggered`, {
                ticker: alert.ticker,
                condition: alert.condition,
                targetPrice: alert.targetPrice,
                currentPrice: price,
              })
            }

            const subs = await prisma.pushSubscription.findMany({ where: { userId: alert.userId } })
            for (const sub of subs) {
              await sendPushNotification(
                { endpoint: sub.endpoint, keys: sub.keys as any },
                { title: `${alert.ticker} Alert`, body: `${alert.condition} $${alert.targetPrice} triggered`, url: `/markets?ticker=${alert.ticker}` }
              )
            }
          } catch (notifyErr) {
            console.error('[Alerts] Email/push dispatch failed:', notifyErr)
          }
        }
      }
    }

    return NextResponse.json({ triggered: triggeredIds, details: triggerDetails, checked: activeAlerts.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, triggered: [] })
  }
}
