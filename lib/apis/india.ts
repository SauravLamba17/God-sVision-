/* eslint-disable @typescript-eslint/no-explicit-any */
import yahooFinance from 'yahoo-finance2'
import axios from 'axios'

// ── Indian index tickers (Yahoo Finance) ────────────────────────────────────
export const INDIA_INDEX_TICKERS: Record<string, string> = {
  'NIFTY 50':    '^NSEI',
  'SENSEX':      '^BSESN',
  'BANK NIFTY':  '^NSEBANK',
  'NIFTY IT':    'NIFTYIT.NS',
  'NIFTY MIDCAP':'^NSMIDCP',
  'INDIA VIX':   '^INDIAVIX',
}

// ── Top Nifty 50 stocks (NSE) ───────────────────────────────────────────────
export const NIFTY50_STOCKS = [
  'RELIANCE.NS','TCS.NS','HDFCBANK.NS','INFY.NS','HINDUNILVR.NS',
  'ICICIBANK.NS','KOTAKBANK.NS','LT.NS','SBIN.NS','BHARTIARTL.NS',
  'ASIANPAINT.NS','AXISBANK.NS','ITC.NS','BAJFINANCE.NS','MARUTI.NS',
  'WIPRO.NS','HCLTECH.NS','ULTRACEMCO.NS','NESTLEIND.NS','POWERGRID.NS',
  'TITAN.NS','TATAMOTORS.NS','SUNPHARMA.NS','TECHM.NS','NTPC.NS',
  'ONGC.NS','JSWSTEEL.NS','TATASTEEL.NS','ADANIENT.NS','ADANIPORTS.NS',
  'DRREDDY.NS','CIPLA.NS','DIVISLAB.NS','BAJAJFINSV.NS','EICHERMOT.NS',
  'GRASIM.NS','HEROMOTOCO.NS','HINDALCO.NS','INDUSINDBK.NS','M&M.NS',
  'BRITANNIA.NS','COALINDIA.NS','BPCL.NS','TATACONSUM.NS','APOLLOHOSP.NS',
  'SBILIFE.NS','HDFCLIFE.NS','UPL.NS','SHREECEM.NS','BAJAJ-AUTO.NS',
]

// ── INR forex pairs ─────────────────────────────────────────────────────────
export const INDIA_FOREX_PAIRS = [
  { pair: 'USD/INR', ticker: 'USDINR=X' },
  { pair: 'EUR/INR', ticker: 'EURINR=X' },
  { pair: 'GBP/INR', ticker: 'GBPINR=X' },
  { pair: 'JPY/INR', ticker: 'JPYINR=X' },
  { pair: 'AUD/INR', ticker: 'AUDINR=X' },
  { pair: 'CAD/INR', ticker: 'CADINR=X' },
  { pair: 'CHF/INR', ticker: 'CHFINR=X' },
  { pair: 'CNY/INR', ticker: 'CNYINR=X' },
  { pair: 'SGD/INR', ticker: 'SGDINR=X' },
  { pair: 'AED/INR', ticker: 'AEDINR=X' },
]

// ── MCX commodity tickers ───────────────────────────────────────────────────
export const MCX_COMMODITY_TICKERS = {
  GOLD:    'GC=F',
  SILVER:  'SI=F',
  CRUDE:   'CL=F',
  NATGAS:  'NG=F',
  COPPER:  'HG=F',
}

// ── India macro static data (RBI/MoSPI — update when RBI changes rates) ────
export const INDIA_MACRO = {
  repoRate:        6.50,
  reverseRepoRate: 3.35,
  crrRate:         4.50,
  slrRate:         18.00,
  gdpGrowth:       7.6,
  cpiInflation:    4.85,
  wpiInflation:    0.53,
  iipGrowth:       5.0,
  fiscalDeficit:   5.1,
  currentAccount:  -1.3,
  forexReserves:   616.1,
  npaRatio:        3.9,
  unemployment:    7.8,
}

// ── India yield curve (G-Sec — update quarterly) ────────────────────────────
export const INDIA_YIELD_CURVE = [
  { label: 'Overnight', maturity: 0, yield: 6.50 },
  { label: '91D',       maturity: 0.25, yield: 6.65 },
  { label: '182D',      maturity: 0.5,  yield: 6.72 },
  { label: '364D',      maturity: 1,    yield: 6.78 },
  { label: '2Y',        maturity: 2,    yield: 6.82 },
  { label: '5Y',        maturity: 5,    yield: 6.92 },
  { label: '10Y',       maturity: 10,   yield: 7.10 },
  { label: '30Y',       maturity: 30,   yield: 7.35 },
]

