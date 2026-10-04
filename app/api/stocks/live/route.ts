import { NextRequest, NextResponse } from 'next/server'

// Live US quotes for the browser, polled every 10s by useAlpacaStream.
// Replaces the browser WebSocket that needed the Alpaca secret client-side
// (NEXT_PUBLIC_*). Keys stay server-only here.
//
// The route itself is dynamic (it reads ?symbols=), so the 10s rate cap comes
// from the Data Cache on the upstream fetch below: one Alpaca call per symbol
// set per 10s, shared by every user and instance.
export const revalidate = 10

const SYMBOL = /^[A-Z][A-Z0-9.]{0,9}$/
const MAX_SYMBOLS = 50

export async function GET(req: NextRequest) {
  const key = process.env.ALPACA_API_KEY
  const secret = process.env.ALPACA_SECRET_KEY
  if (!key || !secret) {
    return NextResponse.json({ data: {}, error: 'Alpaca not configured' }, { status: 503 })
  }

  const symbols = [...new Set(
    (req.nextUrl.searchParams.get('symbols') ?? '').split(',').map(s => s.trim().toUpperCase()).filter(s => SYMBOL.test(s)),
  )].sort().slice(0, MAX_SYMBOLS)
  if (symbols.length === 0) return NextResponse.json({ data: {} })

  try {
    const res = await fetch(`https://data.alpaca.markets/v2/stocks/snapshots?symbols=${symbols.join(',')}&feed=iex`, {
      headers: { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret },
      next: { revalidate: 10 }, signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`Alpaca ${res.status}`)
    const snaps: Record<string, any> = await res.json()

    const data: Record<string, unknown> = {}
    for (const [symbol, s] of Object.entries(snaps)) {
      const price = s?.latestTrade?.p
      if (!price) continue
      const prevClose = s.prevDailyBar?.c ?? 0
      data[symbol] = {
        symbol,
        price,
        bidPrice: s.latestQuote?.bp ?? 0,
        askPrice: s.latestQuote?.ap ?? 0,
        volume: s.dailyBar?.v ?? 0,
        timestamp: s.latestTrade.t,
        prevClose,
        change: prevClose ? price - prevClose : 0,
        changePct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
      }
    }
    return NextResponse.json({ data, feed: 'iex' })
  } catch (e) {
    return NextResponse.json({ data: {}, error: (e as Error).message }, { status: 502 })
  }
}
