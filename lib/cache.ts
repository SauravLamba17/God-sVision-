interface CacheEntry {
  data: unknown
  expiresAt: number
  source: 'live' | 'cached'
}

const memoryCache = new Map<string, CacheEntry>()

export function setCache(key: string, data: unknown, ttlSeconds = 60): void {
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
    source: 'live'
  })
}

export function getCache<T>(key: string): { data: T; stale: boolean } | null {
  const entry = memoryCache.get(key)
  if (!entry) return null
  const stale = Date.now() > entry.expiresAt
  return { data: entry.data as T, stale }
}

export function getCacheStatus(key: string): 'live' | 'stale' | 'missing' {
  const entry = memoryCache.get(key)
  if (!entry) return 'missing'
  if (Date.now() > entry.expiresAt) return 'stale'
  return 'live'
}

export function clearCache(key?: string): void {
  if (key) {
    memoryCache.delete(key)
  } else {
    memoryCache.clear()
  }
}

export const CACHE_KEYS = {
  STOCKS: 'stocks',
  CRYPTO: 'crypto',
  CRYPTO_TOP100: 'crypto_top100',
  FOREX: 'forex',
  NEWS: 'news',
  EARTHQUAKES: 'earthquakes',
  FLIGHTS: 'flights',
  WEATHER: (city: string) => `weather_${city}`,
  MACRO: 'macro',
  COMMODITIES: 'commodities',
  SPORTS: 'sports',
  WEBCAMS: 'webcams',
  FEAR_GREED: 'fear_greed',
  DEFI_TVL: 'defi_tvl',
  YIELD_CURVE: 'yield_curve',
} as const

export const CACHE_TTL = {
  CRYPTO: 15,
  STOCKS: 30,
  FOREX: 60,
  NEWS: 300,
  FLIGHTS: 10,
  EARTHQUAKES: 60,
  WEATHER: 600,
  MACRO: 3600,
  COMMODITIES: 300,
  SPORTS: 60,
  WEBCAMS: 1800,
} as const
