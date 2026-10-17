import 'server-only'
// Research Agent — fact gathering. Reads the app's existing engines and caches:
//   WHY_MOVE today    Why Engine (explainSymbols: the evidence context's ≤60 s caches + per-ticker news, 10 min)
//   WHY_MOVE window   daily closes per symbol (Yahoo v8 chart through Next's shared fetch Data Cache,
//                     revalidate 15 min, one call per symbol, 4 s timeout) + per-ticker news for the window
//   sector window     the sector fund/index + up to 8 graph constituents, same daily closes
//   WHAT_IF           Scenario Engine (bundled sensitivity data, memoised; no upstream call)
//   CONNECTIONS       Entity Graph (code-only)
//   MARKET_TODAY      Market Brain (shared per market, 15–60 min)
//   NEWS              evidence context headlines + per-ticker news (cached 10 min)
//   PORTFOLIO         the signed-in user's holdings + the shared spark price lookup — private, never cached here
// No AI here. Every fact carries its source, time and data status. Loads run in parallel under one
// time budget: whatever isn't ready in time is skipped and said so (it keeps loading into the caches).
import type { EntityRef, FactSheet, Market, Parsed } from './types'
import {
  quotable, reliableLink, constituentFacts, brainFacts, defaultShock, fmtDay, groupFacts, headlineFacts, linkSentence, marketDate, neighbourFacts, newSheet, overallStatus, p1,
  parseChart, pathFacts, patternFacts, scenarioFacts, whyTodayFacts, windowFacts, windowHeadlines, type Closes, type Compare, type Session, type Sheet,
} from './build'
import { inGraph } from './parse'
import { context, explainSymbols } from '@/lib/evidence'
import { headlinesFrom } from '@/lib/evidence/context'
import { isMarketNews, mentionsTarget, sameStory } from '@/lib/evidence/engine'
import type { Headline } from '@/lib/evidence/types'
import { getTickerNewsCached } from '@/lib/apis/tickerNews'
import { getBrain } from '@/lib/brain'
import { allEntities, getEntity, getLinks } from '@/lib/graph'
import { SENSITIVITIES, scenarioCached } from '@/lib/scenario/data'
import { portfolioImpact, resolveHolding, validateShock, type ScenarioInput } from '@/lib/scenario/engine'
import { MARKET_CONTROL, SECTOR_FUNDS, type FactorId } from '@/lib/scenario/factors'
import { PRESETS, presetFactor, type PresetId } from '@/lib/scenario/presets'
import { sharedQuotes } from '@/lib/scenario/prices'
import { signed } from '@/lib/format'
import { getMarketStatus } from '@/lib/utils'
import { getIndianMarketStatus } from '@/lib/apis/india'
import { recordFeed } from '@/lib/feedHealth'
import { prisma } from '@/lib/prisma'

const status = (m: Market) => (m === 'US' ? getMarketStatus() : getIndianMarketStatus())
const session = (m: Market): Session => { const now = Date.now(); return { status: status(m), now, today: marketDate(now, m) } }

// ── Time budget ──────────────────────────────────────────────────────────────
/** Answers return within 8 s: gathering gets 7.5 s, composing the answer is milliseconds. */
export const BUDGET_MS = 7500
export const STILL_LOADING = 'Some data was still loading — try again in a minute.'
interface Budget { within<T>(p: Promise<T>): Promise<T | undefined>; late: boolean }
function budget(ms: number): Budget {
  const end = Date.now() + ms
  const b: Budget = {
    late: false,
    async within<T>(p: Promise<T>) {
      const left = end - Date.now()
      const safe = p.catch(() => undefined) // a failed loader is "unavailable", reported where it is used
      if (left <= 0) { b.late = true; return undefined }
      let timer: ReturnType<typeof setTimeout> | undefined
      const out = await Promise.race([safe, new Promise<undefined>(res => { timer = setTimeout(() => { b.late = true; res(undefined) }, left) })])
      clearTimeout(timer)
      return out
    },
  }
  return b
}

