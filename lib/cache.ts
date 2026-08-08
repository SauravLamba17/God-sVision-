import { Redis } from '@upstash/redis'
import NodeCache from 'node-cache'

const redisUrl = process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

const redis = (redisUrl && redisToken && !redisUrl.startsWith('paste_from'))
  ? new Redis({ url: redisUrl, token: redisToken })
  : null

// In-memory tier. deleteOnExpire: false — callers rely on reading
// stale-but-present data as a fallback when an upstream is rate limited.
const memCache = new NodeCache({ checkperiod: 0, deleteOnExpire: false, useClones: false })

const REDIS_AVAILABLE = redis !== null

if (!REDIS_AVAILABLE) {
  console.warn('[Cache] UPSTASH_REDIS_REST_URL/TOKEN not set — using in-memory cache only. Set these in production to survive cold starts.')
}

// Redis must outlive the logical TTL, or the stale-fallback path dies with it:
// routes like /api/flights and /api/webcams serve expired-but-present data when
// upstream is rate limited, which is the whole point of this cache. Staleness is
// computed from cachedAt, so `ex` is only the hard eviction bound.
const STALE_GRACE_SECONDS = 86_400

export async function setCache(key: string, data: unknown, ttlSeconds = 60): Promise<void> {
  memCache.set(key, data, ttlSeconds)

  if (redis) {
    try {
      await redis.set(key, JSON.stringify({ data, ttl: ttlSeconds, cachedAt: Date.now() }), {
        ex: ttlSeconds + STALE_GRACE_SECONDS,
      })
    } catch (e) {
      console.error('[Cache] Redis set failed, memory cache still holds this key:', e)
    }
  }
}

export async function getCache<T>(key: string): Promise<{ data: T; stale: boolean } | null> {
  // Fast path: warm instance already has it.
  const memData = memCache.get<T>(key)
  if (memData !== undefined) {
    const ttl = memCache.getTtl(key)
    const stale = ttl !== 0 && Date.now() > (ttl as number)
    return { data: memData, stale }
  }

  // Cold start / other instance: fall through to Redis.
  if (redis) {
    try {
      const raw = await redis.get<string>(key)
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw as any)
        const ttl = parsed.ttl ?? 60
        const stale = Date.now() - (parsed.cachedAt ?? 0) > ttl * 1000
        // Warm this instance so subsequent calls take the fast path.
        memCache.set(key, parsed.data, ttl)
        return { data: parsed.data as T, stale }
      }
    } catch (e) {
      console.error('[Cache] Redis get failed, treating as cache miss:', e)
    }
  }

  return null
}

export function isRedisAvailable(): boolean {
  return REDIS_AVAILABLE
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