// ── Indian news RSS feeds ────────────────────────────────────────────────────
export const INDIA_NEWS_FEEDS = [
  { name: 'Economic Times Markets', url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms' },
  { name: 'Economic Times',         url: 'https://economictimes.indiatimes.com/rssfeedstopstories.cms' },
  { name: 'Business Standard',      url: 'https://www.business-standard.com/rss/markets-106.rss' },
  { name: 'Livemint',               url: 'https://www.livemint.com/rss/markets' },
  { name: 'Financial Express',      url: 'https://www.financialexpress.com/market/feed/' },
  { name: 'NDTV Profit',            url: 'https://feeds.feedburner.com/ndtvprofit-latest' },
  { name: 'The Hindu Business',     url: 'https://www.thehindu.com/business/feeder/default.rss' },
]

// ── Next RBI MPC meetings (update as needed) ─────────────────────────────────
export const RBI_MPC_MEETINGS = [
  { date: '2025-08-06', resolution: '2025-08-08', decision: 'PENDING' },
  { date: '2025-10-07', resolution: '2025-10-09', decision: 'PENDING' },
  { date: '2025-12-03', resolution: '2025-12-05', decision: 'PENDING' },
  { date: '2026-02-05', resolution: '2026-02-07', decision: 'PENDING' },
  { date: '2026-04-07', resolution: '2026-04-09', decision: 'PENDING' },
  { date: '2026-06-03', resolution: '2026-06-05', decision: 'PENDING' },
]

// ── Static FII/DII data (updated from NSE daily press release) ──────────────
export const FII_DII_DATA = {
  fiiNetEquity:  2345,   // ₹ Cr — positive = net buying
  diiNetEquity:  1234,   // ₹ Cr
  fiiNetDebt:    -456,   // ₹ Cr
  fiiYTDEquity:  22450,  // ₹ Cr — YTD accumulation
  diiYTDEquity:  18700,
  lastUpdated:   '2026-06-27',
}

// ── Indian market hours ──────────────────────────────────────────────────────
export function getIndianMarketStatus(): 'OPEN' | 'CLOSED' | 'PRE-OPEN' | 'AFTER-HOURS' {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long', hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(now)

  const weekday = parts.find(p => p.type === 'weekday')?.value ?? ''
  const hour    = parseInt(parts.find(p => p.type === 'hour')?.value   ?? '0', 10)
  const minute  = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10)
  const t = hour * 100 + minute

  if (['Saturday', 'Sunday'].includes(weekday)) return 'CLOSED'
  if (t >= 900  && t < 915)  return 'PRE-OPEN'
  if (t >= 915  && t < 1530) return 'OPEN'
  if (t >= 1530 && t < 1600) return 'AFTER-HOURS'
  return 'CLOSED'
}

// ── Yahoo Finance chart (query1 v8) — no crumb, returns close[] ─────────────
const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://finance.yahoo.com/',
}

async function fetchChart(ticker: string, range = '5d', interval = '1d'): Promise<any | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}&includePrePost=false`
    const res  = await axios.get(url, { headers: YF_HEADERS, timeout: 8000 })
    const result = (res.data as any).chart?.result?.[0]
    if (!result) return null
    const meta  = result.meta
    const closes = result.indicators?.quote?.[0]?.close ?? []
    const prev  = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice
    const price = meta.regularMarketPrice
    return {
      symbol:    meta.symbol || ticker,
      shortName: meta.shortName || ticker,
      price, prev,
      change:    price - prev,
      changePct: prev ? ((price - prev) / prev) * 100 : 0,
      volume:    meta.regularMarketVolume || 0,
      high:      meta.regularMarketDayHigh   || price,
      low:       meta.regularMarketDayLow    || price,
      open:      meta.regularMarketOpen      || price,
      high52:    meta.fiftyTwoWeekHigh,
      low52:     meta.fiftyTwoWeekLow,
      currency:  meta.currency,
      sparkline: closes.filter(Boolean).slice(-5),
    }
  } catch {
    return null
  }
}

export async function fetchIndiaIndices() {
  const entries = Object.entries(INDIA_INDEX_TICKERS)
  const results = await Promise.allSettled(entries.map(([, ticker]) => fetchChart(ticker)))
  return entries.map(([name, ticker], i) => {
    const r = results[i]
    const d = r.status === 'fulfilled' ? r.value : null
    return { name, ticker, ...(d || { symbol: ticker, price: 0, change: 0, changePct: 0, volume: 0, sparkline: [] }) }
  }).filter(x => x.price > 0)
}

export async function fetchNifty50Quotes() {
  const results = await Promise.allSettled(NIFTY50_STOCKS.map(t => fetchChart(t)))
  return results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => (r as PromiseFulfilledResult<any>).value)
}

export async function fetchIndiaForex(exchangeRate: number) {
  const tickers = INDIA_FOREX_PAIRS.map(p => p.ticker)
  const results = await Promise.allSettled(tickers.map(t => fetchChart(t, '1d', '1d')))
  return INDIA_FOREX_PAIRS.map((pair, i) => {
    const r = results[i]
    const d = r.status === 'fulfilled' ? r.value : null
    return {
      pair: pair.pair,
      ticker: pair.ticker,
      price: d?.price ?? (pair.ticker === 'USDINR=X' ? exchangeRate : 0),
      change: d?.change ?? 0,
      changePct: d?.changePct ?? 0,
    }
  })
}

export async function fetchMCXCommodities(exchangeRate: number) {
  const entries = Object.entries(MCX_COMMODITY_TICKERS)
  const results = await Promise.allSettled(entries.map(([, t]) => fetchChart(t)))
  return entries.map(([name, ticker], i) => {
    const r = results[i]
    const d = r.status === 'fulfilled' ? r.value : null
    if (!d) return null
    let priceINR = d.price * exchangeRate
    let unit = '₹/unit'
    if (name === 'GOLD') {
      priceINR = d.price * 31.1035 * exchangeRate / 10 // per 10g
      unit = '₹/10g'
    } else if (name === 'SILVER') {
      priceINR = d.price * 32.1507 * exchangeRate // per kg
      unit = '₹/kg'
    } else if (name === 'CRUDE') {
      priceINR = d.price * exchangeRate
      unit = '₹/bbl'
    } else if (name === 'NATGAS') {
      priceINR = d.price * exchangeRate
      unit = '₹/MMBtu'
    } else if (name === 'COPPER') {
      priceINR = d.price * exchangeRate * 2.20462 // USD/lb → INR/kg
      unit = '₹/kg'
    }
    return {
      name, ticker, usdPrice: d.price, priceINR, unit,
      change: d.change, changePct: d.changePct,
    }
  }).filter(Boolean)
}

// Export the fetchChart function for direct use
export { fetchChart }
