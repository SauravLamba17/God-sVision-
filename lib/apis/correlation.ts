import { getCache, setCache } from '@/lib/cache'
import { getChartData } from '@/lib/apis/yahoo'
import axios from 'axios'

export const ASSETS = [
  { symbol: 'SPY', name: 'S&P 500', type: 'equity' },
  { symbol: 'QQQ', name: 'Nasdaq 100', type: 'equity' },
  { symbol: 'GLD', name: 'Gold', type: 'commodity' },
  { symbol: 'TLT', name: '20Y Bonds', type: 'bond' },
  { symbol: 'USO', name: 'Crude Oil', type: 'commodity' },
  { symbol: 'UUP', name: 'USD Index', type: 'fx' },
  { symbol: 'VXX', name: 'VIX Futures', type: 'volatility' },
  { symbol: 'BTC-USD', name: 'Bitcoin', type: 'crypto' },
  { symbol: 'ETH-USD', name: 'Ethereum', type: 'crypto' },
  { symbol: 'SOL-USD', name: 'Solana', type: 'crypto' },
]

export interface CorrelationData {
  symbols: string[]
  matrix: number[][] // [i][j] = Pearson correlation
  returns: Record<string, number[]>
  period: number // days
  generatedAt: number
}

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 5) return 0
  const x = a.slice(0, n), y = b.slice(0, n)
  const mx = x.reduce((s, v) => s + v, 0) / n
  const my = y.reduce((s, v) => s + v, 0) / n
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) {
    const ex = x[i] - mx, ey = y[i] - my
    num += ex * ey; dx += ex * ex; dy += ey * ey
  }
  const denom = Math.sqrt(dx * dy)
  return denom === 0 ? 0 : Math.round((num / denom) * 100) / 100
}

async function fetchReturns(symbol: string): Promise<number[]> {
  try {
    // Use query1 directly for historical data
    const encoded = encodeURIComponent(symbol)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=3mo&interval=1d&includePrePost=false`
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://finance.yahoo.com/' },
      timeout: 8000,
    })
    const closes: number[] = res.data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
    // Compute daily log returns
    const returns: number[] = []
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] && closes[i - 1]) {
        returns.push(Math.log(closes[i] / closes[i - 1]))
      }
    }
    return returns
  } catch {
    try {
      const chart = await getChartData(symbol, '3mo', '1d')
      const quotes = chart?.quotes ?? []
      const returns: number[] = []
      for (let i = 1; i < quotes.length; i++) {
        if (quotes[i]?.close && quotes[i - 1]?.close) {
          returns.push(Math.log(quotes[i].close / quotes[i - 1].close))
        }
      }
      return returns
    } catch { return [] }
  }
}

export async function getCorrelationMatrix(): Promise<CorrelationData> {
  const cacheKey = 'correlation_matrix'
  const cached = getCache(cacheKey)
  if (cached && !cached.stale) return cached.data as CorrelationData

  const symbols = ASSETS.map(a => a.symbol)
  const returnSets = await Promise.allSettled(symbols.map(s => fetchReturns(s)))
  const returns: Record<string, number[]> = {}
  symbols.forEach((s, i) => {
    returns[s] = returnSets[i].status === 'fulfilled' ? returnSets[i].value : []
  })

  const n = symbols.length
  const matrix: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      i === j ? 1 : pearson(returns[symbols[i]], returns[symbols[j]])
    )
  )

  const data: CorrelationData = { symbols, matrix, returns, period: 90, generatedAt: Date.now() }
  setCache(cacheKey, data, 3600) // 1 hour
  return data
}
