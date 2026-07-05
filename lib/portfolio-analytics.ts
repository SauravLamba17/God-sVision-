export function dailyReturns(prices: number[]): number[] {
  const returns: number[] = []
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1])
  }
  return returns
}

export function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length
}

export function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / (arr.length - 1))
}

export function sharpeRatio(returns: number[], riskFreeAnnual = 0.05): number {
  if (returns.length < 2) return 0
  const annualRFDaily = riskFreeAnnual / 252
  const excess = returns.map(r => r - annualRFDaily)
  const m = mean(excess)
  const s = stdDev(excess)
  return s === 0 ? 0 : (m / s) * Math.sqrt(252)
}

export function sortinoRatio(returns: number[], riskFreeAnnual = 0.05): number {
  if (returns.length < 2) return 0
  const annualRFDaily = riskFreeAnnual / 252
  const excess = returns.map(r => r - annualRFDaily)
  const m = mean(excess)
  const negExcess = excess.filter(r => r < 0)
  if (negExcess.length === 0) return Infinity
  const downDeviation = Math.sqrt(negExcess.reduce((sum, r) => sum + r * r, 0) / negExcess.length)
  return downDeviation === 0 ? 0 : (m / downDeviation) * Math.sqrt(252)
}

export function beta(assetReturns: number[], marketReturns: number[]): number {
  const n = Math.min(assetReturns.length, marketReturns.length)
  if (n < 2) return 1
  const a = assetReturns.slice(0, n)
  const m = marketReturns.slice(0, n)
  const ma = mean(a), mm = mean(m)
  const cov = a.reduce((sum, r, i) => sum + (r - ma) * (m[i] - mm), 0) / (n - 1)
  const varM = m.reduce((sum, r) => sum + Math.pow(r - mm, 2), 0) / (n - 1)
  return varM === 0 ? 1 : cov / varM
}

export function alpha(assetReturns: number[], marketReturns: number[], b: number, riskFreeAnnual = 0.05): number {
  const annualRFDaily = riskFreeAnnual / 252
  const annualAsset  = mean(assetReturns) * 252
  const annualMarket = mean(marketReturns) * 252
  return annualAsset - (annualRFDaily * 252 + b * (annualMarket - annualRFDaily * 252))
}

export function maxDrawdown(prices: number[]): number {
  let peak = prices[0], maxDD = 0
  for (const p of prices) {
    if (p > peak) peak = p
    const dd = (peak - p) / peak
    if (dd > maxDD) maxDD = dd
  }
  return maxDD
}

export function valueAtRisk(returns: number[], confidence = 0.95): number {
  if (returns.length === 0) return 0
  const sorted = [...returns].sort((a, b) => a - b)
  const idx = Math.floor((1 - confidence) * sorted.length)
  return Math.abs(sorted[Math.max(0, idx)])
}

export function conditionalVaR(returns: number[], confidence = 0.95): number {
  if (returns.length === 0) return 0
  const sorted = [...returns].sort((a, b) => a - b)
  const idx = Math.floor((1 - confidence) * sorted.length)
  const tail = sorted.slice(0, Math.max(1, idx))
  return Math.abs(mean(tail))
}

export function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 2) return 0
  const ma = mean(a.slice(0, n)), mb = mean(b.slice(0, n))
  const num   = a.slice(0, n).reduce((sum, v, i) => sum + (v - ma) * (b[i] - mb), 0)
  const denA  = Math.sqrt(a.slice(0, n).reduce((sum, v) => sum + Math.pow(v - ma, 2), 0))
  const denB  = Math.sqrt(b.slice(0, n).reduce((sum, v) => sum + Math.pow(v - mb, 2), 0))
  return denA === 0 || denB === 0 ? 0 : num / (denA * denB)
}

export function correlationMatrix(returnsMap: Record<string, number[]>): { tickers: string[]; matrix: number[][] } {
  const tickers = Object.keys(returnsMap)
  const matrix = tickers.map(a =>
    tickers.map(b => correlation(returnsMap[a], returnsMap[b]))
  )
  return { tickers, matrix }
}

export function calmarRatio(annualReturn: number, maxDD: number): number {
  return maxDD === 0 ? 0 : annualReturn / maxDD
}
