import { NextResponse } from 'next/server'
import { getBrain } from '@/lib/brain'

// Market Brain per market. Dynamic on purpose: the structured brain is cached
// (15 min in session, 1 h otherwise) and shared, but every response re-reads the
// live numbers from the dashboards' own short caches and re-renders the text.
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { market: string } }) {
  const market = params.market.toUpperCase()
  if (market !== 'US' && market !== 'IN') return NextResponse.json({ error: 'market must be us or in' }, { status: 404 })
  try {
    const data = await getBrain(market)
    return NextResponse.json({ data, source: 'live' }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, data: null, source: 'unavailable' })
  }
}
