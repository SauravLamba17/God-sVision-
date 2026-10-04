import { NextRequest, NextResponse } from 'next/server'
import { getTickerMentions, getTickerSentiment } from '@/lib/apis/reddit'
import { z } from 'zod'
import { parseQuery, ticker } from '@/lib/validation'

const Query = z.object({ ticker: ticker.optional() })

export async function GET(req: NextRequest) {
  const q = parseQuery(req, Query)
  if (q.error) return q.error
  const { ticker } = q.data
  try {
    if (ticker) {
      const data = await getTickerSentiment(ticker)
      return NextResponse.json({ data, source: data ? 'live' : 'unavailable' })
    }
    // Reddit blocks unauthenticated JSON (403), and the lib returns [] on any
    // failure — that must not be labelled live.
    const data = await getTickerMentions()
    return NextResponse.json({ data, source: data.length ? 'live' : 'unavailable', count: data.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, data: [], source: 'unavailable' })
  }
}
