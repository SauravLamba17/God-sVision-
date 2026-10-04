import { getCache, setCache } from '@/lib/cache'
import { getChartData } from '@/lib/apis/yahoo'

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

// Daily closes keyed by UTC date. Crypto trades 7 days a week and equities 5,
// so returns must be computed on the dates BOTH series share — pairing them by
// array index (as before) correlated SPY's Monday with BTC's Saturday and
// pushed every crypto/equity cell to ~0.
async function fetchCloses(symbol: string): Promise<Record<string, number>> {
  const chart = await getChartData(symbol, '3mo', '1d').catch(() => null)
  const out: Record<string, number> = {}
  for (const q of chart?.quotes ?? []) {
    if (q?.close) out[new Date(q.date).toISOString().slice(0, 10)] = q.close
  }
  return out
}

function alignedReturns(a: Record<string, number>, b: Record<string, number>): [number[], number[]] {
  const dates = Object.keys(a).filter(d => d in b).sort()
  const ra: number[] = [], rb: number[] = []
  for (let i = 1; i < dates.length; i++) {
    ra.push(Math.log(a[dates[i]] / a[dates[i - 1]]))
    rb.push(Math.log(b[dates[i]] / b[dates[i - 1]]))
  }
  return [ra, rb]
}

function ownReturns(c: Record<string, number>): number[] {
  return alignedReturns(c, c)[0]
}

export async function getCorrelationMatrix(): Promise<CorrelationData> {
  const cacheKey = 'correlation_matrix_v2'
  const cached = await getCache(cacheKey)
  if (cached && !cached.stale) return cached.data as CorrelationData

  const symbols = ASSETS.map(a => a.symbol)
  const closeSets = await Promise.all(symbols.map(s => fetchCloses(s)))
  const returns: Record<string, number[]> = {}
  symbols.forEach((s, i) => { returns[s] = ownReturns(closeSets[i]) })

  const n = symbols.length
  const matrix: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      i === j ? 1 : pearson(...alignedReturns(closeSets[i], closeSets[j]))
    )
  )

  const data: CorrelationData = { symbols, matrix, returns, period: 90, generatedAt: Date.now() }
  await setCache(cacheKey, data, 3600) // 1 hour
  return data
}
