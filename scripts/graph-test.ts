/**
 * Entity Graph checks.   npm run test:graph
 *
 * 1. Data integrity (no server needed).
 * 2. findPath sanity.
 * 3. matchEntitiesInText: false-positive traps + 10 real headlines from the
 *    app's own news feeds (/api/news, /api/india/news) on a LOCAL server,
 *    fetched with a throwaway account that is deleted afterwards.
 *    Start the app first (npm run build && npm run start); BASE_URL defaults to
 *    http://localhost:3001. Without a server, part 3b is reported as skipped.
 */
import fs from 'node:fs'
import crypto from 'node:crypto'
import { allEntities, allLinks, getEntity, findPath, describeLink, matchEntitiesInText, GRAPH_META } from '../lib/graph/index.ts'

type Row = { check: string; pass: boolean; detail: string }
const rows: Row[] = []
const check = (name: string, pass: boolean, detail = '') => rows.push({ check: name, pass, detail })

// ── 1. Integrity ─────────────────────────────────────────────────────────────
const entities = allEntities(), links = allLinks()
const ids = entities.map(e => e.id)
const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i)
check('no duplicate entity ids', dupIds.length === 0, dupIds.join(', '))

const idSet = new Set(ids)
const broken = links.filter(l => !idSet.has(l.from) || !idSet.has(l.to)).map(l => `${l.from} -${l.type}-> ${l.to}`)
check('no broken link targets', broken.length === 0, broken.join('; '))

const keys = links.map(l => `${l.from}|${l.type}|${l.to}`)
const dupLinks = keys.filter((k, i) => keys.indexOf(k) !== i)
check('no duplicate links', dupLinks.length === 0, dupLinks.join('; '))
check('no self-links', links.every(l => l.from !== l.to))
check('every link has a reason', links.every(l => l.reason.trim().length > 5))

const companies = entities.filter(e => e.type === 'company')
const incomplete = companies.filter(c => !c.sector || !c.country || !idSet.has(c.sector) || !idSet.has(c.country)).map(c => c.id)
check('every company has a valid sector and country', incomplete.length === 0, incomplete.join(', '))
check('lastReviewed is a valid date', /^\d{4}-\d{2}-\d{2}$/.test(GRAPH_META.lastReviewed) && !Number.isNaN(Date.parse(GRAPH_META.lastReviewed)), GRAPH_META.lastReviewed)

// The graph's Nifty 50 must match the list the app actually fetches.
const indiaSrc = fs.readFileSync(new URL('../lib/apis/india.ts', import.meta.url), 'utf8')
const appNifty = (indiaSrc.match(/NIFTY50_STOCKS\s*=\s*\[([\s\S]*?)\]/)?.[1].match(/'([^']+)'/g) ?? []).map(s => s.slice(1, -1))
const graphNifty = links.filter(l => l.to === 'index:nifty50').map(l => l.from)
const missing = appNifty.filter(t => !graphNifty.includes(t)), extra = graphNifty.filter(t => !appNifty.includes(t))
check(`Nifty 50 matches lib/apis/india.ts (${appNifty.length} names)`, appNifty.length === 50 && !missing.length && !extra.length,
  [missing.length && `missing ${missing}`, extra.length && `extra ${extra}`].filter(Boolean).join('; '))

// ── 2. Paths ─────────────────────────────────────────────────────────────────
const showPath = (a: string, b: string) => {
  const p = findPath(a, b)
  if (!p) return { p, text: 'no path' }
  let cur = getEntity(a)!.name
  return { p, text: [cur, ...p.map(v => { cur = v.other.name; return `—[${describeLink(v)}]→ ${cur}` })].join(' ') }
}
const tsm = showPath('TSM', 'index:nasdaq')
check('findPath(TSMC, Nasdaq) is a 2-step supply-chain chain',
  !!tsm.p && tsm.p.length === 2 && tsm.p[0].link.type === 'supplier_of' && tsm.p[1].link.type === 'constituent_of', tsm.text)
for (const [a, b] of [['ASML', 'NVDA'], ['RELIANCE.NS', 'country:saudi-arabia'], ['INFY.NS', 'index:sp500'], ['TITAN.NS', 'country:china']] as const) {
  const r = showPath(a, b)
  check(`findPath(${a}, ${b})`, !!r.p, r.text)
}

