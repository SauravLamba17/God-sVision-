export function sma(data: number[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null
    return data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
  })
}

export function ema(data: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1)
  const result: (number | null)[] = new Array(data.length).fill(null)
  const firstIdx = period - 1
  if (data.length < period) return result
  result[firstIdx] = data.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = firstIdx + 1; i < data.length; i++) {
    result[i] = data[i] * k + (result[i - 1] as number) * (1 - k)
  }
  return result
}

export function rsi(data: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null)
  if (data.length < period + 1) return result

  const gains: number[] = []
  const losses: number[] = []
  for (let i = 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1]
    gains.push(diff > 0 ? diff : 0)
    losses.push(diff < 0 ? -diff : 0)
  }

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period
  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss
  result[period] = 100 - 100 / (1 + rs0)

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    result[i + 1] = 100 - 100 / (1 + rs)
  }
  return result
}

export function macd(
  data: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): { macdLine: (number | null)[]; signalLine: (number | null)[]; histogram: (number | null)[] } {
  const fast = ema(data, fastPeriod)
  const slow = ema(data, slowPeriod)

  const macdLine: (number | null)[] = data.map((_, i) =>
    fast[i] !== null && slow[i] !== null ? (fast[i] as number) - (slow[i] as number) : null
  )

  const validMacd = macdLine.filter(v => v !== null) as number[]
  const emaSignal = ema(validMacd, signalPeriod)
  const firstValidIdx = macdLine.findIndex(v => v !== null)

  const signalLine: (number | null)[] = new Array(data.length).fill(null)
  for (let i = 0; i < emaSignal.length; i++) {
    if (emaSignal[i] !== null) signalLine[firstValidIdx + i] = emaSignal[i]
  }

  const histogram: (number | null)[] = data.map((_, i) =>
    macdLine[i] !== null && signalLine[i] !== null
      ? (macdLine[i] as number) - (signalLine[i] as number)
      : null
  )

  return { macdLine, signalLine, histogram }
}

export interface BBands {
  upper: number | null
  middle: number | null
  lower: number | null
}

export function bollingerBands(data: number[], period = 20, multiplier = 2): BBands[] {
  const middles = sma(data, period)
  return data.map((_, i) => {
    if (middles[i] === null) return { upper: null, middle: null, lower: null }
    const slice = data.slice(i - period + 1, i + 1)
    const mean = middles[i] as number
    const std = Math.sqrt(slice.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / period)
    return { upper: mean + multiplier * std, middle: mean, lower: mean - multiplier * std }
  })
}

export function stochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14,
  smoothK = 3,
  smoothD = 3
): { k: (number | null)[]; d: (number | null)[] } {
  const rawK: (number | null)[] = closes.map((c, i) => {
    if (i < period - 1) return null
    const highSlice = highs.slice(i - period + 1, i + 1)
    const lowSlice  = lows.slice(i - period + 1, i + 1)
    const highest = Math.max(...highSlice)
    const lowest  = Math.min(...lowSlice)
    return highest === lowest ? 50 : ((c - lowest) / (highest - lowest)) * 100
  })

  const kSmoothed  = sma(rawK.filter(v => v !== null) as number[], smoothK)
  const firstValid = rawK.findIndex(v => v !== null)
  const k: (number | null)[] = new Array(closes.length).fill(null)
  for (let i = 0; i < kSmoothed.length; i++) {
    if (kSmoothed[i] !== null) k[firstValid + i] = kSmoothed[i]
  }

  const validK = k.filter(v => v !== null) as number[]
  const dSmoothed = sma(validK, smoothD)
  const firstKValid = k.findIndex(v => v !== null)
  const d: (number | null)[] = new Array(closes.length).fill(null)
  for (let i = 0; i < dSmoothed.length; i++) {
    if (dSmoothed[i] !== null) d[firstKValid + i] = dSmoothed[i]
  }

  return { k, d }
}

export function atr(highs: number[], lows: number[], closes: number[], period = 14): (number | null)[] {
  const tr: number[] = highs.map((h, i) => {
    if (i === 0) return h - lows[i]
    return Math.max(h - lows[i], Math.abs(h - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]))
  })
  return sma(tr, period)
}
