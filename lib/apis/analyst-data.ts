/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios'
import {
  Candle, sma, ema, rsi, macd, bollingerBands, atr, supertrend, vwap,
  findSupportResistance, fibonacciLevels, detectCandlestickPatterns, volumeAnalysis, last,
} from '@/lib/utils/technicals'

// ── Stock universes (15 most liquid names each) ─────────────────────────────
export const ANALYST_UNIVERSE_IN = [
  'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS',
  'SBIN.NS', 'BHARTIARTL.NS', 'ITC.NS', 'LT.NS', 'KOTAKBANK.NS',
  'AXISBANK.NS', 'BAJFINANCE.NS', 'MARUTI.NS', 'SUNPHARMA.NS', 'TATAMOTORS.NS',
]

export const ANALYST_UNIVERSE_US = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN',
  'META', 'TSLA', 'JPM', 'V', 'UNH',
  'XOM', 'JNJ', 'WMT', 'AVGO', 'LLY',
]

export const COMPANY_NAMES: Record<string, string> = {
  'RELIANCE.NS': 'Reliance Industries', 'TCS.NS': 'Tata Consultancy Services', 'HDFCBANK.NS': 'HDFC Bank',
  'INFY.NS': 'Infosys', 'ICICIBANK.NS': 'ICICI Bank', 'SBIN.NS': 'State Bank of India',
  'BHARTIARTL.NS': 'Bharti Airtel', 'ITC.NS': 'ITC', 'LT.NS': 'Larsen & Toubro', 'KOTAKBANK.NS': 'Kotak Mahindra Bank',
  'AXISBANK.NS': 'Axis Bank', 'BAJFINANCE.NS': 'Bajaj Finance', 'MARUTI.NS': 'Maruti Suzuki',
  'SUNPHARMA.NS': 'Sun Pharma', 'TATAMOTORS.NS': 'Tata Motors',
  'AAPL': 'Apple', 'MSFT': 'Microsoft', 'NVDA': 'NVIDIA', 'GOOGL': 'Alphabet', 'AMZN': 'Amazon',
  'META': 'Meta Platforms', 'TSLA': 'Tesla', 'JPM': 'JPMorgan Chase', 'V': 'Visa', 'UNH': 'UnitedHealth',
  'XOM': 'Exxon Mobil', 'JNJ': 'Johnson & Johnson', 'WMT': 'Walmart', 'AVGO': 'Broadcom', 'LLY': 'Eli Lilly',
}

// News-headline keyword match per ticker (loose substring match)
export const NEWS_KEYWORDS: Record<string, string[]> = {
  'RELIANCE.NS': ['reliance', 'ril', 'jio'], 'TCS.NS': ['tcs', 'tata consultancy'],
  'HDFCBANK.NS': ['hdfc bank', 'hdfc'], 'INFY.NS': ['infosys'], 'ICICIBANK.NS': ['icici'],
  'SBIN.NS': ['sbi', 'state bank'], 'BHARTIARTL.NS': ['bharti airtel', 'airtel'], 'ITC.NS': ['itc'],
  'LT.NS': ['larsen', 'l&t', 'l & t'], 'KOTAKBANK.NS': ['kotak'], 'AXISBANK.NS': ['axis bank'],
  'BAJFINANCE.NS': ['bajaj finance'], 'MARUTI.NS': ['maruti'], 'SUNPHARMA.NS': ['sun pharma'],
  'TATAMOTORS.NS': ['tata motors'],
}

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://finance.yahoo.com/',
}

