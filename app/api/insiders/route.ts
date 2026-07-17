import { NextRequest, NextResponse } from 'next/server'
import { fetchInsiderTransactions } from '@/lib/apis/insiders'

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])

export async function GET(req: NextRequest) {
  const minValue = parseInt(req.nextUrl.searchParams.get('minValue') ?? '100000')
  const type = req.nextUrl.searchParams.get('type') ?? 'all'
  try {
    let txs = await withTimeout(fetchInsiderTransactions(minValue), 10000)
    if (type !== 'all') txs = txs.filter(t => t.transactionType === type.toUpperCase())
    return NextResponse.json({ data: txs, count: txs.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, data: [] })
  }
}
