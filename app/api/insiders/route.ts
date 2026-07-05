import { NextRequest, NextResponse } from 'next/server'
import { fetchInsiderTransactions } from '@/lib/apis/insiders'

export async function GET(req: NextRequest) {
  const minValue = parseInt(req.nextUrl.searchParams.get('minValue') ?? '100000')
  const type = req.nextUrl.searchParams.get('type') ?? 'all'
  try {
    let txs = await fetchInsiderTransactions(minValue)
    if (type !== 'all') txs = txs.filter(t => t.transactionType === type.toUpperCase())
    return NextResponse.json({ data: txs, count: txs.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, data: [] })
  }
}
