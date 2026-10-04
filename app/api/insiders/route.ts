import { NextRequest, NextResponse } from 'next/server'
import { fetchInsiderTransactions } from '@/lib/apis/insiders'
import { z } from 'zod'
import { parseQuery, intParam } from '@/lib/validation'

const Query = z.object({
  minValue: intParam(0, 1e12).default(100000),
  type: z.enum(['all', 'BUY', 'SELL', 'GIFT', 'AWARD', 'buy', 'sell', 'gift', 'award']).default('all'),
})

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])

export async function GET(req: NextRequest) {
  const q = parseQuery(req, Query)
  if (q.error) return q.error
  const { minValue, type } = q.data
  try {
    let txs = await withTimeout(fetchInsiderTransactions(minValue), 10000)
    if (type !== 'all') txs = txs.filter(t => t.transactionType === type.toUpperCase())
    return NextResponse.json({ data: txs, count: txs.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, data: [] })
  }
}
