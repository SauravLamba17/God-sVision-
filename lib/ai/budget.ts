import 'server-only'
import { prisma } from '@/lib/prisma'

// Per-feature daily cap (Pacific day, like the provider's quota reset), in the
// same CachedData counters as the global Gemini budget. Only touched when an
// AI call is about to happen — never on ordinary requests.
export async function reserveFeature(feature: string, limit: number): Promise<boolean> {
  if (limit <= 0) return false
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  const key = `gemini_budget:${day}:feature:${feature}`
  try {
    const rows = await prisma.$queryRaw<{ value: string }[]>`
      INSERT INTO "CachedData" ("key", "value", "updatedAt", "expiresAt")
      VALUES (${key}, '1', now(), now() + interval '2 days')
      ON CONFLICT ("key") DO UPDATE
        SET "value" = (("CachedData"."value")::int + 1)::text, "updatedAt" = now()
      RETURNING "value"`
    return Number(rows[0]?.value) <= limit
  } catch {
    return false // fail closed: an unknown count must not spend quota
  }
}
