import { NextRequest, NextResponse } from 'next/server'
import { getTickerMentions, getTickerSentiment } from '@/lib/apis/reddit'

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  try {
    if (ticker) {
      const data = await getTickerSentiment(ticker)
      return NextResponse.json({ data, source: 'live' })
    }
    const data = await getTickerMentions()
    return NextResponse.json({ data, source: 'live', count: data.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, data: [] })
  }
}
