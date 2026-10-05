import { NextRequest, NextResponse } from 'next/server'
import { scoreHeadlines, computeMarketMood } from '@/lib/apis/newsSentiment'
import { z } from 'zod'
import { parseBody, shortText } from '@/lib/validation'

const Body = z.object({ headlines: z.array(shortText(500)).min(1, 'headlines array required').max(200) })

// Keyword scoring only: no AI, no DB — labelled as an estimate.

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, Body)
  if (parsed.error) return parsed.error
  const { headlines } = parsed.data
  try {
    const sentiments = scoreHeadlines(headlines.slice(0, 50))
    const mood = computeMarketMood(sentiments)
    return NextResponse.json({ data: sentiments, mood, source: 'estimate', method: 'keyword' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
