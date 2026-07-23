import NodeCache from 'node-cache'

// deleteOnExpire: false — callers rely on reading stale-but-present data as a fallback
const store = new NodeCache({ checkperiod: 0, deleteOnExpire: false, useClones: false })

export function setCache(key: string, data: unknown, ttlSeconds = 60): void {
  store.set(key, data, ttlSeconds)
}

export function getCache<T>(key: string): { data: T; stale: boolean } | null {
  const data = store.get<T>(key)
  if (data === undefined) return null
  const ttl = store.getTtl(key)
  const stale = ttl !== 0 && Date.now() > (ttl as number)
  return { data, stale }
}

export function getCacheStatus(key: string): 'live' | 'stale' | 'missing' {
  if (store.get(key) === undefined) return 'missing'
  const ttl = store.getTtl(key)
  return (ttl === 0 || Date.now() <= (ttl as number)) ? 'live' : 'stale'
}

export function clearCache(key?: string): void {
  if (key) {
    store.del(key)
  } else {
    store.flushAll()
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
