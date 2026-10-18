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
  // dynamicParams = false is not enforced for route handlers: without this, /api/why/<anything>
  // built a whole evidence context and answered 200 with an internal error message.
  if (market !== 'US' && market !== 'IN') return NextResponse.json({ error: 'market must be us or in' }, { status: 404 })
  try {
    const data = await explainMarket(market)
    await narrateExplanations(market, data.explanations) // optional; no-op unless AI_PROVIDER is set
    return NextResponse.json({ data, source: 'live' })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, data: null, source: 'unavailable' })
  }
}
