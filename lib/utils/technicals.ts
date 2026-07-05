/* eslint-disable @typescript-eslint/no-explicit-any */
// Pure technical-analysis math — no fetching, no side effects.

export interface Candle {
  time: number   // unix seconds
  open: number; high: number; low: number; close: number; volume: number
}

export function last<T>(arr: (T | null | undefined)[]): T | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null && arr[i] !== undefined) return arr[i] as T
  }
  return null
}

// ── Moving averages ─────────────────────────────────────────────────────────
export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  const k = 2 / (period + 1)
  let prev: number | null = null
  for (let i = 0; i < values.length; i++) {
    if (i === period - 1) {
      prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period
      out[i] = prev
    } else if (i >= period) {
      prev = values[i] * k + (prev as number) * (1 - k)
      out[i] = prev
    }
  }
  return out
}

// ── RSI (Wilder's smoothing) ─────────────────────────────────────────────────
export function rsi(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null)
  if (closes.length < period + 1) return out
  let gainSum = 0, lossSum = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff >= 0) gainSum += diff; else lossSum -= diff
  }
  let avgGain = gainSum / period
  let avgLoss = lossSum / period
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return out
}

// ── MACD ──────────────────────────────────────────────────────────────────
export function macd(closes: number[], fast = 12, slow = 26, signalPeriod = 9) {
  const emaFast = ema(closes, fast)
  const emaSlow = ema(closes, slow)
  const macdLine: (number | null)[] = closes.map((_, i) =>
    emaFast[i] !== null && emaSlow[i] !== null ? (emaFast[i] as number) - (emaSlow[i] as number) : null
  )
  const macdValues = macdLine.filter((v): v is number => v !== null)
  const signalRaw = ema(macdValues, signalPeriod)
  const signalLine: (number | null)[] = new Array(closes.length).fill(null)
  let j = 0
  for (let i = 0; i < closes.length; i++) {
    if (macdLine[i] !== null) {
      signalLine[i] = signalRaw[j] ?? null
      j++
    }
  }
  const histogram: (number | null)[] = closes.map((_, i) =>
    macdLine[i] !== null && signalLine[i] !== null ? (macdLine[i] as number) - (signalLine[i] as number) : null
  )
  return { macdLine, signalLine, histogram }
}

// ── Bollinger Bands ───────────────────────────────────────────────────────
export function bollingerBands(closes: number[], period = 20, stdDevMult = 2) {
  const middle = sma(closes, period)
  const upper: (number | null)[] = new Array(closes.length).fill(null)
  const lower: (number | null)[] = new Array(closes.length).fill(null)
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1)
    const mean = middle[i] as number
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period
    const sd = Math.sqrt(variance)
    upper[i] = mean + stdDevMult * sd
    lower[i] = mean - stdDevMult * sd
  }
  return { upper, middle, lower }
}

// ── ATR (Wilder's) ────────────────────────────────────────────────────────
export function atr(candles: Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null)
  if (candles.length < period + 1) return out
  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1]
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)))
  }
  let atrVal = trs.slice(0, period).reduce((a, b) => a + b, 0) / period
  out[period] = atrVal
  for (let i = period + 1; i < candles.length; i++) {
    const tr = trs[i - 1]
    atrVal = (atrVal * (period - 1) + tr) / period
    out[i] = atrVal
  }
  return out
}

// ── Supertrend ────────────────────────────────────────────────────────────
export function supertrend(candles: Candle[], period = 10, multiplier = 3) {
  const atrArr = atr(candles, period)
  const value: (number | null)[] = new Array(candles.length).fill(null)
  const trend: (('UP' | 'DOWN') | null)[] = new Array(candles.length).fill(null)
  let prevUpper: number | null = null
  let prevLower: number | null = null
  let prevTrend: 'UP' | 'DOWN' = 'UP'

  for (let i = 0; i < candles.length; i++) {
    const a = atrArr[i]
    if (a === null) continue
    const hl2 = (candles[i].high + candles[i].low) / 2
    let basicUpper = hl2 + multiplier * a
    let basicLower = hl2 - multiplier * a

    if (prevUpper !== null && (candles[i - 1].close <= prevUpper)) basicUpper = Math.min(basicUpper, prevUpper)
    if (prevLower !== null && (candles[i - 1].close >= prevLower)) basicLower = Math.max(basicLower, prevLower)

    let curTrend: 'UP' | 'DOWN' = prevTrend
    if (candles[i].close > basicUpper) curTrend = 'UP'
    else if (candles[i].close < basicLower) curTrend = 'DOWN'

    value[i] = curTrend === 'UP' ? basicLower : basicUpper
    trend[i] = curTrend

    prevUpper = basicUpper
    prevLower = basicLower
    prevTrend = curTrend
  }
  return { value, trend }
}

// ── VWAP (rolling, last N candles — daily-bar approximation) ───────────────
export function vwap(candles: Candle[]): number | null {
  if (!candles.length) return null
  let pvSum = 0, vSum = 0
  for (const c of candles) {
    const typical = (c.high + c.low + c.close) / 3
    pvSum += typical * c.volume
    vSum += c.volume
  }
  return vSum > 0 ? pvSum / vSum : null
}

// ── OBV (On-Balance Volume) ─────────────────────────────────────────────────
export function obv(candles: Candle[]): number[] {
  const out: number[] = new Array(candles.length).fill(0)
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) out[i] = out[i - 1] + candles[i].volume
    else if (candles[i].close < candles[i - 1].close) out[i] = out[i - 1] - candles[i].volume
    else out[i] = out[i - 1]
  }
  return out
}