// ── Daily closes: one shared, cached request per symbol ──────────────────────
const CLOSES_TTL = 900
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', Accept: 'application/json' }
/** Three months of daily closes. The URL (= shared Data Cache key) holds only the symbol. Never throws. */
async function dailyCloses(symbol: string): Promise<Closes | null> {
  const t0 = performance.now()
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d`,
      { next: { revalidate: CLOSES_TTL }, signal: AbortSignal.timeout(4000), headers: UA })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const c = parseChart(symbol, await res.json())
    recordFeed('Yahoo chart (research closes)', !!c, performance.now() - t0, c ? undefined : 'no data', res.status, c?.dates.length)
    return c
  } catch (e) {
    recordFeed('Yahoo chart (research closes)', false, performance.now() - t0, (e as Error).message)
    return null
  }
}

// Instruments a company's exposure links point at, per market.
const EXPOSURE_SYMBOL: Record<string, Record<Market, { symbol: string; name: string; usHours: boolean }>> = {
  'commodity:crude-oil': { US: { symbol: 'CL=F', name: 'WTI crude', usHours: true }, IN: { symbol: 'BZ=F', name: 'Brent crude', usHours: true } },
  'commodity:gold': { US: { symbol: 'GC=F', name: 'Gold', usHours: true }, IN: { symbol: 'GC=F', name: 'Gold', usHours: true } },
  'commodity:natural-gas': { US: { symbol: 'NG=F', name: 'Natural gas', usHours: true }, IN: { symbol: 'NG=F', name: 'Natural gas', usHours: true } },
  'commodity:copper': { US: { symbol: 'HG=F', name: 'Copper', usHours: true }, IN: { symbol: 'HG=F', name: 'Copper', usHours: true } },
  'currency:usd': { US: { symbol: 'DX-Y.NYB', name: 'US dollar index', usHours: true }, IN: { symbol: 'USDINR=X', name: 'USD/INR', usHours: false } },
  'currency:inr': { US: { symbol: 'USDINR=X', name: 'USD/INR', usHours: false }, IN: { symbol: 'USDINR=X', name: 'USD/INR', usHours: false } },
}
const NEWS_DAYS = { yesterday: 4, week: 10, month: 33, today: 2 } as const

/** Graph headlines plus one per-ticker search (sources tagged for the publisher-name cleanup). */
function withTicker(ctxHeadlines: Headline[], extra: { title: string; url: string; source: string; publishedAt: string }[]): Headline[] {
  const seen = new Set(ctxHeadlines.map(h => h.title.trim().toLowerCase()))
  return [...ctxHeadlines, ...headlinesFrom(extra.map(i => ({ ...i, source: `${i.source} (Google News)` })), 100_000, seen)]
}

async function whyWindow(s: Sheet, t: EntityRef, p: Parsed, ses: Session, b: Budget): Promise<Set<string>> {
  const m = p.market, ent = getEntity(t.id)
  const plan: (Omit<Compare, 'closes'> & { symbol: string; entity?: string })[] = [{ kind: 'index', symbol: MARKET_CONTROL[m].symbol, name: MARKET_CONTROL[m].name, usHours: m === 'US' }]
  const fund = SECTOR_FUNDS.find(f => f.market === m && f.sector && f.sector === ent?.sector)
  if (fund) plan.push({ kind: 'sector', symbol: fund.symbol, name: `${fund.name}${fund.name.includes(fund.symbol) ? '' : ` (${fund.symbol})`}`, usHours: m === 'US' })
  const links = getLinks(t.id)
  for (const v of links.filter(v => ['competitor_of', 'supplier_of', 'subsidiary_of'].includes(v.link.type) && v.other.type === 'company' && v.other.id.endsWith('.NS') === (m === 'IN')).slice(0, 2))
    plan.push({ kind: 'peer', symbol: v.other.id, name: v.other.name, usHours: m === 'US', why: `${linkSentence(t.name, v)}: ${v.link.reason}`, entity: v.other.id })
  for (const v of links.filter(v => v.direction === 'out' && v.link.type === 'exposed_to' && EXPOSURE_SYMBOL[v.other.id]).slice(0, 2)) {
    const x = EXPOSURE_SYMBOL[v.other.id][m]
    if (!plan.some(q => q.symbol === x.symbol)) plan.push({ kind: 'exposure', symbol: x.symbol, name: x.name, usHours: x.usHours, why: v.link.reason, entity: v.other.id, reliable: reliableLink(SENSITIVITIES, t.id, v.other.id, m) })
  }
  // Prices, the market's headlines and the window's per-ticker search, all at once.
  const key = p.window.key === 'today' ? 'yesterday' : p.window.key
  const [all, ctx, extra] = await Promise.all([
    b.within(Promise.all([dailyCloses(t.id), ...plan.map(q => dailyCloses(q.symbol))])),
    b.within(context(m)),
    b.within(getTickerNewsCached(t.id, t.name, m, { start: ses.now - NEWS_DAYS[key] * 86400_000, end: ses.now }).then(r => r.data)),
  ])
  const covered = new Set(plan.flatMap(q => (q.entity ? [q.entity] : [])))
  const [stock, ...rest] = all ?? []
  if (!stock) { if (all) s.cant(`Daily prices for ${t.name} are unavailable right now.`, 'Yahoo Finance'); return covered }
  const others: Compare[] = plan.flatMap((q, i) => (rest[i] ? [{ ...q, closes: rest[i]! }] : []))
  for (const [i, q] of plan.entries()) if (!rest[i]) s.cant(`Daily prices for ${q.name} are unavailable right now, so it is left out.`, 'Yahoo Finance')
  const w = windowFacts(s, t, m, key, stock, others, ses)
  if (!w) return covered
  const picked = windowHeadlines(withTicker(ctx?.headlines ?? [], extra ?? []), t, stock, w, m)
  headlineFacts(s, picked, t, m, `No headline naming ${t.name} in this window passed the news filters (company context, no listicles, opinion, recaps, how-to pages or advice).`)
  return covered
}

/** "How are Indian IT stocks doing this week": the sector fund/index against the market, plus its strongest and weakest constituents. */
async function sectorWindow(s: Sheet, sector: EntityRef, p: Parsed, ses: Session, b: Budget): Promise<void> {
  const m = p.market, who = m === 'US' ? 'US' : 'Indian'
  const fund = SECTOR_FUNDS.find(f => f.market === m && f.sector === sector.id)
  if (!fund) { s.key.noIndex = s.cant(`There is no ${who} ${sector.name} sector index with price history here, so this window can't be measured for the sector.`, 'GOD’s Vision'); return }
  const target: EntityRef = { id: fund.symbol, name: fund.symbol.startsWith('^') ? fund.name : `US ${fund.name} (${fund.symbol})`, type: 'sector' }
  const members = allEntities().filter(e => e.type === 'company' && e.sector === sector.id && e.id.endsWith('.NS') === (m === 'IN')).slice(0, 8)
  const all = await b.within(Promise.all([dailyCloses(fund.symbol), dailyCloses(MARKET_CONTROL[m].symbol), ...members.map(e => dailyCloses(e.id))]))
  if (!all) return
  const [fc, ic, ...mc] = all
  if (!fc) { s.cant(`Daily prices for ${target.name} are unavailable right now.`, 'Yahoo Finance'); return }
  const key = p.window.key === 'today' ? 'yesterday' : p.window.key
  const w = windowFacts(s, target, m, key, fc, ic ? [{ kind: 'index', name: MARKET_CONTROL[m].name, closes: ic, usHours: m === 'US' }] : [], ses)
  if (w) constituentFacts(s, target.name, members.flatMap((e, i) => (mc[i] ? [{ name: e.name, closes: mc[i]! }] : [])), w)
}

