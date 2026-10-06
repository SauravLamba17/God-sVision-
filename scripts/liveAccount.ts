/**
 * Shared throwaway account for the live checks (test:evidence, test:brain).
 * One account is reused across runs — sign-up is rate limited to 10/hour per IP —
 * with its credentials in the OS temp dir. `--cleanup` deletes the account and
 * the file at the end of a run. Local servers only.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const BASE = process.env.BASE_URL ?? 'http://localhost:3001'
export const CLEANUP = process.argv.includes('--cleanup')
const ACCOUNT_FILE = path.join(os.tmpdir(), 'gv-evidence-test-account.json')

export type Req = (p: string, init?: RequestInit) => Promise<Response>

const saved = (): { email: string; password: string } | null => {
  try { return JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8')) } catch { return null }
}

async function prisma() {
  const { PrismaClient } = await import('@prisma/client')
  return new PrismaClient()
}

/** A signed-in request function, or the reason the live check can't run. */
export async function signIn(): Promise<{ req: Req } | string> {
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) return `refusing non-local BASE_URL ${BASE}`
  try { await fetch(BASE + '/auth/signin') } catch { return `no server at ${BASE}` }
  let jar = ''
  const req: Req = async (p, init = {}) => {
    const res = await fetch(BASE + p, { ...init, headers: { ...(init.headers as Record<string, string> ?? {}), cookie: jar }, redirect: 'manual' })
    for (const c of res.headers.getSetCookie()) { const kv = c.split(';')[0]; if (kv.split('=')[1]) jar += (jar ? '; ' : '') + kv }
    return res
  }
  const db = await prisma()
  try {
    let acct = saved()
    if (!acct || !(await db.user.findUnique({ where: { email: acct.email } }))) {
      acct = { email: `gv-evidence-test-${Date.now()}@example.com`, password: 'Ev-' + crypto.randomBytes(9).toString('base64url') }
      await req('/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(acct) })
      fs.writeFileSync(ACCOUNT_FILE, JSON.stringify(acct), { mode: 0o600 })
    }
    const { csrfToken } = await (await req('/api/auth/csrf')).json()
    await req('/api/auth/callback/credentials', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrfToken, ...acct, json: 'true' }) })
    const session = await (await req('/api/auth/session')).json().catch(() => null)
    return session?.user ? { req } : 'sign-in failed (rate limited?)'
  } finally {
    await db.$disconnect()
  }
}

/** Deletes the saved account (if any). true = deleted and verified gone; null = nothing saved. */
export async function cleanupAccount(): Promise<boolean | null> {
  const acct = saved()
  if (!acct) return null
  const db = await prisma()
  try {
    const u = await db.user.findUnique({ where: { email: acct.email } })
    if (u) await db.user.delete({ where: { id: u.id } })
    fs.rmSync(ACCOUNT_FILE, { force: true })
    return !(await db.user.findUnique({ where: { email: acct.email } }))
  } finally {
    await db.$disconnect()
  }
}
