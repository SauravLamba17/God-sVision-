import { NextResponse } from 'next/server'
import { explainMarket, type Market } from '@/lib/evidence'
import { narrateExplanations } from '@/lib/ai'

// "Why" lines for today's movers and the index cards, per market.
// ISR: computed at most once a minute per market and shared by every user —
// evidence is code-only and reads the dashboards' own cached data.
export const revalidate = 60
export const dynamicParams = false
export function generateStaticParams() {
  return [{ market: 'us' }, { market: 'in' }]
}

export async function GET(_req: Request, { params }: { params: { market: string } }) {
  const market = params.market.toUpperCase() as Market
  try {
    const data = await explainMarket(market)
    await narrateExplanations(market, data.explanations) // optional; no-op unless AI_PROVIDER is set
    return NextResponse.json({ data, source: 'live' })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, data: null, source: 'unavailable' })
  }
}
