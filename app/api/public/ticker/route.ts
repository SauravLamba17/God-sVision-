import { NextResponse } from 'next/server'
import { getCryptoTop100 } from '@/lib/apis/coingecko'
import { getQuotes, DEFAULT_TICKERS } from '@/lib/apis/yahoo'
import { getDashboardOverview } from '@/lib/apis/overview'
import { getIndiaIndicesCached, getIndiaForexCached } from '@/lib/apis/cachedLoaders'
import { readThrough } from '@/lib/cache'
import { tickerStatus, toMs, type Session, type TickerStatus } from '@/lib/tickerStatus'

// ISR: regenerated at most every 60 s, then served from the CDN
// (s-maxage=60) — visitors never run the loaders themselves.
export const revalidate = 60

// Public quote feed for the landing page's marquee. Lives under /api/public so
// it inherits the middleware exemption the Sheets API uses; no key, no user data.
//
// Every price comes from a cache the dashboard already fills, so the tape and
// the dashboard show the same number for the same symbol:
//   AAPL/NVDA/TSLA  quotes_<DEFAULT_TICKERS>  (/api/stocks default)
//   SPX/GOLD/WTI    dashboard_overview_v2     (/api/dashboard/overview)
//   NIFTY/SENSEX    india_indices, USDINR india_forex (India routes)
//   BTC/ETH/SOL     crypto_top100             (/api/crypto)
// RELIANCE and EUR/USD, USD/JPY go through the same Yahoo getQuotes loader in
// one 3-symbol batch (the Nifty-50 loader would fetch 50 stocks for one row).
// A row without a fresh price is dropped — never shown as current.

export interface TickerRow {
  symbol: string
  price: number
  changePercent: number
  /** Last-trade time, unix ms. */
  time: number
  status: TickerStatus
}

type Raw = { price?: unknown; changePct?: unknown; time?: unknown } | undefined

const yq = (q: any): Raw => q && { price: q.regularMarketPrice, changePct: q.regularMarketChangePercent, time: q.regularMarketTime }
const cq = (q: any): Raw => q && { price: q.price, changePct: q.changePct, time: q.marketTime }
const cg = (c: any): Raw => c && { price: c.current_price, changePct: c.price_change_percentage_24h, time: c.last_updated }

const EXTRA = ['RELIANCE.NS', 'EURUSD=X', 'JPY=X']

const val = <T,>(r: PromiseSettledResult<{ data: T }>): T | undefined => (r.status === 'fulfilled' ? r.value.data : undefined)

async function quotesOrThrow(tickers: string[]) {
  const d = await getQuotes(tickers)
  if (!d.length) throw new Error('no quotes')
  return d
}

export async function GET() {
  const [stocksR, extraR, overviewR, indicesR, inrR, cryptoR] = await Promise.allSettled([
    readThrough(`quotes_${DEFAULT_TICKERS.join(',')}`, 300, () => quotesOrThrow(DEFAULT_TICKERS)),
    readThrough(`quotes_${EXTRA.join(',')}`, 60, () => quotesOrThrow(EXTRA)),
    getDashboardOverview(),
    getIndiaIndicesCached(),
    getIndiaForexCached(),
    readThrough('crypto_top100', 15, getCryptoTop100),
  ])
  const stocks = (val(stocksR) ?? []) as any[]
  const extra = (val(extraR) ?? []) as any[]
  const overview = val(overviewR) as any
  const indices = (val(indicesR) as any)?.indices ?? []
  const inr = (val(inrR) as any)?.pairs ?? []
  const crypto = (val(cryptoR) ?? []) as any[]

  const by = (list: any[], key: string, v: string) => list.find(x => x?.[key] === v)
  const coin = (sym: string) => cg(crypto.find(c => c?.symbol?.toUpperCase() === sym))

  // Tape order from the design.
  const TAPE: Array<[string, Session, Raw]> = [
    ['AAPL', 'us', yq(by(stocks, 'symbol', 'AAPL'))],
    ['BTC', 'crypto', coin('BTC')],
    ['NIFTY', 'in', cq(by(indices, 'name', 'NIFTY 50'))],
    ['USDINR', 'fx', cq(by(inr, 'ticker', 'USDINR=X'))],
    ['ETH', 'crypto', coin('ETH')],
    ['SPX', 'us', cq(by(overview?.indices ?? [], 'symbol', '^GSPC'))],
    ['EURUSD', 'fx', yq(by(extra, 'symbol', 'EURUSD=X'))],
    ['GOLD', 'fut', cq(by(overview?.commodities ?? [], 'symbol', 'GC=F'))],
    ['NVDA', 'us', yq(by(stocks, 'symbol', 'NVDA'))],
    ['RELIANCE', 'in', yq(by(extra, 'symbol', 'RELIANCE.NS'))],
    ['WTI', 'fut', cq(by(overview?.commodities ?? [], 'symbol', 'CL=F'))],
    ['JPY', 'fx', yq(by(extra, 'symbol', 'JPY=X'))],
    ['TSLA', 'us', yq(by(stocks, 'symbol', 'TSLA'))],
    ['SENSEX', 'in', cq(by(indices, 'name', 'SENSEX'))],
    ['SOL', 'crypto', coin('SOL')],
  ]

  const now = Date.now()
  const rows: TickerRow[] = TAPE.flatMap(([symbol, session, raw]) => {
    const price = Number(raw?.price)
    const changePercent = Number(raw?.changePct)
    const time = toMs(raw?.time)
    const status = tickerStatus(session, time, now)
    if (!(price > 0) || !Number.isFinite(changePercent) || !time || !status) return []
    return [{ symbol, price, changePercent, time, status }]
  })

  return NextResponse.json(rows)
}
