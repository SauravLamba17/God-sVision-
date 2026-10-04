import 'server-only'
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { takeSummaryIfDue, SUMMARY_TTL_MS } from '@/lib/feedHealth'

// Fixed-window rate limits stored as counters in Postgres (CachedData), so
// every serverless instance shares them. Used ONLY on low-volume write/auth/AI
// routes — never on read paths or the ISR data routes.
//
// Cost: one INSERT … ON CONFLICT round trip per limited request (all counters
// for that request in one statement). ~2% of those statements also delete
// expired counter rows in the same statement — no cron, no extra request.

export interface Limit {
  bucket: string      // e.g. 'register-ip'
  id: string          // raw identifier — hashed before storage, never stored as-is
  max: number
  windowSec: number
  /** Align the window to the Pacific-time day (Gemini's quota reset) instead of epoch windows. */
  ptDay?: boolean
}

export type LimitResult = { ok: true } | { ok: false; retryAfter: number; bucket: string }

const CLEANUP_PROBABILITY = 0.02
const hashId = (id: string) => crypto.createHash('sha256').update(id).digest('hex').slice(0, 24)

function windowOf(l: Limit, now: number): { key: string; expires: Date } {
  if (l.ptDay) {
    const day = new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
    // Expire comfortably after the PT day ends; the key carries the day.
    return { key: `rl:${l.bucket}:${hashId(l.id)}:${day}`, expires: new Date(now + 2 * 86400_000) }
  }
  const start = Math.floor(now / 1000 / l.windowSec) * l.windowSec
  return { key: `rl:${l.bucket}:${hashId(l.id)}:${start}`, expires: new Date((start + l.windowSec) * 1000) }
}

function secondsUntilPtMidnight(now: number): number {
  const pt = new Date(new Date(now).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const midnight = new Date(pt); midnight.setHours(24, 0, 0, 0)
  return Math.max(1, Math.ceil((midnight.getTime() - pt.getTime()) / 1000))
}

/**
 * Counts this request against every limit (atomically) and reports the first
 * one exceeded. Fails OPEN on a database error: a Neon blip must not lock
 * users out of sign-in; the routes still have their other protections.
 */
export async function checkLimits(limits: Limit[]): Promise<LimitResult> {
  if (limits.length === 0) return { ok: true }
  const now = Date.now()
  const windows = limits.map(l => ({ l, ...windowOf(l, now) }))
  const cleanup = Math.random() < CLEANUP_PROBABILITY
  // Feed-health summary for /admin/health, at most every 5 min per instance,
  // in this same statement (no extra round trip).
  const summary = takeSummaryIfDue()
  const healthCte = summary
    ? Prisma.sql`, health AS (
        INSERT INTO "CachedData" ("key", "value", "updatedAt", "expiresAt")
        VALUES (${summary.key}, ${summary.value}, now(), ${new Date(now + SUMMARY_TTL_MS)})
        ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now(), "expiresAt" = EXCLUDED."expiresAt"
      )`
    : Prisma.empty
  try {
    const values = Prisma.join(windows.map(w => Prisma.sql`(${w.key}, '1', now(), ${w.expires})`))
    const rows = await prisma.$queryRaw<{ key: string; value: string }[]>`
      WITH cleanup AS (
        DELETE FROM "CachedData"
        WHERE ${cleanup} AND ("key" LIKE 'rl:%' OR "key" LIKE 'health:%') AND "expiresAt" < now()
      )${healthCte}
      INSERT INTO "CachedData" ("key", "value", "updatedAt", "expiresAt")
      VALUES ${values}
      ON CONFLICT ("key") DO UPDATE
        SET "value" = (("CachedData"."value")::int + 1)::text, "updatedAt" = now()
      RETURNING "key", "value"`
    const counts = new Map(rows.map(r => [r.key, Number(r.value)]))
    for (const w of windows) {
      if ((counts.get(w.key) ?? 0) > w.l.max) {
        const retryAfter = w.l.ptDay ? secondsUntilPtMidnight(now) : Math.max(1, Math.ceil((w.expires.getTime() - now) / 1000))
        return { ok: false, retryAfter, bucket: w.l.bucket }
      }
    }
    return { ok: true }
  } catch (e) {
    console.error('[rateLimit] counter write failed — allowing request:', (e as Error).message)
    return { ok: true }
  }
}

/** 429 with Retry-After and a human-readable wait. */
export function tooManyRequests(retryAfter: number, what = 'requests', headers?: Record<string, string>) {
  const wait = retryAfter >= 3600 ? `${Math.ceil(retryAfter / 3600)} hour(s)` : retryAfter >= 60 ? `${Math.ceil(retryAfter / 60)} minute(s)` : `${retryAfter} second(s)`
  return NextResponse.json(
    { error: `Too many ${what}. Try again in ${wait}.`, retryAfterSeconds: retryAfter },
    { status: 429, headers: { ...headers, 'Retry-After': String(retryAfter) } },
  )
}

/**
 * Signed-in user id for limiting, read from the session JWT (cookie decode +
 * signature check, no DB query). Falls back to the client IP.
 */
export async function limiterId(req: NextRequest): Promise<string> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET }).catch(() => null)
  const id = (token?.id as string | undefined) ?? token?.sub
  return id ? `user:${id}` : `ip:${clientIp(req)}`
}

/** Client IP as set by Vercel's edge (x-forwarded-for is overwritten there, not client-controlled). */
export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown'
}

// ── The limits, in one place ────────────────────────────────────────────────
const HOUR = 3600
export const LIMITS = {
  signInIp:    (ip: string): Limit    => ({ bucket: 'signin-ip', id: ip, max: 20, windowSec: 15 * 60 }),
  signInEmail: (email: string): Limit => ({ bucket: 'signin-email', id: email.toLowerCase(), max: 10, windowSec: 15 * 60 }),
  registerIp:  (ip: string): Limit    => ({ bucket: 'register-ip', id: ip, max: 10, windowSec: HOUR }),
  forgotIp:    (ip: string): Limit    => ({ bucket: 'forgot-ip', id: ip, max: 10, windowSec: HOUR }),
  /** Per-user share of the 8/day on-demand Gemini budget — counted per actual Gemini call. */
  aiUser:      (userId: string): Limit => ({ bucket: 'ai-user', id: userId, max: 4, windowSec: 86400, ptDay: true }),
  sheetsIp:    (ip: string): Limit    => ({ bucket: 'sheets-ip', id: ip, max: 5000, windowSec: HOUR }),
  sheetsKey:   (key: string): Limit   => ({ bucket: 'sheets-key', id: key, max: 2000, windowSec: HOUR }),
  backtest:    (userId: string): Limit => ({ bucket: 'backtest', id: userId, max: 30, windowSec: HOUR }),
  writes:      (userId: string): Limit => ({ bucket: 'writes', id: userId, max: 120, windowSec: HOUR }),
}
