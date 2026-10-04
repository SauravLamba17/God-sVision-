/**
 * Two-account isolation test for every user-owned API route.
 *
 *   npm run build && npm run start      (in another terminal)
 *   npm run test:isolation              (BASE_URL defaults to http://localhost:3001)
 *
 * Registers throwaway accounts A and B, has A create one item of every
 * user-owned resource, then checks B can't see, change or delete any of it,
 * and that every user-owned route answers 401 without a session. Always
 * deletes both accounts and their rows, verifies nothing is left, and exits
 * non-zero on any failure.
 *
 * Runs with Node's built-in type stripping (Node >= 23.6) — erasable TS only.
 * Talks to the real database via Prisma (for setup ids and survival checks),
 * so it refuses to run against anything but a local server.
 */
import crypto from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const BASE = process.env.BASE_URL ?? 'http://localhost:3001'
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error(`Refusing to run against ${BASE} — local servers only.`)
  process.exit(2)
}

const prisma = new PrismaClient()
const RUN = `${Date.now()}`
const EMAIL_A = `gv-iso-a-${RUN}@example.com`
const EMAIL_B = `gv-iso-b-${RUN}@example.com`
const PASSWORD = `Iso-${crypto.randomBytes(9).toString('base64url')}`
const TICKER = 'ISOTST'
const ENDPOINT_A = `https://push.example.invalid/gv-iso-${RUN}-a`
const A_KEYS = { p256dh: `iso-p256dh-${RUN}`, auth: `iso-auth-${RUN}` }

type Row = { check: string; expected: string; actual: string; pass: boolean }
const rows: Row[] = []
const record = (check: string, expected: string, actual: string, pass: boolean) => rows.push({ check, expected, actual, pass })

// ── Minimal cookie-jar client ────────────────────────────────────────────────
class Client {
  jar = new Map<string, string>()
  async req(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers)
    if (this.jar.size) headers.set('cookie', [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '))
    const res = await fetch(BASE + path, { ...init, headers, redirect: 'manual' })
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';')
      const i = pair.indexOf('=')
      const name = pair.slice(0, i)
      const value = pair.slice(i + 1)
      if (value) this.jar.set(name, value); else this.jar.delete(name)
    }
    return res
  }
  json(path: string, method: string, body: unknown) {
    return this.req(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  }
}

async function signUp(email: string): Promise<Client> {
  const c = new Client()
  const reg = await c.json('/api/auth/register', 'POST', { email, password: PASSWORD })
  if (!reg.ok) throw new Error(`register ${email}: ${reg.status} ${await reg.text()}`)
  const { csrfToken } = await (await c.req('/api/auth/csrf')).json()
  await c.req('/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken, email, password: PASSWORD, json: 'true' }),
  })
  const session = await (await c.req('/api/auth/session')).json()
  if (session?.user?.email !== email) throw new Error(`sign-in failed for ${email}`)
  return c
}

