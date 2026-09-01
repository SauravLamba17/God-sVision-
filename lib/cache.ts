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

// How long past its TTL an entry stays readable as a stale fallback. Routes like
// /api/flights and /api/webcams want this long: they serve expired-but-present
// data when upstream is rate limited, which is the whole point of this cache.
// Time-sensitive routes (news) pass a short grace so a fetch failure can never
// resurrect day-old content. Past ttl + grace an entry reads as a miss.
const STALE_GRACE_SECONDS = 86_400

interface CacheEnvelope {
  data: unknown
  ttl: number       // seconds the entry counts as fresh
  cachedAt: number  // epoch ms of the write
  grace: number     // extra seconds it stays readable while stale
}

// Both tiers store the same envelope, so freshness is always derived from
// cachedAt rather than from whichever tier answered. Previously the memory tier
// derived staleness from its own NodeCache expiry, which the Redis path reset to
// a full TTL on every warm — making genuinely old data read as fresh.
function readEnvelope<T>(env: CacheEnvelope): { data: T; stale: boolean } | null {
  const ttl = env.ttl ?? 60
  const grace = env.grace ?? STALE_GRACE_SECONDS
  const age = Date.now() - (env.cachedAt ?? 0)
  // NodeCache runs with deleteOnExpire:false and Redis `ex` is only an eviction
  // bound, so nothing else enforces the window — this check is what does.
  if (age > (ttl + grace) * 1000) return null
  return { data: env.data as T, stale: age > ttl * 1000 }
}

export async function setCache(
  key: string,
  data: unknown,
  ttlSeconds = 60,
  staleGraceSeconds = STALE_GRACE_SECONDS,
): Promise<void> {
  const envelope: CacheEnvelope = { data, ttl: ttlSeconds, cachedAt: Date.now(), grace: staleGraceSeconds }
  const hardBound = ttlSeconds + staleGraceSeconds

  memCache.set(key, envelope, hardBound)

  if (redis) {
    try {
      await redis.set(key, JSON.stringify(envelope), { ex: hardBound })
    } catch (e) {
      console.error('[Cache] Redis set failed, memory cache still holds this key:', e)
    }
  }
}

export async function getCache<T>(key: string): Promise<{ data: T; stale: boolean } | null> {
  // Fast path: warm instance already has it.
  const memEnv = memCache.get<CacheEnvelope>(key)
  if (memEnv !== undefined) return readEnvelope<T>(memEnv)

  // Cold start / other instance: fall through to Redis.
  if (redis) {
    try {
      const raw = await redis.get<string>(key)
      if (raw) {
        const parsed: CacheEnvelope = typeof raw === 'string' ? JSON.parse(raw) : (raw as any)
        const result = readEnvelope<T>(parsed)
        // Warm this instance so subsequent calls take the fast path. Store the
        // envelope, not the payload, so age survives the hop.
        if (result) {
          memCache.set(key, parsed, (parsed.ttl ?? 60) + (parsed.grace ?? STALE_GRACE_SECONDS))
        }
        return result
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
