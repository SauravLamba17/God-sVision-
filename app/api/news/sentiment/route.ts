import { NextRequest, NextResponse } from 'next/server'
import { scoreHeadlines, computeMarketMood } from '@/lib/apis/newsSentiment'

export async function POST(req: NextRequest) {
  const { headlines } = await req.json()
  if (!Array.isArray(headlines) || headlines.length === 0) {
    return NextResponse.json({ error: 'headlines array required' }, { status: 400 })
  }
  try {
    const sentiments = await scoreHeadlines(headlines.slice(0, 50))
    const mood = computeMarketMood(sentiments)
    return NextResponse.json({ data: sentiments, mood })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
