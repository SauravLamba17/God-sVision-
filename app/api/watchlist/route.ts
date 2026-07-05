import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getQuotes } from '@/lib/apis/yahoo'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id ?? null

    const items = await prisma.watchlist.findMany({
      where: userId ? { userId } : { userId: null },
      orderBy: { addedAt: 'asc' },
    })
    if (items.length === 0) return NextResponse.json({ data: [] })

    const tickers = items.map(i => i.ticker)
    const quotes = await getQuotes(tickers)
    const quoteMap = new Map(quotes.map((q: any) => [q.symbol, q]))
    const enriched = items.map(item => ({
      ...item,
      price: quoteMap.get(item.ticker)?.regularMarketPrice ?? null,
      change: quoteMap.get(item.ticker)?.regularMarketChange ?? null,
      changePct: quoteMap.get(item.ticker)?.regularMarketChangePercent ?? null,
    }))
    return NextResponse.json({ data: enriched })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}

export async function POST(req: NextRequest) {
  const { ticker, name, assetType, note } = await req.json()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id ?? null

    const item = await prisma.watchlist.upsert({
      where: userId
        ? { userId_ticker: { userId, ticker: ticker.toUpperCase() } }
        : { userId_ticker: { userId: null as any, ticker: ticker.toUpperCase() } },
      update: { name: name || ticker, assetType: assetType || 'STOCK', note: note || '' },
      create: { ticker: ticker.toUpperCase(), name: name || ticker, assetType: assetType || 'STOCK', note: note || '', userId },
    })
    return NextResponse.json({ data: item })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}

export async function DELETE(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id ?? null

    await prisma.watchlist.deleteMany({
      where: { ticker, userId },
    })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