async function whyToday(s: Sheet, t: EntityRef, p: Parsed, ses: Session, b: Budget): Promise<void> {
  const e = (await b.within(explainSymbols(p.market, [t.id])))?.[t.id]
  if (!e) { if (!b.late) s.cant(`No current quote for ${t.name} is available right now.`, 'Yahoo Finance'); return }
  whyTodayFacts(s, { ...e, name: t.name }, ses, SENSITIVITIES)
  const ctx = await b.within(context(p.market)) // memo hit: explainSymbols just built it
  const missing = Object.entries(ctx?.inputs ?? {}).filter(([, v]) => v !== 'ok').map(([k, v]) => `${k} (${v})`)
  if (missing.length) s.cant(`Some inputs were not fully available: ${missing.join(', ')}.`, 'Evidence Engine')
}

const run = (m: Market) => (factor: FactorId, shock: number) => scenarioCached({ market: m, factor, shock })

/** The Scenario Engine input for a parsed what-if: the matching preset when no size was given, else a custom shock. */
export function scenarioInput(p: Parsed): ScenarioInput | string {
  const sh = p.shock!, m = p.market
  if ('preset' in sh) return { market: m, preset: sh.preset }
  const preset = PRESETS.find(x => x.kind === 'factor' && presetFactor(x, m) === sh.factor && (x.side === 'up') === (sh.direction > 0) && x.markets.includes(m))
  if (preset && sh.size == null) return { market: m, preset: preset.id as PresetId }
  const shock = sh.size != null ? sh.size * sh.direction : defaultShock(sh.factor, sh.direction, m, SENSITIVITIES)
  return validateShock(m, sh.factor, shock) ?? { market: m, factor: sh.factor, shock }
}
// "Rates", "the Fed", "rate cut/hike" are read as the US 10-year yield — said so, with the size used.
const POLICY = /\b(fed|federal reserve|fomc|interest rates?|rates?|rate (cut|hike)s?)\b/i
const YIELD_WORDS = /\b(yields?|treasur(y|ies)|10[- ]?y(ea)?r|bonds?)\b/i
function ratesNote(p: Parsed, shockBp: number | undefined): void {
  if (shockBp == null || !p.shock || 'preset' in p.shock || p.shock.factor !== 'us10y' || !POLICY.test(p.question) || YIELD_WORDS.test(p.question)) return
  p.notes.push(`Interpreting as the US 10-year yield moving ${signed(shockBp, 0, '−')}bp; the Fed's policy rate isn't modelled directly.`)
}

