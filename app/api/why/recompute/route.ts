import { NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody, tickerList } from '@/lib/validation'
import { explainSymbols } from '@/lib/evidence'

// Fresh evidence for specific symbols — called when a live move has flipped or
// drifted >1.5 points from an explanation's snapshot, or for a deep-dive ticker.
// Code-only; no AI, no DB writes.
const Body = z.object({
  market: z.enum(['US', 'IN']),
  symbols: z.string().trim().max(400).pipe(tickerList(10)).or(z.array(z.string()).max(10).transform(a => a.join(',')).pipe(tickerList(10))),
})

export async function POST(req: Request) {
  const parsed = await parseBody(req, Body)
  if (parsed.error) return parsed.error
  try {
    const explanations = await explainSymbols(parsed.data.market, parsed.data.symbols)
    return NextResponse.json({ data: { market: parsed.data.market, generatedAt: Date.now(), explanations }, source: 'live' },
      { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, data: null, source: 'unavailable' })
  }
}