// ── 3a. Matching traps (expected entities exactly) ───────────────────────────
const traps: [string, string[]][] = [
  ['IT stocks fall as rupee weakens against the dollar', ['sector:information-technology', 'currency:inr', 'currency:usd']],
  ['A rally in Asian markets lifts sentiment', ['region:asia-pacific']],
  ['Indian sprinter wins gold medal at Asian Games', ['country:india']],
  ['Amazon rainforest fires spread across Brazil', ['country:brazil']],
  ['Hong Kong dollar peg holds steady', []],
  ['US ITC rules on Apple Watch import ban', ['country:us', 'AAPL']],
  ['ITC shares rise after Q2 results beat estimates', ['ITC.NS']],
  ['Bank Nifty hits record while Nifty 50 ends flat', ['index:banknifty', 'index:nifty50']],
  ['Tech Mahindra and Mahindra & Mahindra report earnings', ['TECHM.NS', 'M&M.NS']],
  ['Traders pile into $V and $LT ahead of results', ['V', 'LT.NS']],
  ['Visa applications surge for students', []],
  ['Visa shares rise on strong payment volumes', ['V']],
  ['Dow Chemical cuts jobs; Dow closes higher', ['index:dow']],
  ['TSMC raises forecast on Nvidia AI chip demand', ['TSM', 'NVDA']],
  ['Brent crude jumps as OPEC+ extends cuts; Saudi Arabia leads', ['commodity:crude-oil', 'country:saudi-arabia']],
]
for (const [text, want] of traps) {
  const got = matchEntitiesInText(text).map(m => m.entity.id)
  const ok = got.length === want.length && want.every(w => got.includes(w))
  check(`match: "${text}"`, ok, `got [${got.join(', ')}]${ok ? '' : ` want [${want.join(', ')}]`}`)
}

// ── 3b. Ten real headlines from the app's own news feeds ─────────────────────
const BASE = process.env.BASE_URL ?? 'http://localhost:3001'
async function liveHeadlines(): Promise<string[] | string> {
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) return `refusing non-local BASE_URL ${BASE}`
  try { await fetch(BASE + '/auth/signin') } catch { return `no server at ${BASE}` }
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  const email = `gv-graph-test-${Date.now()}@example.com`, password = 'Gt-' + crypto.randomBytes(9).toString('base64url')
  let jar = ''
  const req = async (path: string, init: RequestInit = {}) => {
    const res = await fetch(BASE + path, { ...init, headers: { ...(init.headers as Record<string, string> ?? {}), cookie: jar }, redirect: 'manual' })
    for (const c of res.headers.getSetCookie()) { const kv = c.split(';')[0]; if (kv.split('=')[1]) jar += (jar ? '; ' : '') + kv }
    return res
  }
  try {
    await req('/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
    const { csrfToken } = await (await req('/api/auth/csrf')).json()
    await req('/api/auth/callback/credentials', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrfToken, email, password, json: 'true' }) })
    const us = (await (await req('/api/news')).json()).data ?? []
    const india = (await (await req('/api/india/news')).json()).data?.articles ?? []
    const pick = (items: { title: string; category?: string }[], n: number) =>
      items.filter(i => /business|market|tech|india|economy|all/i.test(i.category ?? 'all')).map(i => i.title).slice(0, n)
    return [...pick(us, 5), ...pick(india, 5)]
  } finally {
    const u = await prisma.user.findUnique({ where: { email } })
    if (u) await prisma.user.delete({ where: { id: u.id } })
    check('live-headline throwaway account deleted', !(await prisma.user.findUnique({ where: { email } })))
    await prisma.$disconnect()
  }
}

const live = await liveHeadlines()
const liveOut: string[] = []
if (typeof live === 'string') {
  check('10 real headlines from the app feed', false, `skipped: ${live}`)
} else {
  check('10 real headlines from the app feed', live.length === 10, `${live.length} fetched`)
  for (const h of live) liveOut.push(`  • ${h}\n      → ${matchEntitiesInText(h).map(m => `${m.entity.name} [${m.entity.id}] "${m.text}"`).join(', ') || '(no entities)'}`)
}

// ── Report ───────────────────────────────────────────────────────────────────
const byType = entities.reduce<Record<string, number>>((a, e) => ({ ...a, [e.type]: (a[e.type] ?? 0) + 1 }), {})
const linkTypes = links.reduce<Record<string, number>>((a, l) => ({ ...a, [l.type]: (a[l.type] ?? 0) + 1 }), {})
console.log(`\nEntity Graph · ${entities.length} entities ${JSON.stringify(byType)}`)
console.log(`               ${links.length} links ${JSON.stringify(linkTypes)} · last reviewed ${GRAPH_META.lastReviewed}\n`)
for (const r of rows) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.check}${r.detail ? `\n        ${r.detail}` : ''}`)
if (liveOut.length) console.log(`\nReal headlines (app news feeds) → matches:\n${liveOut.join('\n')}`)
const failed = rows.filter(r => !r.pass).length
console.log(`\n${rows.length - failed}/${rows.length} checks passed`)
process.exit(failed ? 1 : 0)