async function news(s: Sheet, t: EntityRef, p: Parsed, ses: Session, b: Budget): Promise<void> {
  const days = p.window.key === 'month' ? 31 : p.window.key === 'week' ? 7 : 2
  const start = ses.now - days * 86400_000
  const [ctx, extra] = await Promise.all([b.within(context(p.market)), b.within(getTickerNewsCached(t.id, t.name, p.market, { start, end: ses.now }).then(r => r.data))])
  const hs = withTicker(ctx?.headlines ?? [], extra ?? [])
    .filter(h => h.publishedAt > start && h.publishedAt <= ses.now && quotable(h.title, h.source, h.url) && mentionsTarget(h, t.id, t.name) && isMarketNews(h.title))
    .sort((a, b) => b.publishedAt - a.publishedAt)
  const kept: typeof hs = []
  for (const h of hs) { if (!kept.some(k => sameStory(k.title, h.title))) kept.push(h); if (kept.length === 8) break }
  if (!kept.length && b.late) return
  headlineFacts(s, kept.map(h => ({ h })), t, p.market, `No headline naming ${t.name} in the last ${days} days passed the news filters (market or company context, no listicles, opinion, recaps, how-to pages or advice).`)
  s.key.news = kept.length
}

async function portfolio(s: Sheet, p: Parsed, userId: string | null, b: Budget): Promise<void> {
  if (!userId) { s.cant('Sign in to ask about your own portfolio.'); return }
  const holdings = await b.within(prisma.portfolioHolding.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { ticker: true, quantity: true, buyPrice: true } }))
  if (!holdings) return
  if (!holdings.length) { s.cant('You have no holdings saved on the Portfolio page.'); return }
  const sym = (t: string) => resolveHolding(SENSITIVITIES, t) ?? t.trim().toUpperCase()
  const quotes = (await b.within(sharedQuotes(holdings.map(h => sym(h.ticker))))) ?? {}
  const src = (at: number | null) => ({ name: 'Yahoo Finance (shared price lookup)', asOf: at })
  const groups = new Map<Market, { w: number; wm: number }>()
  for (const h of holdings) {
    const q = quotes[sym(h.ticker)], m: Market = sym(h.ticker).endsWith('.NS') ? 'IN' : 'US'
    if (!q || q.changePct == null) { if (!b.late) s.cant(`${h.ticker}: no current quote, so no move today.`, 'Yahoo Finance'); continue }
    const ses = session(m), day = q.at ? marketDate(q.at, m) : null, when = ses.status === 'OPEN' && day === ses.today ? 'today' : day ? `in the session of ${fmtDay(day)}` : 'in the last session'
    s.add({ kind: 'holding-move', section: 'portfolio', text: `${h.ticker}: ${p1(q.changePct)} ${when}`, value: q.changePct, unit: '%', label: h.ticker, source: src(q.at), status: ses.status === 'OPEN' ? 'live' : 'cached' })
    const g = groups.get(m) ?? groups.set(m, { w: 0, wm: 0 }).get(m)!
    g.w += h.quantity * q.price; g.wm += h.quantity * q.price * q.changePct
  }
  for (const [m, g] of groups) if (g.w > 0) s.key[`group:${m}`] = s.add({ kind: 'holdings-move', section: 'portfolio', text: `Your ${m === 'US' ? 'US' : 'Indian'} holdings with a quote moved ${p1(g.wm / g.w)} on their latest session, weighted by current value (${m === 'US' ? 'USD' : 'INR'})`, value: g.wm / g.w, unit: '%', source: src(null), status: 'cached' })
  if (p.shock) {
    const x = scenarioInput(p)
    if (typeof x === 'string') { s.cant(`That shock can't be run: ${x}.`, 'Scenario Engine'); return }
    ratesNote(p, 'factor' in x ? x.shock : undefined)
    const input = 'preset' in x ? { preset: x.preset } : { factor: x.factor, shock: x.shock }
    const prices = Object.fromEntries(Object.entries(quotes).map(([k, q]) => [k, q.price]))
    const r = portfolioImpact(SENSITIVITIES, input as Parameters<typeof portfolioImpact>[1], holdings, prices)
    for (const g of r.groups) s.add({ kind: 'holdings-scenario', section: 'portfolio', text: g.text, value: g.total ?? undefined, unit: g.total != null ? '%' : undefined, source: { name: 'GOD’s Vision sensitivity data', asOf: SENSITIVITIES.meta.generatedAt }, status: 'estimate' })
    if (r.notEstimated.length) s.cant(`Not estimated (no reliable historical link or not covered): ${r.notEstimated.map(l => l.ticker).join(', ')}.`, 'GOD’s Vision sensitivity data')
  }
}

