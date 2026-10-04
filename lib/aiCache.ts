import { prisma } from '@/lib/prisma'

// Global cache for Gemini outputs. Postgres (CachedData) rather than lib/cache:
// that one falls back to per-instance memory when Upstash isn't configured,
// so every cold instance would spend free-tier quota again.
export interface AIResult<T> { data: T; generatedAt: number; stale: boolean }

// After a failed generation, don't try again for this long. Without it a
// failing key (quota spent, 503) re-tries on every cache miss and drains the
// daily budget other features need.
const RETRY_BACKOFF_MS = 30 * 60 * 1000
// Keys that failed with nothing cached yet (per instance; the budget cap in
// lib/gemini.ts is the global backstop).
const failedAt = new Map<string, number>()

/**
 * Fresh row → served as-is. Expired/missing → `generate()`; if that fails
 * (quota spent, budget reached, build phase, upstream error) the LAST GOOD
 * output is served with stale: true and its original generatedAt, so the UI
 * can say "Generated at …" instead of going blank. null only when nothing
 * has ever been generated for this key.
 */
export async function cachedAI<T>(key: string, ttlSeconds: number, generate: () => Promise<T>): Promise<AIResult<T> | null> {
  const row = await prisma.cachedData.findUnique({ where: { key } }).catch(() => null)
  // Freshness comes from when the output was generated (updatedAt); expiresAt
  // is "don't regenerate before", which a failure pushes out by the backoff.
  const fromRow = (): AIResult<T> | null => row && {
    data: JSON.parse(row.value) as T,
    generatedAt: row.updatedAt.getTime(),
    stale: Date.now() > row.updatedAt.getTime() + ttlSeconds * 1000,
  }
  if (row && row.expiresAt > new Date()) return fromRow()
  if (!row && Date.now() - (failedAt.get(key) ?? 0) < RETRY_BACKOFF_MS) return null

  try {
    const data = await generate()
    const value = JSON.stringify(data)
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000)
    const saved = await prisma.cachedData.upsert({
      where: { key },
      create: { key, value, expiresAt },
      update: { value, expiresAt },
    })
    failedAt.delete(key)
    return { data, generatedAt: saved.updatedAt.getTime(), stale: false }
  } catch (e) {
    console.error(`[AI cache] ${key}: ${(e as Error).message}`)
    if (row) {
      // Raw SQL so Prisma's @updatedAt (= generatedAt) isn't touched.
      await prisma.$executeRaw`UPDATE "CachedData" SET "expiresAt" = ${new Date(Date.now() + RETRY_BACKOFF_MS)} WHERE "key" = ${key}`.catch(() => {})
    } else {
      failedAt.set(key, Date.now())
    }
    return fromRow()
  }
}