export async function fetchHistory(ticker: string, range = '6mo', interval = '1d'): Promise<Candle[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}&includePrePost=false`
    const res = await axios.get(url, { headers: YF_HEADERS, timeout: 10000 })
    const result = (res.data as any).chart?.result?.[0]
    if (!result) return []
    const timestamps: number[] = result.timestamp || []
    const q = result.indicators?.quote?.[0] || {}
    const candles: Candle[] = []
    for (let i = 0; i < timestamps.length; i++) {
      const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i], v = q.volume?.[i]
      if (o == null || h == null || l == null || c == null) continue
      candles.push({ time: timestamps[i], open: o, high: h, low: l, close: c, volume: v || 0 })
    }
    return candles
  } catch {
    return []
  }
}

export interface StockSnapshot {
  ticker: string
  name: string
  price: number
  changePct: number
  weeklyChangePct: number
  monthlyChangePct: number
  volume: number
  volumeRatio: number
  obvTrend: 'UP' | 'DOWN' | 'FLAT'
  rsi: number | null
  macd: { value: number | null; signal: number | null; histogram: number | null }
  sma20: number | null
  sma50: number | null
  ema9: number | null
  ema21: number | null
  bollinger: { upper: number | null; middle: number | null; lower: number | null }
  atr: number | null
  supertrend: { value: number | null; trend: 'UP' | 'DOWN' | null }
  vwap: number | null
  support: number[]
  resistance: number[]
  fibonacci: Record<string, number>
  patterns: string[]
  high52: number
  low52: number
  candles?: Candle[]
}

export async function buildStockSnapshot(ticker: string, includeCandles = false): Promise<StockSnapshot | null> {
  const candles = await fetchHistory(ticker, '6mo', '1d')
  if (candles.length < 30) return null

  const closes = candles.map(c => c.close)
  const smaArr20 = sma(closes, 20)
  const smaArr50 = sma(closes, 50)
  const emaArr9 = ema(closes, 9)
  const emaArr21 = ema(closes, 21)
  const rsiArr = rsi(closes, 14)
  const macdRes = macd(closes)
  const bb = bollingerBands(closes, 20, 2)
  const atrArr = atr(candles, 14)
  const st = supertrend(candles, 10, 3)
  const vw = vwap(candles.slice(-20))
  const sr = findSupportResistance(candles, 60)
  const recentSlice = candles.slice(-60)
  const fib = fibonacciLevels(Math.max(...recentSlice.map(c => c.high)), Math.min(...recentSlice.map(c => c.low)))
  const patterns = detectCandlestickPatterns(candles.slice(-5))
  const volAnalysis = volumeAnalysis(candles)

  const n = candles.length
  const latest = candles[n - 1]
  const prev = candles[n - 2]
  const weekAgo = candles[Math.max(0, n - 6)]
  const monthAgo = candles[Math.max(0, n - 22)]

  return {
    ticker,
    name: COMPANY_NAMES[ticker] || ticker.replace('.NS', ''),
    price: latest.close,
    changePct: prev ? ((latest.close - prev.close) / prev.close) * 100 : 0,
    weeklyChangePct: weekAgo ? ((latest.close - weekAgo.close) / weekAgo.close) * 100 : 0,
    monthlyChangePct: monthAgo ? ((latest.close - monthAgo.close) / monthAgo.close) * 100 : 0,
    volume: latest.volume,
    volumeRatio: Math.round(volAnalysis.volumeRatio * 100) / 100,
    obvTrend: volAnalysis.obvTrend,
    rsi: last(rsiArr),
    macd: { value: last(macdRes.macdLine), signal: last(macdRes.signalLine), histogram: last(macdRes.histogram) },
    sma20: last(smaArr20),
    sma50: last(smaArr50),
    ema9: last(emaArr9),
    ema21: last(emaArr21),
    bollinger: { upper: last(bb.upper), middle: last(bb.middle), lower: last(bb.lower) },
    atr: last(atrArr),
    supertrend: { value: last(st.value), trend: last(st.trend) },
    vwap: vw,
    support: sr.support,
    resistance: sr.resistance,
    fibonacci: fib,
    patterns,
    high52: Math.max(...candles.map(c => c.high)),
    low52: Math.min(...candles.map(c => c.low)),
    ...(includeCandles ? { candles } : {}),
  }
}

export async function buildUniverseSnapshots(tickers: string[]): Promise<StockSnapshot[]> {
  const results = await Promise.allSettled(tickers.map(t => buildStockSnapshot(t)))
  return results
    .filter((r): r is PromiseFulfilledResult<StockSnapshot | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((v): v is StockSnapshot => v !== null)
}

export interface NewsArticle { title: string; url: string; source: string; publishedAt: string; summary?: string }

export function matchNewsForTicker(articles: NewsArticle[], ticker: string, limit = 5): NewsArticle[] {
  const keywords = NEWS_KEYWORDS[ticker] || [(COMPANY_NAMES[ticker] || ticker).toLowerCase()]
  return articles
    .filter(a => keywords.some(k => a.title.toLowerCase().includes(k)))
    .slice(0, limit)
}

// ── Synthetic options chain (NSE/US live chains aren't reliably available
// without paid data — this is a model-derived approximation for UI purposes) ─
export function generateSyntheticOptionsChain(price: number, atrVal: number | null, ticker: string) {
  const strikeStep = price > 5000 ? 100 : price > 1000 ? 50 : price > 200 ? 10 : price > 50 ? 5 : 1
  const atmStrike = Math.round(price / strikeStep) * strikeStep
  const ivBase = atrVal ? Math.min(60, Math.max(15, (atrVal / price) * 100 * 6)) : 28
  // Deterministic pseudo-random seeded by ticker char codes so values are stable per render cycle
  let seed = 0
  for (const ch of ticker) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
  const rand = (i: number) => {
    const x = Math.sin(seed + i * 137.13) * 10000
    return x - Math.floor(x)
  }

  const strikes = []
  for (let i = -4; i <= 4; i++) {
    const strike = atmStrike + i * strikeStep
    const dist = Math.abs(strike - price) / price
    const iv = +(ivBase + dist * 40 + rand(i) * 3).toFixed(1)
    const callOI = Math.round((1 - dist * 3) * 50000 * (1 + rand(i + 10)) )
    const putOI = Math.round((1 - dist * 3) * 50000 * (1 + rand(i + 20)))
    strikes.push({
      strike,
      call: { oi: Math.max(500, callOI), iv, ltp: +Math.max(0.5, (price - strike) + price * iv / 100 * 0.08).toFixed(2) },
      put:  { oi: Math.max(500, putOI),  iv, ltp: +Math.max(0.5, (strike - price) + price * iv / 100 * 0.08).toFixed(2) },
    })
  }
  return { atmStrike, strikeStep, ivBase: +ivBase.toFixed(1), strikes, note: 'Indicative model-derived chain — not live exchange data' }
}
