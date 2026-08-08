import { NextResponse } from 'next/server'
import axios from 'axios'
import { getCache, setCache } from '@/lib/cache'

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json,text/plain,*/*',
  'Referer': 'https://finance.yahoo.com/',
}

async function fetchQ(ticker: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=5d&interval=1d&includePrePost=false`
  const res = await axios.get(url, { headers: YF_HEADERS, timeout: 10000 })
  const result = res.data?.chart?.result?.[0]
  if (!result) throw new Error(`no data: ${ticker}`)
  const meta   = result.meta
  const closes = (result.indicators?.quote?.[0]?.close || []).filter(Boolean) as number[]
  const prev   = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPreviousClose || meta.regularMarketPrice
  const price  = meta.regularMarketPrice as number
  const change = price - prev
  return {
    symbol:    meta.symbol    || ticker,
    shortName: meta.shortName || ticker,
    price,
    change,
    changePct: prev ? (change / prev) * 100 : 0,
    volume:    (meta.regularMarketVolume as number) || 0,
    sparkline: closes.slice(-7),
  }
}

async function fetchBatch(tickers: string[]) {
  const settled = await Promise.allSettled(tickers.map(t => fetchQ(t)))
  return settled.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { symbol: tickers[i], shortName: tickers[i], price: 0, change: 0, changePct: 0, volume: 0, sparkline: [], failed: true }
  )
}

const INDEX_TICKERS  = ['^GSPC', '^IXIC', '^DJI', '^VIX', '^RUT']
const INDEX_LABELS: Record<string, string> = {
  '^GSPC': 'S&P 500', '^IXIC': 'NASDAQ', '^DJI': 'DOW JONES', '^VIX': 'FEAR INDEX', '^RUT': 'RUSSELL 2000',
}

const COMMOD_TICKERS = ['GC=F', 'SI=F', 'CL=F', 'BZ=F', 'NG=F', 'HG=F', '^TNX', '^IRX']
const COMMOD_LABELS: Record<string, string> = {
  'GC=F': 'GOLD', 'SI=F': 'SILVER', 'CL=F': 'WTI', 'BZ=F': 'BRENT',
  'NG=F': 'NAT GAS', 'HG=F': 'COPPER', '^TNX': 'US 10Y', '^IRX': 'US 3M',
}
const COMMOD_UNITS: Record<string, string> = {
  'GC=F': '/oz', 'SI=F': '/oz', 'CL=F': '/bbl', 'BZ=F': '/bbl',
  'NG=F': '/MMBtu', 'HG=F': '/lb', '^TNX': '%', '^IRX': '%',
}

const GLOBAL_TICKERS = ['^N225', '000001.SS', '^HSI', '^BSESN', '^AXJO', '^FTSE', '^GDAXI', '^FCHI', '^STOXX50E', '^GSPTSE', '^BVSP']
const GLOBAL_LABELS: Record<string, string> = {
  '^N225': 'NIKKEI', '000001.SS': 'SHANGHAI', '^HSI': 'HANG SENG',
  '^BSESN': 'SENSEX', '^AXJO': 'ASX 200', '^FTSE': 'FTSE 100',
  '^GDAXI': 'DAX', '^FCHI': 'CAC 40', '^STOXX50E': 'EURO STOXX',
  '^GSPTSE': 'TSX', '^BVSP': 'BOVESPA',
}
const GLOBAL_REGION: Record<string, string> = {
  '^N225': 'ASIA', '000001.SS': 'ASIA', '^HSI': 'ASIA', '^BSESN': 'ASIA', '^AXJO': 'ASIA',
  '^FTSE': 'EUR', '^GDAXI': 'EUR', '^FCHI': 'EUR', '^STOXX50E': 'EUR',
  '^GSPTSE': 'AMER', '^BVSP': 'AMER',
}

const SECTOR_TICKERS = ['XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLRE', 'XLB', 'XLC']

export async function GET() {
  const cacheKey = 'dashboard_overview_v2'
  const cached   = await getCache(cacheKey)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })

  const [indR, comR, glbR, secR] = await Promise.allSettled([
    fetchBatch(INDEX_TICKERS),
    fetchBatch(COMMOD_TICKERS),
    fetchBatch(GLOBAL_TICKERS),
    fetchBatch(SECTOR_TICKERS),
  ])

  const indices = (indR.status === 'fulfilled' ? indR.value : []).map(q => ({
    ...q, label: INDEX_LABELS[q.symbol] || q.shortName,
  }))

  const commodities = (comR.status === 'fulfilled' ? comR.value : []).map(q => ({
    ...q, label: COMMOD_LABELS[q.symbol] || q.symbol, unit: COMMOD_UNITS[q.symbol] || '',
  }))

  const globalMarkets = (glbR.status === 'fulfilled' ? glbR.value : []).map(q => ({
    ...q, label: GLOBAL_LABELS[q.symbol] || q.symbol, region: GLOBAL_REGION[q.symbol] || 'AMER',
  }))

  // Approximate S&P 500 breadth from sector ETFs (~45 stocks each)
  const sectors = secR.status === 'fulfilled' ? secR.value : []
  let advancing = 0, declining = 0
  sectors.forEach(s => {
    if (s.changePct > 0.1) advancing += 45
    else if (s.changePct < -0.1) declining += 45
  })
  const unchanged = Math.max(0, 500 - advancing - declining)

  const data = { indices, commodities, globalMarkets, breadth: { advancing, declining, unchanged }, fetchedAt: Date.now() }
  await setCache(cacheKey, data, 30)
  return NextResponse.json({ data, source: 'live' })
}