// ── Support / Resistance (pivot-based, simple local extrema clustering) ────
export function findSupportResistance(candles: Candle[], lookback = 60): { support: number[]; resistance: number[] } {
  const slice = candles.slice(-lookback)
  const swingHighs: number[] = []
  const swingLows: number[] = []
  for (let i = 2; i < slice.length - 2; i++) {
    const c = slice[i]
    if (c.high > slice[i - 1].high && c.high > slice[i - 2].high && c.high > slice[i + 1].high && c.high > slice[i + 2].high) {
      swingHighs.push(c.high)
    }
    if (c.low < slice[i - 1].low && c.low < slice[i - 2].low && c.low < slice[i + 1].low && c.low < slice[i + 2].low) {
      swingLows.push(c.low)
    }
  }
  const cluster = (vals: number[], tolPct = 0.015): number[] => {
    if (!vals.length) return []
    const sorted = [...vals].sort((a, b) => a - b)
    const groups: number[][] = [[sorted[0]]]
    for (let i = 1; i < sorted.length; i++) {
      const g = groups[groups.length - 1]
      if ((sorted[i] - g[g.length - 1]) / g[g.length - 1] <= tolPct) g.push(sorted[i])
      else groups.push([sorted[i]])
    }
    return groups
      .map(g => g.reduce((a, b) => a + b, 0) / g.length)
      .sort((a, b) => b - a)
  }
  return {
    resistance: cluster(swingHighs).slice(0, 3),
    support: cluster(swingLows).reverse().slice(0, 3),
  }
}

// ── Fibonacci retracement levels ─────────────────────────────────────────────
export function fibonacciLevels(high: number, low: number): Record<string, number> {
  const range = high - low
  return {
    '0.0':   high,
    '23.6':  high - range * 0.236,
    '38.2':  high - range * 0.382,
    '50.0':  high - range * 0.5,
    '61.8':  high - range * 0.618,
    '78.6':  high - range * 0.786,
    '100.0': low,
  }
}

// ── Candlestick pattern detection (last few candles) ────────────────────────
export function detectCandlestickPatterns(candles: Candle[]): string[] {
  const patterns: string[] = []
  const n = candles.length
  if (n < 1) return patterns
  const c0 = candles[n - 1]
  const body0 = Math.abs(c0.close - c0.open)
  const range0 = c0.high - c0.low || 1e-9
  const upperWick0 = c0.high - Math.max(c0.open, c0.close)
  const lowerWick0 = Math.min(c0.open, c0.close) - c0.low

  if (body0 / range0 < 0.1) patterns.push('DOJI')
  if (lowerWick0 > body0 * 2 && upperWick0 < body0) patterns.push(c0.close >= c0.open ? 'HAMMER' : 'HANGING_MAN')
  if (upperWick0 > body0 * 2 && lowerWick0 < body0) patterns.push(c0.close >= c0.open ? 'INVERTED_HAMMER' : 'SHOOTING_STAR')

  if (n >= 2) {
    const c1 = candles[n - 2]
    const bull1 = c1.close > c1.open
    const bull0 = c0.close > c0.open
    if (!bull1 && bull0 && c0.close > c1.open && c0.open < c1.close) patterns.push('BULLISH_ENGULFING')
    if (bull1 && !bull0 && c0.open > c1.close && c0.close < c1.open) patterns.push('BEARISH_ENGULFING')
    if (!bull1 && bull0 && c0.open < c1.close && c0.close > (c1.open + c1.close) / 2) patterns.push('PIERCING_LINE')
    if (bull1 && !bull0 && c0.open > c1.close && c0.close < (c1.open + c1.close) / 2) patterns.push('DARK_CLOUD_COVER')
  }

  if (n >= 3) {
    const c1 = candles[n - 2], c2 = candles[n - 3]
    const bear2 = c2.close < c2.open
    const bull0 = c0.close > c0.open
    const smallMid = Math.abs(c1.close - c1.open) < Math.abs(c2.close - c2.open) * 0.5
    if (bear2 && smallMid && bull0 && c0.close > (c2.open + c2.close) / 2) patterns.push('MORNING_STAR')
    const bull2 = c2.close > c2.open
    const bear0 = c0.close < c0.open
    if (bull2 && smallMid && bear0 && c0.close < (c2.open + c2.close) / 2) patterns.push('EVENING_STAR')

    const sameDir = (c0.close > c0.open) === (c1.close > c1.open) && (c1.close > c1.open) === (c2.close > c2.open)
    if (sameDir && c0.close > c0.open && c0.close > c1.close && c1.close > c2.close) patterns.push('THREE_WHITE_SOLDIERS')
    if (sameDir && c0.close < c0.open && c0.close < c1.close && c1.close < c2.close) patterns.push('THREE_BLACK_CROWS')
  }

  return patterns
}

// ── Volume analysis ──────────────────────────────────────────────────────────
export function volumeAnalysis(candles: Candle[]) {
  const n = candles.length
  const window = candles.slice(-20)
  const avgVolume20 = window.length ? window.reduce((a, c) => a + c.volume, 0) / window.length : 0
  const latestVolume = n ? candles[n - 1].volume : 0
  const volumeRatio = avgVolume20 > 0 ? latestVolume / avgVolume20 : 1
  const obvArr = obv(candles)
  const obvRecent = obvArr.slice(-10)
  const obvTrend: 'UP' | 'DOWN' | 'FLAT' =
    obvRecent.length < 2 ? 'FLAT' :
    obvRecent[obvRecent.length - 1] > obvRecent[0] * 1.01 ? 'UP' :
    obvRecent[obvRecent.length - 1] < obvRecent[0] * 0.99 ? 'DOWN' : 'FLAT'
  return { avgVolume20, latestVolume, volumeRatio, obvTrend }
}