async function run() {
  const A = await signUp(EMAIL_A)
  const B = await signUp(EMAIL_B)
  const userA = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL_A } })

  // ── A creates one of everything ───────────────────────────────────────────
  await A.json('/api/watchlist', 'POST', { ticker: TICKER, name: 'Isolation A', note: 'owned-by-A' })
  await A.json('/api/portfolio', 'POST', { ticker: TICKER, name: 'Isolation A', quantity: 1, buyPrice: 1, buyDate: '2026-01-02' })
  await A.json('/api/alerts', 'POST', { type: 'price', ticker: TICKER, condition: 'above', targetPrice: 999999 })
  await A.json('/api/alerts', 'POST', { type: 'news', keyword: `iso-${RUN}` })
  await A.json('/api/transactions', 'POST', { ticker: TICKER, type: 'BUY', quantity: 1, price: 1, date: '2026-01-02', notes: 'owned-by-A' })
  await A.json('/api/push/subscribe', 'POST', { endpoint: ENDPOINT_A, keys: A_KEYS })
  const keyA: string = (await (await A.req('/api/user/gv-key')).json()).key

  const owned = async () => ({
    watch: await prisma.watchlist.findFirst({ where: { userId: userA.id, ticker: TICKER } }),
    holding: await prisma.portfolioHolding.findFirst({ where: { userId: userA.id } }),
    price: await prisma.priceAlert.findFirst({ where: { userId: userA.id } }),
    news: await prisma.newsAlert.findFirst({ where: { userId: userA.id } }),
    tx: await prisma.transaction.findFirst({ where: { userId: userA.id } }),
    push: await prisma.pushSubscription.findUnique({ where: { endpoint: ENDPOINT_A } }),
    keyHash: (await prisma.user.findUnique({ where: { id: userA.id } }))?.sheetsKeyHash ?? null,
  })
  const a = await owned()
  const created = Object.entries(a).filter(([, v]) => !v).map(([k]) => k)
  record('A created every resource', 'all 7 present', created.length ? `missing: ${created.join(', ')}` : 'all 7 present', created.length === 0)
  if (created.length) return
  const keyHashA = a.keyHash

  // ── B reads (list endpoints) ──────────────────────────────────────────────
  const listed = async (path: string) => JSON.stringify(await (await B.req(path)).json())
  const bWatch = await listed('/api/watchlist')
  record('B GET /api/watchlist', 'no A item', bWatch.includes('owned-by-A') ? 'A item visible' : 'no A item', !bWatch.includes('owned-by-A'))
  const bPort = await listed('/api/portfolio')
  record('B GET /api/portfolio', 'no A item', bPort.includes(`"id":${a.holding!.id},`) ? 'A item visible' : 'no A item', !bPort.includes(`"id":${a.holding!.id},`))
  const bAlerts = await listed('/api/alerts')
  const alertLeak = bAlerts.includes(`iso-${RUN}`) || bAlerts.includes(`"id":${a.price!.id},`)
  record('B GET /api/alerts', 'no A item', alertLeak ? 'A item visible' : 'no A item', !alertLeak)
  const bCheck = await listed('/api/alerts?check=prices')
  record('B GET /api/alerts?check=prices', 'no A item', bCheck.includes(TICKER) ? 'A item visible' : 'no A item', !bCheck.includes(TICKER))
  const bCheck2 = await (await B.req('/api/alerts/check')).json()
  record('B GET /api/alerts/check', 'checked 0', `checked ${bCheck2.checked}`, bCheck2.checked === 0)
  const bTx = await listed('/api/transactions')
  record('B GET /api/transactions', 'no A item', bTx.includes('owned-by-A') ? 'A item visible' : 'no A item', !bTx.includes('owned-by-A'))
  const bKey = await (await B.req('/api/user/gv-key')).json()
  record('B GET /api/user/gv-key', "not A's key", bKey.key === keyA ? "A's key returned" : "own key only", bKey.key !== keyA)

  // ── B writes against A's items ────────────────────────────────────────────
  const denied = (s: number) => s === 403 || s === 404
  const attack = async (label: string, res: Response, survived: () => Promise<boolean>) => {
    const ok = await survived()
    record(`B ${label} — A's item survives`, 'survives', ok ? 'survives' : 'CHANGED/DELETED', ok)
    record(`B ${label} — status`, '403/404', String(res.status), denied(res.status))
  }
  await attack(`DELETE /api/portfolio?id=${a.holding!.id}`, await B.req(`/api/portfolio?id=${a.holding!.id}`, { method: 'DELETE' }),
    async () => !!(await prisma.portfolioHolding.findUnique({ where: { id: a.holding!.id } })))
  await attack(`DELETE /api/alerts?id=${a.price!.id}&type=price`, await B.req(`/api/alerts?id=${a.price!.id}&type=price`, { method: 'DELETE' }),
    async () => !!(await prisma.priceAlert.findUnique({ where: { id: a.price!.id } })))
  await attack(`DELETE /api/alerts?id=${a.news!.id}&type=news`, await B.req(`/api/alerts?id=${a.news!.id}&type=news`, { method: 'DELETE' }),
    async () => !!(await prisma.newsAlert.findUnique({ where: { id: a.news!.id } })))
  await attack(`DELETE /api/transactions?id=${a.tx!.id}`, await B.req(`/api/transactions?id=${a.tx!.id}`, { method: 'DELETE' }),
    async () => !!(await prisma.transaction.findUnique({ where: { id: a.tx!.id } })))

  // Watchlist is keyed by (userId, ticker): B's DELETE/POST of the same ticker
  // can only touch B's own row, so there is no 403 to expect — just survival.
  await B.req(`/api/watchlist?ticker=${TICKER}`, { method: 'DELETE' })
  await B.json('/api/watchlist', 'POST', { ticker: TICKER, name: 'hijack', note: 'written-by-B' })
  const w = await prisma.watchlist.findUnique({ where: { id: a.watch!.id } })
  record(`B DELETE+POST /api/watchlist ticker=${TICKER} — A's row unchanged`, 'note owned-by-A', w ? `note ${w.note}` : 'deleted', w?.note === 'owned-by-A' && w.userId === userA.id)

  // Push: B knows A's endpoint but not its keys — must be refused, row untouched.
  const pushOwner = async () => {
    const p = await prisma.pushSubscription.findUnique({ where: { endpoint: ENDPOINT_A } })
    return p?.userId === userA.id ? 'owner A' : p ? 'owner B' : 'deleted'
  }
  const pushRes = await B.json('/api/push/subscribe', 'POST', { endpoint: ENDPOINT_A, keys: { p256dh: 'b', auth: 'b' } })
  const ownerAfter = await pushOwner()
  const keysAfter = (await prisma.pushSubscription.findUnique({ where: { endpoint: ENDPOINT_A } }))?.keys as any
  record("B POST /api/push/subscribe, A's endpoint + wrong keys — status", '409', String(pushRes.status), pushRes.status === 409)
  record("B POST /api/push/subscribe, A's endpoint + wrong keys — row", 'owner A, keys same', `${ownerAfter}, keys ${keysAfter?.p256dh === A_KEYS.p256dh ? 'same' : 'CHANGED'}`, ownerAfter === 'owner A' && keysAfter?.p256dh === A_KEYS.p256dh)

  // Sheets key: B regenerating must not touch A's key.
  await B.req('/api/user/gv-key', { method: 'POST' })
  const hashNow = (await prisma.user.findUnique({ where: { id: userA.id } }))?.sheetsKeyHash
  record("B POST /api/user/gv-key — A's key unchanged", 'unchanged', hashNow === keyHashA ? 'unchanged' : 'CHANGED', hashNow === keyHashA)

  // ── Unauthenticated → 401 on every user-owned route ───────────────────────
  const anon = new Client()
  const unauth: [string, string, unknown?][] = [
    ['GET', '/api/watchlist'], ['POST', '/api/watchlist', { ticker: TICKER }], ['DELETE', `/api/watchlist?ticker=${TICKER}`],
    ['GET', '/api/portfolio'], ['POST', '/api/portfolio', {}], ['DELETE', `/api/portfolio?id=${a.holding!.id}`],
    ['GET', '/api/alerts'], ['GET', '/api/alerts?check=prices'], ['POST', '/api/alerts', {}], ['DELETE', `/api/alerts?id=${a.price!.id}`],
    ['GET', '/api/alerts/check'],
    ['GET', '/api/transactions'], ['POST', '/api/transactions', {}], ['DELETE', `/api/transactions?id=${a.tx!.id}`],
    ['POST', '/api/push/subscribe', { endpoint: ENDPOINT_A, keys: {} }],
    ['GET', '/api/user/gv-key'], ['POST', '/api/user/gv-key'],
    ['POST', '/api/stripe/checkout'], ['POST', '/api/stripe/portal'],
  ]
  for (const [method, path, body] of unauth) {
    const res = body === undefined ? await anon.req(path, { method }) : await anon.json(path, method, body)
    record(`anon ${method} ${path}`, '401', String(res.status), res.status === 401)
  }
  const pub = await anon.req('/api/public/gv?ticker=AAPL&key=gv_not_a_real_key')
  record('anon GET /api/public/gv with bad key', '401', String(pub.status), pub.status === 401)

  // A still sees everything it owns.
  const after = await owned()
  const lost = Object.entries(after).filter(([, v]) => !v).map(([k]) => k)
  record('A still owns all 7 resources', 'all 7 present', lost.length ? `missing: ${lost.join(', ')}` : 'all 7 present', lost.length === 0)

  // Legitimate re-subscribes still work: the owner refreshing its own endpoint,
  // and a shared browser (same endpoint AND keys) moving to whoever signed in.
  const own = await A.json('/api/push/subscribe', 'POST', { endpoint: ENDPOINT_A, keys: A_KEYS })
  record('A re-subscribes own endpoint', '200, owner A', `${own.status}, ${await pushOwner()}`, own.status === 200 && (await pushOwner()) === 'owner A')
  const toB = await B.json('/api/push/subscribe', 'POST', { endpoint: ENDPOINT_A, keys: A_KEYS })
  record('same browser, B signs in (correct keys)', '200, owner B', `${toB.status}, ${await pushOwner()}`, toB.status === 200 && (await pushOwner()) === 'owner B')
  const back = await A.json('/api/push/subscribe', 'POST', { endpoint: ENDPOINT_A, keys: A_KEYS })
  record('same browser, A signs back in (correct keys)', '200, owner A', `${back.status}, ${await pushOwner()}`, back.status === 200 && (await pushOwner()) === 'owner A')
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { in: [EMAIL_A, EMAIL_B] } }, select: { id: true } })
  const ids = users.map(u => u.id)
  await prisma.$transaction([
    prisma.watchlist.deleteMany({ where: { userId: { in: ids } } }),
    prisma.portfolioHolding.deleteMany({ where: { userId: { in: ids } } }),
    prisma.priceAlert.deleteMany({ where: { userId: { in: ids } } }),
    prisma.newsAlert.deleteMany({ where: { userId: { in: ids } } }),
    prisma.transaction.deleteMany({ where: { userId: { in: ids } } }),
    prisma.pushSubscription.deleteMany({ where: { OR: [{ userId: { in: ids } }, { endpoint: ENDPOINT_A }] } }),
    prisma.passwordResetToken.deleteMany({ where: { email: { in: [EMAIL_A, EMAIL_B], mode: 'insensitive' } } }),
    prisma.user.deleteMany({ where: { id: { in: ids } } }),
  ])
  const leftovers =
    (await prisma.user.count({ where: { email: { in: [EMAIL_A, EMAIL_B] } } })) +
    (await prisma.watchlist.count({ where: { OR: [{ userId: { in: ids } }, { note: { in: ['owned-by-A', 'written-by-B'] } }] } })) +
    (await prisma.portfolioHolding.count({ where: { userId: { in: ids } } })) +
    (await prisma.priceAlert.count({ where: { userId: { in: ids } } })) +
    (await prisma.newsAlert.count({ where: { OR: [{ userId: { in: ids } }, { keyword: `iso-${RUN}` }] } })) +
    (await prisma.transaction.count({ where: { OR: [{ userId: { in: ids } }, { notes: 'owned-by-A' }] } })) +
    (await prisma.pushSubscription.count({ where: { OR: [{ userId: { in: ids } }, { endpoint: ENDPOINT_A }] } }))
  record('cleanup — leftover rows', '0', String(leftovers), leftovers === 0)
  return prisma.user.count()
}

let crashed: unknown = null
try { await run() } catch (e) { crashed = e }
let totalUsers = -1
try { totalUsers = await cleanup() } catch (e) { record('cleanup', 'ok', `error: ${(e as Error).message}`, false) }
await prisma.$disconnect()

if (crashed) record('test run', 'no crash', `crashed: ${(crashed as Error).message}`, false)
const w = Math.max(...rows.map(r => r.check.length))
console.log(`\n${'CHECK'.padEnd(w)}  ${'EXPECTED'.padEnd(14)} ${'ACTUAL'.padEnd(22)} RESULT`)
for (const r of rows) console.log(`${r.check.padEnd(w)}  ${r.expected.padEnd(14)} ${r.actual.padEnd(22)} ${r.pass ? 'PASS' : 'FAIL'}`)
const failed = rows.filter(r => !r.pass).length
console.log(`\n${rows.length - failed}/${rows.length} passed · total users now ${totalUsers}`)
process.exit(failed ? 1 : 0)