/** The FactSheet for a parsed question. `userId` is used only for PORTFOLIO. */
export async function gatherFacts(p: Parsed, userId: string | null = null, opts: { budgetMs?: number } = {}): Promise<FactSheet> {
  const s = newSheet(), ses = session(p.market), b = budget(opts.budgetMs ?? BUDGET_MS)
  const company = p.entities.find(e => e.type === 'company')
  const offGraph = company && !inGraph(company.id)
  switch (p.intent) {
    case 'WHY_MOVE': {
      if (!company) { const sec = p.entities.find(e => e.type === 'sector'); if (sec) await sectorWindow(s, sec, p, ses, b); break }
      const covered = p.window.key === 'today' ? (await whyToday(s, company, p, ses, b), new Set<string>()) : await whyWindow(s, company, p, ses, b)
      if (offGraph) { s.cant(`${company.name} is outside the Entity Graph and the historical sensitivity data, so no connections or historical links are shown.`, 'GOD’s Vision'); break }
      neighbourFacts(s, company, covered)
      patternFacts(s, company, p.market, SENSITIVITIES, run(p.market))
      break
    }
    case 'WHAT_IF': {
      const input = scenarioInput(p)
      if (typeof input === 'string') { s.key.invalid = s.cant(`That shock can't be run: ${input}.`, 'Scenario Engine'); break }
      const r = scenarioCached(input)
      ratesNote(p, r.factor?.unit === 'bp' ? r.factor.shock : undefined)
      scenarioFacts(s, r, p.entities.filter(e => e.type === 'company'))
      break
    }
    case 'CONNECTIONS':
      if (p.entities.length >= 2) pathFacts(s, p.entities[0], p.entities[1])
      else if (p.entities[0]) groupFacts(s, p.entities[0], p.question)
      break
    case 'MARKET_TODAY': {
      const r = await b.within(getBrain(p.market))
      if (r) brainFacts(s, r.brain, r.text, p.entities.filter(e => e.type !== 'country'))
      break
    }
    case 'NEWS':
      if (company ?? p.entities[0]) await news(s, (company ?? p.entities[0])!, p, ses, b)
      break
    case 'PORTFOLIO':
      await portfolio(s, p, userId, b)
      break
    case 'ADVICE':
      if (company && !offGraph) { neighbourFacts(s, company); patternFacts(s, company, p.market, SENSITIVITIES, run(p.market)) }
      break
  }
  if (b.late) s.key.loading = s.cant(STILL_LOADING)
  return { parsed: p, facts: s.facts, dataStatus: overallStatus(s.facts, p.intent), key: s.key, private: p.intent === 'PORTFOLIO' }
}
