/* eslint-disable @typescript-eslint/no-explicit-any */
import yahooFinance from 'yahoo-finance2'
import axios from 'axios'

export const DEFAULT_TICKERS = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'JPM']

// Browser-like headers for query1 direct requests (no crumb needed, separate rate-limit pool)
const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com',
}

// ── Lightweight throttle for query2 (yahoo-finance2) calls ──────────────────
// query1 bypasses this entirely (different rate-limit pool)
let activeRequests = 0
const MAX_CONCURRENT = 2
const queue: Array<() => void> = []
let lastRequestTime = 0
const MIN_DELAY_MS = 400

async function throttle(): Promise<void> {
  return new Promise(resolve => {
    const tryRun = () => {
      if (activeRequests >= MAX_CONCURRENT) { queue.push(tryRun); return }
      const now = Date.now()
      const sinceLastRequest = now - lastRequestTime
      if (sinceLastRequest < MIN_DELAY_MS) {
        setTimeout(tryRun, MIN_DELAY_MS - sinceLastRequest)
        return
      }
      activeRequests++
      lastRequestTime = Date.now()
      resolve()
    }
    tryRun()
  })
}

function releaseThrottle() {
  activeRequests--
  if (queue.length > 0) {
    const next = queue.shift()!
    setTimeout(next, MIN_DELAY_MS)
  }
}

// Retry only 2 times with short delays — we have query1 fallbacks so long retries are wasteful
export async function withYahooRetry<T>(fn: () => Promise<T>, retries = 2, baseDelay = 1500): Promise<T> {
  return withRetry(fn, retries, baseDelay)
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelay = 1500): Promise<T> {
  for (let i = 0; i < retries; i++) {
    await throttle()
    try {
      const result = await fn()
      releaseThrottle()
      return result
    } catch (err: any) {
      releaseThrottle()
      const msg = err?.message || ''
      if ((msg.includes('Too Many Requests') || msg.includes('429') || msg.includes('invalid json')) && i < retries - 1) {
        await new Promise(r => setTimeout(r, baseDelay * (i + 1)))
        continue
      }
      throw err
    }
  }
  throw new Error('RATE_LIMIT: Max retries exceeded')
}

// ── Direct query1 quote via chart metadata (no crumb needed) ─────────────────
// query1/v7/finance/quote requires a crumb (401 without it).
// query1/v8/finance/chart works unauthenticated and its `meta` field has the key pricing fields.
async function fetchOneQuoteByChart(ticker: string): Promise<any | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1d&interval=1d&includePrePost=false`
  try {
    const res = await axios.get(url, { headers: YF_HEADERS, timeout: 8000 })
    const meta = (res.data as any).chart?.result?.[0]?.meta
    if (!meta) return null
    const prev = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPreviousClose || meta.regularMarketPrice
    const price = meta.regularMarketPrice
    const change = price - prev
    return {
      symbol: meta.symbol || ticker,
      shortName: meta.shortName || ticker,
      regularMarketPrice: price,
      regularMarketChange: change,
      regularMarketChangePercent: prev ? (change / prev) * 100 : 0,
      regularMarketVolume: meta.regularMarketVolume || 0,
      regularMarketOpen: meta.regularMarketOpen || price,
      regularMarketDayHigh: meta.regularMarketDayHigh || price,
      regularMarketDayLow: meta.regularMarketDayLow || price,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
      currency: meta.currency,
      exchange: meta.exchangeName,
      quoteType: meta.instrumentType,
      marketCap: meta.marketCap,
    }
  } catch {
    return null
  }
}

async function fetchQuotesByChart(tickers: string[]): Promise<any[]> {
  const results = await Promise.allSettled(tickers.map(t => fetchOneQuoteByChart(t)))
  return results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => (r as PromiseFulfilledResult<any>).value)
}

// ── Public API ───────────────────────────────────────────────────────────────

// Batch quote: chart-based query1 first (fast, no crumb), query2 as fallback
export async function getQuotes(tickers: string[]): Promise<any[]> {
  try {
    const data = await fetchQuotesByChart(tickers)
    if (data.length > 0) return data
  } catch { /* fall through to yahoo-finance2 */ }
  try {
    const result = await withRetry(() => (yahooFinance as any).quote(tickers))
    return Array.isArray(result) ? result : [result].filter(Boolean)
  } catch {
    return []
  }
}

// Single quote
export async function getQuote(ticker: string): Promise<any> {
  const list = await getQuotes([ticker])
  if (list.length > 0) return list[0]
  return withRetry(() => (yahooFinance as any).quote(ticker))
}

// Chart data — query1 is tried in the technicals route directly; this is query2 path
export async function getChartData(ticker: string, period = '3mo', interval = '1d'): Promise<any> {
  return withRetry(() => (yahooFinance as any).chart(ticker, {
    period1: getStartDate(period),
    period2: new Date(),
    interval,
  }))
}

function getStartDate(period: string): Date {
  const now = new Date()
  const map: Record<string, number> = {
    '1d': 1, '5d': 7, '1mo': 35, '3mo': 95, '6mo': 185, '1y': 370, '2y': 740, '5y': 1830
  }
  const days = map[period] || 95
  now.setDate(now.getDate() - days)
  return now
}

export async function getQuoteSummary(ticker: string): Promise<any> {
  try {
    return await withRetry(() => (yahooFinance as any).quoteSummary(ticker, {
      modules: ['summaryDetail', 'financialData', 'defaultKeyStatistics', 'recommendationTrend', 'earningsHistory']
    }))
  } catch {
    return null
  }
}

export async function getOptionsChain(ticker: string): Promise<any> {
  try {
    return await withRetry(() => (yahooFinance as any).options(ticker))
  } catch {
    return null
  }
}

const MOVER_WATCHLIST = [
  'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','JPM','V','JNJ',
  'WMT','PG','MA','UNH','HD','CVX','MRK','ABBV','PEP','KO',
  'AVGO','COST','TMO','MCD','ACN','LIN','DHR','TXN','NEE','PM',
  'INTC','AMD','PYPL','ADBE','CRM','NFLX','ORCL','QCOM','T','VZ',
  'BAC','WFC','GS','MS','C','BLK','AXP','USB','PNC','TFC',
]

export async function getMarketMovers(): Promise<{ gainers: any[]; losers: any[] }> {
  // Try yahoo-finance2 screener first
  try {
    const [g, l] = await Promise.allSettled([
      withRetry(() => (yahooFinance as any).screener({ scrIds: 'day_gainers', count: 10 })),
      withRetry(() => (yahooFinance as any).screener({ scrIds: 'day_losers',  count: 10 })),
    ])
    const gainers = g.status === 'fulfilled' ? (g.value as any)?.quotes || [] : []
    const losers  = l.status === 'fulfilled' ? (l.value as any)?.quotes || [] : []
    if (gainers.length > 0 || losers.length > 0) return { gainers, losers }
  } catch { /* fall through */ }

  // Fallback: fetch 50 liquid tickers via query1 and sort by % change
  try {
    const quotes = await fetchQuotesByChart(MOVER_WATCHLIST)
    const valid  = quotes.filter(q => q.regularMarketChangePercent != null)
    const sorted = [...valid].sort((a, b) => b.regularMarketChangePercent - a.regularMarketChangePercent)
    return {
      gainers: sorted.slice(0, 10),
      losers:  sorted.slice(-10).reverse(),
    }
  } catch {
    return { gainers: [], losers: [] }
  }
}
