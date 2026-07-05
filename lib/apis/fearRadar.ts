import { getCache, setCache } from '@/lib/cache'
import { getQuotes } from '@/lib/apis/yahoo'

export interface FearSignal {
  name: string
  weight: number
  rawValue: number
  score: number // 0-100 where 100 = extreme fear
  label: string
}

export interface FearRadarData {
  score: number // 0-100 composite
  label: string // EXTREME GREED | GREED | NEUTRAL | FEAR | EXTREME FEAR
  signals: FearSignal[]
  timestamp: number
}

async function fetchVIX(): Promise<number | null> {
  try {
    const quotes = await getQuotes(['^VIX'])
    const vix = quotes[0]?.regularMarketPrice ?? quotes[0]?.price ?? null
    return vix
  } catch { return null }
}

async function fetchBTCFearGreed(): Promise<number | null> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const j = await res.json()
    return parseInt(j?.data?.[0]?.value, 10)
  } catch { return null }
}

async function fetchGoldSPYRatio(): Promise<number | null> {
  try {
    const quotes = await getQuotes(['GLD', 'SPY'])
    const gld = quotes.find(q => q.symbol === 'GLD')?.regularMarketPrice ?? quotes.find(q => q.symbol === 'GLD')?.price
    const spy = quotes.find(q => q.symbol === 'SPY')?.regularMarketPrice ?? quotes.find(q => q.symbol === 'SPY')?.price
    if (!gld || !spy) return null
    return gld / spy
  } catch { return null }
}

async function fetchYieldSpread(): Promise<number | null> {
  try {
    const quotes = await getQuotes(['^IRX', '^TNX']) // 3-month, 10-year
    const irx = (quotes.find(q => q.symbol === '^IRX')?.regularMarketPrice ?? quotes.find(q => q.symbol === '^IRX')?.price)
    const tnx = (quotes.find(q => q.symbol === '^TNX')?.regularMarketPrice ?? quotes.find(q => q.symbol === '^TNX')?.price)
    if (!tnx || !irx) return null
    return tnx - irx // positive = normal, negative = inverted
  } catch { return null }
}

async function fetchDXY(): Promise<number | null> {
  try {
    const quotes = await getQuotes(['DX-Y.NYB'])
    return quotes[0]?.regularMarketPrice ?? quotes[0]?.price ?? null
  } catch { return null }
}

function scoreVIX(vix: number | null): number {
  if (!vix) return 50
  // VIX 10 = 0 fear, VIX 20 = 50, VIX 30 = 75, VIX 40+ = 100
  if (vix <= 10) return 0
  if (vix >= 40) return 100
  return Math.round((vix - 10) / 30 * 100)
}

function scoreBTCFG(fng: number | null): number {
  if (!fng) return 50
  // BTC F&G is 0=extreme fear, 100=extreme greed — invert for composite
  return 100 - fng
}

function scoreGoldSPY(ratio: number | null): number {
  if (!ratio) return 50
  // Gold/SPY typically 0.15-0.30. Higher ratio = more fear (flight to gold)
  // ~0.15 = low fear, ~0.30 = high fear
  const norm = (ratio - 0.15) / 0.15
  return Math.max(0, Math.min(100, Math.round(norm * 100)))
}

function scoreYieldSpread(spread: number | null): number {
  if (spread === null) return 50
  // Inverted curve = fear. Spread 1.0+ = 0 fear, spread -1.0 = 100 fear
  if (spread >= 1.0) return 0
  if (spread <= -1.0) return 100
  return Math.round((1 - spread) / 2 * 100)
}

function scoreDXY(dxy: number | null): number {
  if (!dxy) return 50
  // DXY high = dollar strength = mild risk-off signal
  // DXY ~95 = 0 fear, ~110 = 100 fear
  if (dxy <= 95) return 0
  if (dxy >= 115) return 100
  return Math.round((dxy - 95) / 20 * 100)
}

function getLabel(score: number): string {
  if (score <= 20) return 'EXTREME GREED'
  if (score <= 40) return 'GREED'
  if (score <= 60) return 'NEUTRAL'
  if (score <= 80) return 'FEAR'
  return 'EXTREME FEAR'
}

export async function getFearRadarData(): Promise<FearRadarData> {
  const cacheKey = 'fear_radar'
  const cached = getCache(cacheKey)
  if (cached && !cached.stale) return cached.data as FearRadarData

  const [vix, btcFG, goldSPY, yieldSpread, dxy] = await Promise.allSettled([
    fetchVIX(), fetchBTCFearGreed(), fetchGoldSPYRatio(), fetchYieldSpread(), fetchDXY(),
  ])

  const v = vix.status === 'fulfilled' ? vix.value : null
  const b = btcFG.status === 'fulfilled' ? btcFG.value : null
  const g = goldSPY.status === 'fulfilled' ? goldSPY.value : null
  const y = yieldSpread.status === 'fulfilled' ? yieldSpread.value : null
  const d = dxy.status === 'fulfilled' ? dxy.value : null

  const signals: FearSignal[] = [
    { name: 'VIX', weight: 0.25, rawValue: v ?? 0, score: scoreVIX(v), label: v ? `${v.toFixed(1)}` : 'N/A' },
    { name: 'BTC Fear/Greed (inv)', weight: 0.20, rawValue: b ?? 0, score: scoreBTCFG(b), label: b ? `${b}/100` : 'N/A' },
    { name: 'Gold/SPY Ratio', weight: 0.20, rawValue: g ?? 0, score: scoreGoldSPY(g), label: g ? g.toFixed(3) : 'N/A' },
    { name: '2Y-10Y Spread', weight: 0.20, rawValue: y ?? 0, score: scoreYieldSpread(y), label: y !== null ? `${y >= 0 ? '+' : ''}${y.toFixed(2)}%` : 'N/A' },
    { name: 'USD Strength (DXY)', weight: 0.15, rawValue: d ?? 0, score: scoreDXY(d), label: d ? d.toFixed(1) : 'N/A' },
  ]

  const composite = Math.round(signals.reduce((sum, s) => sum + s.score * s.weight, 0))

  const data: FearRadarData = {
    score: composite,
    label: getLabel(composite),
    signals,
    timestamp: Date.now(),
  }

  setCache(cacheKey, data, 300) // 5-min cache
  return data
}
