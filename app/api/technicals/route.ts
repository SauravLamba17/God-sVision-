import { NextResponse } from 'next/server'
import axios from 'axios'
import { getCache, setCache } from '@/lib/cache'
import { sma, ema, rsi, macd, bollingerBands, atr } from '@/lib/technicals'
import { getChartData } from '@/lib/apis/yahoo'

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
}

function periodToRange(period: string): string {
  const map: Record<string, string> = {
    '1d': '1d', '5d': '5d', '1mo': '1mo', '3mo': '3mo',
    '6mo': '6mo', '1y': '1y', '2y': '2y', '5y': '5y',
  }
  return map[period] || '3mo'
}

// Direct Yahoo Finance chart fetch using query1 (separate server, not rate-limited with query2)
async function fetchChartDirect(ticker: string, period: string, interval: string) {
  const range = periodToRange(period)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=${interval}&includePrePost=false&events=div%7Csplit`
  const res = await axios.get(url, { headers: YF_HEADERS, timeout: 12000 })
  const result = (res.data as any).chart?.result?.[0]
  if (!result) throw new Error('No chart data')
  const timestamps: number[] = result.timestamp || []
  const q = result.indicators?.quote?.[0] || {}
  const rows = timestamps.map((ts: number, i: number) => ({
    date: new Date(ts * 1000),
    open:   q.open?.[i],
    high:   q.high?.[i],
    low:    q.low?.[i],
    close:  q.close?.[i],
    volume: q.volume?.[i] || 0,
  })).filter(r => r.open && r.high && r.low && r.close)
  return rows
}

function buildResult(quotes: any[], ticker: string, period: string, interval: string, source: string) {
  const closes  = quotes.map((q: any) => q.close as number)
  const highs   = quotes.map((q: any) => q.high  as number)
  const lows    = quotes.map((q: any) => q.low   as number)
  const times   = quotes.map((q: any) => Math.floor(new Date(q.date).getTime() / 1000))

  const sma20  = sma(closes, 20)
  const sma50  = sma(closes, 50)
  const sma200 = sma(closes, 200)
  const ema12  = ema(closes, 12)
  const ema26  = ema(closes, 26)
  const rsi14  = rsi(closes, 14)
  const bb     = bollingerBands(closes, 20, 2)
  const atr14  = atr(highs, lows, closes, 14)
  const { macdLine, signalLine, histogram } = macd(closes, 12, 26, 9)

  const candles = quotes.map((q: any, i: number) => ({
    time: times[i], open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume,
  }))

  const indicators = quotes.map((_: any, i: number) => ({
    time: times[i],
    sma20: sma20[i], sma50: sma50[i], sma200: sma200[i],
    ema12: ema12[i], ema26: ema26[i],
    rsi: rsi14[i],
    bbUpper: bb[i].upper, bbMiddle: bb[i].middle, bbLower: bb[i].lower,
    macd: macdLine[i], macdSignal: signalLine[i], macdHist: histogram[i],
    atr: atr14[i],
  }))

  const lastIdx   = closes.length - 1
  const lastClose = closes[lastIdx]
  const lastRSI   = rsi14[lastIdx]
  const lastMACD  = macdLine[lastIdx]
  const lastSig   = signalLine[lastIdx]

  return {
    ticker, period, interval, source,
    candles, indicators,
    signals: {
      rsiSignal:   lastRSI === null ? 'N/A' : lastRSI > 70 ? 'OVERBOUGHT' : lastRSI < 30 ? 'OVERSOLD' : 'NEUTRAL',
      macdSignal:  lastMACD !== null && lastSig !== null
                    ? (lastMACD > lastSig ? 'BULLISH CROSSOVER' : 'BEARISH CROSSOVER') : 'N/A',
      trendSignal: sma50[lastIdx] !== null && lastClose > (sma50[lastIdx] as number) ? 'ABOVE 50 SMA' : 'BELOW 50 SMA',
      bbSignal:    bb[lastIdx].upper !== null
                    ? (lastClose > (bb[lastIdx].upper as number) ? 'BB SQUEEZE HIGH' : lastClose < (bb[lastIdx].lower as number) ? 'BB SQUEEZE LOW' : 'WITHIN BB')
                    : 'N/A',
      rsi: lastRSI, macdValue: lastMACD,
    },
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ticker   = (searchParams.get('ticker') || 'SPY').toUpperCase()
  const period   = searchParams.get('period')   || '3mo'
  const interval = searchParams.get('interval') || '1d'

  const cacheKey = `technicals_${ticker}_${period}_${interval}`
  const cached   = getCache(cacheKey)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: (cached.data as any)?.source || 'cached' })

  const ttl = period === '1d' ? 60 : 300

  // 1. Try query1 FIRST — fast, separate rate-limit pool, no crumb needed
  try {
    const rows = await fetchChartDirect(ticker, period, interval)
    if (rows.length > 0) {
      const data = buildResult(rows, ticker, period, interval, 'live')
      setCache(cacheKey, data, ttl)
      return NextResponse.json({ data, source: 'live' })
    }
  } catch { /* fall through */ }

  // 2. Fallback: yahoo-finance2 (query2 with crumb auth)
  try {
    const chart  = await getChartData(ticker, period, interval)
    const quotes = (chart.quotes || []).filter((q: any) => q.open && q.high && q.low && q.close)
    if (quotes.length > 0) {
      const data = buildResult(quotes, ticker, period, interval, 'live')
      setCache(cacheKey, data, ttl)
      return NextResponse.json({ data, source: 'live' })
    }
  } catch { /* fall through */ }

  // 3. Return stale cache if available
  if (cached) return NextResponse.json({ data: cached.data, source: 'stale' })
  return NextResponse.json({ error: 'Chart data temporarily unavailable', rateLimited: true }, { status: 429 })
}
