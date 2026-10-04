import { NextRequest, NextResponse } from 'next/server'
import { scoreHeadlines, computeMarketMood } from '@/lib/apis/newsSentiment'
import { z } from 'zod'
import { parseBody, shortText } from '@/lib/validation'
import { limiterId } from '@/lib/rateLimit'

const Body = z.object({ headlines: z.array(shortText(500)).min(1, 'headlines array required').max(200) })

// Up to 50 Prisma lookups then sequential Gemini batches of 20.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, Body)
  if (parsed.error) return parsed.error
  const { headlines } = parsed.data
  try {
    const sentiments = await scoreHeadlines(headlines.slice(0, 50), await limiterId(req))
    const mood = computeMarketMood(sentiments)
    return NextResponse.json({ data: sentiments, mood })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
