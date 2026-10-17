// Research Agent — fact builders. Pure: no I/O, no clock reads (time is passed in), no AI.
// Each builder turns one engine's output into numbered facts with their source and
// data status. Facts quote engine text as-is (already worded "moved with",
// "coincides with", "historically tended to"); headlines are kept as quotes.
import type { DataStatus } from '../dataStatus.ts'
import type { Explanation, Headline, Market } from '../evidence/types.ts'
import { headlineScore, mentionsTarget, sameStory, SHOW_THRESHOLD, zoned } from '../evidence/engine.ts'
import { STRONG } from '../evidence/summary.ts'
import { connectionsFor, describeLink, findPath, getEntity, getLinks, GRAPH_META, type LinkView } from '../graph/index.ts'
import type { Brain } from '../brain/types.ts'
import type { BrainText } from '../brain/text.ts'
import { pct, signed } from '../format.ts'
import type { ScenarioResult, SensitivityData } from '../scenario/engine.ts'
import { MARKET_CONTROL, MARKET_FACTORS, type FactorId } from '../scenario/factors.ts'
import { presetSize, type FactorPreset } from '../scenario/presets.ts'
import type { EntityRef, Fact, FactSheet, Intent, Section } from './types.ts'

// ── Sheet ────────────────────────────────────────────────────────────────────
export interface Sheet { facts: Fact[]; key: FactSheet['key']; add(f: Omit<Fact, 'id'>): number; cant(text: string, source?: string): number }
export function newSheet(): Sheet {
  const facts: Fact[] = [], key: FactSheet['key'] = {}
  const add = (f: Omit<Fact, 'id'>) => facts.push({ id: facts.length + 1, ...f })
  return { facts, key, add, cant: (text, source = 'GOD’s Vision') => add({ kind: 'limit', section: 'cant', text, source: { name: source, asOf: null }, status: 'static-reference' }) }
}

// ── Formatting ───────────────────────────────────────────────────────────────
export const p1 = (n: number) => pct(n, 1, '−')
const MKT: Record<Market, { tz: string; label: string; close: [number, number]; who: string }> = {
  US: { tz: 'America/New_York', label: 'ET', close: [16, 0], who: 'US' },
  IN: { tz: 'Asia/Kolkata', label: 'IST', close: [15, 30], who: 'Indian' },
}
export const marketDate = (t: number, m: Market) => new Date(t).toLocaleDateString('en-CA', { timeZone: MKT[m].tz })
/** "Tue 13 Oct" for a YYYY-MM-DD date. */
export const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
/** "Thu 15 Oct, 16:00 ET". */
export const fmtWhen = (t: number, m: Market) => `${fmtDay(marketDate(t, m))}, ${new Date(t).toLocaleTimeString('en-GB', { timeZone: MKT[m].tz, hour: '2-digit', minute: '2-digit' })} ${MKT[m].label}`
const closeAt = (d: string, m: Market) => zoned(d, MKT[m].close, MKT[m].tz)

export interface Session { status: string; now: number; today: string }
const SENS = (d: SensitivityData | ScenarioResult) => ({ name: `GOD’s Vision sensitivity data (Yahoo Finance history, built ${('meta' in d ? d.meta.generatedAt : d.generatedAt).slice(0, 10)})`, asOf: 'meta' in d ? d.meta.generatedAt : d.generatedAt })
const GRAPH = { name: `Entity Graph (reference data, reviewed ${GRAPH_META.lastReviewed})`, asOf: GRAPH_META.lastReviewed }

// ── What may be quoted ───────────────────────────────────────────────────────
/** The publisher alone: "News18", never "News18 (Google News)". */
export const outlet = (name: string) => name.replace(/\s*\(Google News\)\s*$/i, '').trim()
// Social posts are not news outlets; how-to/explainer pages are not news about a move;
// advice wording (buy/sell/subscribe/accumulate/targets, upside calls) is never quoted.
const SOCIAL = /^(linkedin|x|twitter|facebook|reddit|youtube|instagram|threads)(\.com)?$/i
const SOCIAL_URL = /\b(linkedin|twitter|x|facebook|reddit|youtube|instagram|threads)\.(com|net)\b/i
const HOW_TO = /\bhow to\b|\b(check|apply for) (the )?(ipo )?allotment\b|\ballotment status\b|\bGMP\b|\bgrey market premium\b|\bstep[- ]by[- ]step\b|\bexplained\b|\beverything you need to know\b|\bkey dates\b/i
const ADVICE_WORDS = /\b(subscribe|buy|sell|accumulate|targets?)\b(?![- ]?off)|\b(up|down)side\b|\b(top|best) (stock )?picks?\b/i
/** May this headline be quoted in a research answer? */
export function quotable(title: string, source: string, url?: string): boolean {
  return !SOCIAL.test(outlet(source)) && !(url && SOCIAL_URL.test(url)) && !HOW_TO.test(title) && !ADVICE_WORDS.test(title)
}

// ── Factor exposures: "What moved" only with a reliable historical link ──────────
/** The Scenario Engine factor behind an exposure link, per market (crude → WTI/Brent, USD → DXY/USD-INR). */
export function factorFor(entityId: string, market: Market): FactorId | null {
  if (entityId === 'commodity:crude-oil') return market === 'US' ? 'wti' : 'brent'
  if (entityId === 'commodity:gold') return 'gold'
  if (entityId === 'currency:usd') return market === 'US' ? 'dxy' : 'usdinr'
  if (entityId === 'currency:inr') return 'usdinr'
  return null
}
export function reliableLink(data: SensitivityData, symbol: string, entityId: string, market: Market): boolean {
  const f = factorFor(entityId, market)
  return !!f && !!data.stocks[symbol]?.factors[f]?.reliable
}
export const NO_LINK = '(no reliable historical link in the data)'

// ── WHY_MOVE today: the Why Engine's explanation ─────────────────────────────
// Driver clauses for the headline line, from the evidence engine's own labels.
const CLAUSE: Record<string, (label: string) => string> = {
  market: l => l, sector: l => `moved with ${l}`, peers: l => `alongside ${l}`, commodity: l => l, currency: l => l,
  scheduled: l => `around ${l}`, volume: l => `on ${l}`, linked_event: l => `alongside a ${l.replace(/^linked: /, 'linked event: ')}`,
}
export function whyTodayFacts(s: Sheet, ex: Explanation, session: Session, data: SensitivityData): void {
  const e = ex
  const mt = e.snapshot.marketTime ?? null, at = mt ?? e.snapshot.at, day = marketDate(at, e.market)
  const open = session.status === 'OPEN', current = day === session.today
  // A quote from an earlier day while the exchange is open is never shown as today's move.
  const stale = open && mt != null && !current
  // Without an exchange time the session date is unknown: "latest session", never a guessed date.
  const when = open && (current || mt == null) ? 'today' : mt == null ? 'in the latest session' : `in the session of ${fmtDay(day)}`
  s.key.move = s.add({ kind: 'move', section: 'moved', text: `${e.name} ${p1(e.snapshot.changePct)} ${when} (${mt != null ? 'last trade' : 'quote as of'} ${fmtWhen(at, e.market)})`,
    value: e.snapshot.changePct, unit: '%', label: when, source: { name: 'Yahoo Finance', asOf: at }, status: stale ? 'stale' : open ? 'live' : 'cached' })
  s.key.moveValue = e.snapshot.changePct
  s.key.when = when
  s.key.name = e.name
  if (stale) s.key.stale = s.cant(`The latest quote for ${e.name} is from ${fmtDay(day)}; today's move is not available yet.`, 'Yahoo Finance')
  else if (!open) s.cant(`The ${MKT[e.market].who} market is ${session.status.toLowerCase()}; figures are from ${mt != null ? `the session of ${fmtDay(day)}` : 'its latest session'}.`)
  const clauses: { text: string; id: number }[] = [], clauseIdsExtra: number[] = []
  let topNews: { id: number; text: string } | null = null
  for (const d of e.drivers) {
    if (d.type === 'no_clear_driver') { s.key.noDriver = s.cant(d.label === 'little changed' ? `${e.name} moved less than 0.3%, too small to attribute.` : `No clear driver found: ${d.evidence}`, 'Evidence Engine'); continue }
    const strong = d.score >= STRONG
    const src = { name: outlet(d.source.name), url: d.source.url, asOf: d.timestamp }
    if (d.type === 'news' || d.type === 'related_news') {
      const cut = d.type === 'related_news' ? d.evidence.lastIndexOf(' — ') : -1
      const title = cut > 0 ? d.evidence.slice(0, cut) : d.evidence
      if (!quotable(title, d.source.name, d.source.url)) continue
      const who = d.type === 'related_news' ? `${d.label.replace(/^related: /, '').replace(/ in headlines$/, '')}: ` : ''
      const id = s.add({ kind: 'headline', section: 'news', text: `${who}“${title}” (${src.name}, ${fmtWhen(d.timestamp, e.market)})`, quote: title, label: d.label, strong, source: src, status: 'cached' })
      // The first line names a headline only when it passes STRONG; weaker ones stay in Related news.
      if (strong && !topNews) topNews = { id, text: `${src.name} reported “${title}”` }
      continue
    }
    // Commodity / currency moves count as "what moved" only with a reliable historical link.
    if (d.type === 'commodity' || d.type === 'currency') {
      const v = getLinks(e.id).find(v => v.direction === 'out' && v.link.type === 'exposed_to' && (d.type === 'currency' ? v.other.type === 'currency' : d.evidence.toLowerCase().startsWith(v.other.name.toLowerCase())))
      if (!v || !reliableLink(data, e.id, v.other.id, e.market)) {
        s.add({ kind: `exposure:${d.type}`, section: 'connections', text: `${e.name} is exposed to ${v?.other.name ?? d.label.replace(/^coincides with /, '')} ${NO_LINK}: ${d.evidence}`, source: src, status: stale ? 'stale' : open ? 'live' : 'cached' })
        continue
      }
    }
    const plain = ['market', 'sector', 'peers', 'commodity', 'currency'].includes(d.type) ? 'smaller related move' : 'less closely related'
    const id = s.add({ kind: `driver:${d.type}`, section: 'moved', text: strong ? d.evidence : `${d.evidence.replace(/\.$/, '')} (${plain})`, label: d.label, strong, source: src, status: stale ? 'stale' : open ? 'live' : 'cached' })
    if (strong && CLAUSE[d.type]) clauses.push({ text: CLAUSE[d.type](d.label), id })
  }
  // "moved with Nasdaq (−0.8%) and tech (−1.3%)", as the Why line words it.
  const mk = clauses.findIndex(c => c.text.startsWith('moved with') && e.drivers.some(d => d.type === 'market' && d.label === c.text))
  const sc = clauses.findIndex(c => e.drivers.some(d => d.type === 'sector' && c.text === `moved with ${d.label}`))
  if (mk >= 0 && sc >= 0) { clauses[mk] = { text: `${clauses[mk].text} and ${clauses[sc].text.slice('moved with '.length)}`, id: clauses[mk].id }; clauseIdsExtra.push(clauses[sc].id); clauses.splice(sc, 1) }
  // Headline material: strong drivers in score order, then the strongest quotable headline.
  s.key.clauses = clauses.map(c => c.text).join('; ')
  s.key.clauseIds = [...clauses.map(c => c.id), ...clauseIdsExtra].join(',')
  if (topNews) { s.key.topNews = topNews.id; s.key.topNewsText = topNews.text }
  if (!clauses.length && !topNews && !s.key.noDriver) s.key.noDriver = s.cant('No clear driver found among the evidence that can be shown.', 'Evidence Engine')
}

// ── WHY_MOVE over a window: daily closes ─────────────────────────────────────
export interface Closes { symbol: string; dates: string[]; closes: number[]; asOf: number | null }

/** Yahoo v8 chart JSON → daily closes dated in the exchange's time zone (null bars skipped). */
export function parseChart(symbol: string, json: unknown): Closes | null {
  const r = (json as any)?.chart?.result?.[0]
  if (!r?.timestamp?.length) return null
  const tz: string = r.meta?.exchangeTimezoneName ?? 'UTC', raw: (number | null)[] = r.indicators?.quote?.[0]?.close ?? []
  const out: Closes = { symbol, dates: [], closes: [], asOf: typeof r.meta?.regularMarketTime === 'number' ? r.meta.regularMarketTime * 1000 : null }
  r.timestamp.forEach((t: number, i: number) => {
    const c = raw[i]
    if (c == null || !Number.isFinite(c) || c <= 0) return
    const d = new Date(t * 1000).toLocaleDateString('en-CA', { timeZone: tz })
    if (out.dates.at(-1) === d) out.closes[out.closes.length - 1] = c
    else { out.dates.push(d); out.closes.push(c) }
  })
  return out.dates.length >= 2 ? out : null
}

export interface Win { base: string; end: string; dates: string[]; partial: boolean }
const minusMonth = (d: string) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCMonth(x.getUTCMonth() - 1); return x.toISOString().slice(0, 10) }

/** The window's sessions in a stock's own closes: past 5 sessions, past month, or yesterday's session. */
export function windowOf(c: Closes, key: 'yesterday' | 'week' | 'month', today: string, open: boolean): Win | null {
  const n = c.dates.length
  let end = n - 1
  if (key === 'yesterday') { while (end >= 0 && c.dates[end] >= today) end--; if (end < 1) return null }
  let base: number
  if (key === 'week') base = end - 5
  else if (key === 'month') { const m = minusMonth(c.dates[end]); base = -1; for (let i = 0; i < end; i++) if (c.dates[i] <= m) base = i }
  else base = end - 1
  if (base < 0) return null
  return { base: c.dates[base], end: c.dates[end], dates: c.dates.slice(base + 1, end + 1), partial: open && c.dates[end] === today }
}

/** Close on `d`, or on the last date before it ('previous': strictly before, for a US-hours series against an Indian close). */
function closeOn(c: Closes, d: string, previous: boolean): number | null {
  let v: number | null = null
  for (let i = 0; i < c.dates.length && (previous ? c.dates[i] < d : c.dates[i] <= d); i++) v = c.closes[i]
  return v
}
function prevDate(c: Closes, d: string): string | null {
  let p: string | null = null
  for (const x of c.dates) { if (x >= d) break; p = x }
  return p
}
export const ret = (c: Closes, w: Win, previous = false): number | null => {
  const a = closeOn(c, w.base, previous), b = closeOn(c, w.end, previous)
  return a && b ? (b / a - 1) * 100 : null
}
/** One session's move: close on `d` vs the session before (same alignment rules). */
export const dayMove = (c: Closes, d: string, previous = false): number | null => {
  const ref = previous ? prevDate(c, d) : d
  const pd = ref && prevDate(c, ref)
  const a = pd ? closeOn(c, pd, false) : null, b = ref ? closeOn(c, ref, false) : null
  return a && b ? (b / a - 1) * 100 : null
}

/** `reliable`: exposures only — whether the stock has a reliable historical link to that factor (else it is context, not "what moved"). */
export interface Compare { kind: 'index' | 'sector' | 'peer' | 'exposure'; name: string; closes: Closes; usHours: boolean; why?: string; reliable?: boolean }

/** Facts for a move over a window: the stock, its market, its sector, the gap, the biggest day and what else moved that day. */
export function windowFacts(s: Sheet, target: EntityRef, market: Market, key: 'yesterday' | 'week' | 'month', stock: Closes, others: Compare[], session: Session): Win | null {
  const open = session.status === 'OPEN'
  const w = windowOf(stock, key, session.today, open)
  if (!w) { s.cant(`Not enough price history for ${target.name} to measure this window.`, 'Yahoo Finance'); return null }
  const r = ret(stock, w)!
  const label = key === 'yesterday' ? `session of ${fmtDay(w.end)}` : key === 'week' ? 'past 5 sessions' : 'past month'
  const to = w.partial && stock.asOf ? `${fmtWhen(stock.asOf, market)}, today's session so far` : `the ${fmtDay(w.end)} close`
  const src = (c: Closes) => ({ name: `Yahoo Finance daily closes (${c.symbol})`, asOf: c.asOf })
  const st: DataStatus = w.partial ? 'delayed' : 'cached'
  s.key.ret = s.add({ kind: 'return', section: 'moved', text: `${target.name} ${p1(r)} over the ${label} (${fmtDay(w.base)} close to ${to})`, value: r, unit: '%', source: src(stock), status: st })
  s.key.retValue = r
  s.key.label = label
  s.key.name = target.name
  const pv = (o: Compare) => market === 'IN' && o.usHours
  for (const o of others) {
    const x = ret(o.closes, w, pv(o))
    if (x == null) continue
    const tail = pv(o) ? ' (US sessions up to the day before each Indian close)' : ''
    if (o.kind === 'index') {
      s.key.idx = s.add({ kind: 'index-return', section: 'moved', text: `${o.name} ${p1(x)} over the same window${tail}`, value: x, unit: '%', source: src(o.closes), status: st })
      s.key.idxName = o.name; s.key.idxValue = x
      s.key.rel = s.add({ kind: 'relative', section: 'moved', text: `${target.name} versus the ${o.name}: ${signed(r - x, 1, '−')} percentage points (${p1(r)} against ${p1(x)})`, value: r - x, unit: 'pp', source: src(stock), status: st })
      s.key.relValue = r - x
    } else if (o.kind === 'sector') {
      s.key.sector = s.add({ kind: 'sector-return', section: 'moved', text: `${o.name} ${p1(x)} over the same window`, value: x, unit: '%', source: src(o.closes), status: st })
    } else if (o.kind === 'exposure' && !o.reliable) {
      s.add({ kind: 'exposure-return', section: 'connections', text: `${target.name} is exposed to ${o.name} ${NO_LINK}: ${o.name} ${p1(x)} over the same window${tail}${o.why ? `; ${o.why}` : ''}`, value: x, unit: '%', source: src(o.closes), status: st })
    } else {
      s.add({ kind: `${o.kind}-return`, section: o.kind === 'peer' ? 'connections' : 'moved', text: `${o.name} ${p1(x)} over the same window${tail}${o.why ? `; ${o.why}` : ''}`, value: x, unit: '%', source: src(o.closes), status: st })
    }
  }
  if (target.type === 'company' && !others.some(o => o.kind === 'sector')) s.cant(`No sector index with price history is available for ${target.name}${target.name.endsWith('s') ? '’' : '’s'} sector here, so no sector comparison.`)

  // Biggest single-day move and what else moved that day.
  if (w.dates.length > 1) {
    const days = w.dates.map(d => ({ d, m: dayMove(stock, d) })).filter((x): x is { d: string; m: number } => x.m != null)
    const big = days.sort((a, b) => Math.abs(b.m) - Math.abs(a.m))[0]
    if (big) {
      s.key.big = s.add({ kind: 'biggest-day', section: 'moved', text: `Biggest single-day move in the window: ${p1(big.m)} on ${fmtDay(big.d)}`, value: big.m, unit: '%', source: src(stock), status: st })
      s.key.bigDay = fmtDay(big.d); s.key.bigValue = big.m
      // Alongside: the largest same-direction move that day among the comparisons (notable size only).
      let along: { id: number; name: string; m: number } | null = null
      for (const o of others) {
        if (o.kind === 'exposure' && !o.reliable) continue // context only: not "what moved"
        const m = dayMove(o.closes, big.d, pv(o))
        if (m == null) continue
        const id = s.add({ kind: 'same-day', section: 'moved', text: `${o.name} ${p1(m)} on ${fmtDay(big.d)}${pv(o) ? ' (the US session before that Indian close)' : ''}`, value: m, unit: '%', source: src(o.closes), status: st })
        const notable = Math.abs(m) >= (o.kind === 'exposure' ? 1 : 0.5)
        if (notable && Math.sign(m) === Math.sign(big.m) && (!along || Math.abs(m) > Math.abs(along.m))) along = { id, name: o.name, m }
      }
      if (along) { s.key.along = along.id; s.key.alongName = along.name; s.key.alongValue = along.m }
    }
  }
  return w
}

/** Headlines naming the stock inside the window, each scored against the move of the session it belongs to
 *  (existing evidence scoring, noise traps and threshold), near-duplicates merged, best 5. */
export function windowHeadlines(hs: Headline[], target: EntityRef, stock: Closes, w: Win, market: Market): { h: Headline; score: number; day: string; move: number }[] {
  const ends = w.dates.map((d, i) => ({ d, end: i === w.dates.length - 1 && w.partial && stock.asOf ? stock.asOf : closeAt(d, market) }))
  const start = closeAt(w.base, market)
  const scored = hs.flatMap(h => {
    if (h.publishedAt <= start || !quotable(h.title, h.source, h.url) || !mentionsTarget(h, target.id, target.name)) return []
    const sess = ends.find(e => h.publishedAt <= e.end)
    const move = sess && dayMove(stock, sess.d)
    if (!sess || move == null) return []
    const score = headlineScore(h, move, sess.end, undefined, target)
    return score >= SHOW_THRESHOLD ? [{ h, score, day: sess.d, move }] : []
  }).sort((a, b) => b.score - a.score)
  const kept: typeof scored = []
  for (const x of scored) { if (!kept.some(k => sameStory(k.h.title, x.h.title))) kept.push(x); if (kept.length === 5) break }
  return kept
}

export function headlineFacts(s: Sheet, items: { h: Headline; score?: number; day?: string; move?: number }[], target: EntityRef, market: Market, empty: string): void {
  for (const { h, score, day, move } of items) {
    const name = outlet(h.source)
    const ctx = day && move != null ? `; published in the session of ${fmtDay(day)}, when ${target.name} moved ${p1(move)}` : ''
    const id = s.add({ kind: 'headline', section: 'news', text: `“${h.title}” (${name}, ${fmtWhen(h.publishedAt, market)})${ctx}`, quote: h.title,
      strong: score != null ? score >= STRONG : undefined, source: { name, url: h.url, asOf: h.publishedAt }, status: 'cached' })
    // The strongest headline on the biggest-move day is named in the headline line.
    if (score != null && score >= STRONG && day && fmtDay(day) === s.key.bigDay && !s.key.bigNews) { s.key.bigNews = id; s.key.bigNewsText = `${name} reported “${h.title}”` }
  }
  if (!items.length) s.key.noNews = s.cant(empty, 'News filters')
}

/** Top and bottom tracked constituents of a sector over the window. */
export function constituentFacts(s: Sheet, sectorName: string, members: { name: string; closes: Closes }[], w: Win): void {
  const rs = members.flatMap(m => { const x = ret(m.closes, w); return x == null ? [] : [{ name: m.name, x, c: m.closes }] }).sort((a, b) => b.x - a.x)
  if (rs.length < 2) { s.cant(`Too few ${sectorName} constituents with prices to compare.`, 'Yahoo Finance'); return }
  const add = (r: typeof rs[number], kind: 'top' | 'bottom') => s.add({ kind: `constituent-${kind}`, section: 'moved', text: `${r.name} ${p1(r.x)} over the same window (${kind === 'top' ? 'strongest' : 'weakest'} of ${rs.length} tracked constituents)`, value: r.x, unit: '%', label: r.name, source: { name: `Yahoo Finance daily closes (${r.c.symbol})`, asOf: r.c.asOf }, status: w.partial ? 'delayed' : 'cached' })
  s.key.top = add(rs[0], 'top')
  if (rs.length > 2) add(rs[1], 'top')
  if (rs.length > 3) add(rs[rs.length - 2], 'bottom')
  s.key.bottom = add(rs[rs.length - 1], 'bottom')
}

// ── Connected context ────────────────────────────────────────────────────────
const STRUCTURAL = new Set(['constituent_of', 'in_sector', 'headquartered_in', 'part_of', 'benchmark_of', 'currency_of'])
const PRIORITY = ['supplier_of', 'competitor_of', 'subsidiary_of', 'exposed_to']
/** "Reliance Industries is exposed to Crude oil" (describeLink, with the verb a sentence needs). */
export function linkSentence(name: string, v: LinkView): string {
  const d = describeLink(v)
  return `${name} ${/^(exposed|supplied|majority|in |headquartered|part of|benchmark|currency)/.test(d) ? 'is ' : ''}${d}`
}

/** Up to 5 direct business links (supply, competition, ownership, exposure) with their reasons. */
export function neighbourFacts(s: Sheet, target: EntityRef, skip: ReadonlySet<string> = new Set()): number[] {
  const links = getLinks(target.id).filter(v => !STRUCTURAL.has(v.link.type) && !skip.has(v.other.id))
    .sort((a, b) => PRIORITY.indexOf(a.link.type) - PRIORITY.indexOf(b.link.type)).slice(0, 5)
  return links.map(v => s.add({ kind: 'link', section: 'connections', text: `${linkSentence(target.name, v)}: ${v.link.reason}`, source: GRAPH, status: 'static-reference' }))
}

/** The shock a factor gets when the question gives no size: its 95th (up) / 5th (down) percentile 20-day move, rounded toward zero — the preset rule. */
export function defaultShock(factor: FactorId, direction: 1 | -1, market: Market, data: SensitivityData): number {
  return presetSize({ factor, side: direction > 0 ? 'up' : 'down' } as FactorPreset, market, data.factors).shock
}

/** Reliable historical links for one stock (strongest 3), each through the Scenario Engine at the usual up-move. */
export function patternFacts(s: Sheet, target: EntityRef, market: Market, data: SensitivityData, run: (factor: FactorId, shock: number) => ScenarioResult): number[] {
  const e = data.stocks[target.id]
  if (!e) { s.cant(`${target.name} is not in the historical sensitivity data.`); return [] }
  const fits = MARKET_FACTORS[market].flatMap(f => (e.factors[f]?.reliable ? [{ f, fit: e.factors[f]! }] : [])).sort((a, b) => Math.abs(b.fit.t) - Math.abs(a.fit.t)).slice(0, 3)
  if (!fits.length) { s.key.noPattern = s.cant(`No reliable historical link between ${target.name} and oil, gold, the US dollar, USD/INR, the US 10-year yield or the VIX.`, 'GOD’s Vision sensitivity data'); return [] }
  return fits.flatMap(({ f, fit }) => {
    const r = run(f, defaultShock(f, 1, market, data)), i = r.stocks.find(x => x.symbol === target.id)
    if (!i) return []
    return [s.add({ kind: 'pattern', section: 'pattern', text: `${i.text} Measured on ${fit.freq} moves from ${r.window.start} to ${r.window.end} (t ${Math.abs(fit.t).toFixed(1)}, ${fit.n} observations).`,
      value: i.total, unit: '%', source: SENS(data), status: 'estimate' })]
  })
}

// ── WHAT_IF: the Scenario Engine ─────────────────────────────────────────────
export function scenarioFacts(s: Sheet, r: ScenarioResult, focus: EntityRef[]): void {
  const src = SENS(r)
  s.key.title = s.add({ kind: 'scenario', section: 'scenario', text: r.description.startsWith('Custom shock') ? r.description : `${r.title}: ${r.description}`, source: src, status: 'estimate' })
  s.key.titleText = r.title
  if (r.kind === 'event') {
    for (const t of (r.event ?? []).slice(0, 8)) s.add({ kind: 'event-link', section: 'scenario', text: `${t.name}: linked to this event, ${t.direction === 'hurt' ? 'on the hurt side' : 'on the helped side'} (${t.path}; ${t.reason})`, source: GRAPH, status: 'static-reference' })
    s.cant('Directional only: there is no measurable history for this event, so no percentages are shown.', 'Scenario Engine')
    return
  }
  s.key.range = s.add({ kind: 'range', section: 'scenario', text: r.range!.text, source: src, status: 'estimate' })
  s.key.beyond = r.range!.beyond ? 1 : 0
  if (r.marketReaction) s.key.market = s.add({ kind: 'market-reaction', section: 'scenario', text: r.marketReaction.text, value: r.marketReaction.value ?? undefined, unit: r.marketReaction.value != null ? '%' : undefined, source: src, status: 'estimate' })
  s.key.marketReliable = r.marketReaction?.reliable ? 1 : 0
  const impact = (i: ScenarioResult['stocks'][number], kind: string) => s.add({ kind, section: 'scenario', text: i.text, value: i.total, unit: '%', label: i.name, source: src, status: 'estimate' })
  for (const f of focus) {
    const i = r.stocks.find(x => x.symbol === f.id)
    if (i) s.key[`focus:${f.id}`] = impact(i, 'focus')
    else if (f.type === 'company') s.key[`focus:${f.id}`] = s.cant(`${f.name}: no reliable historical link to ${r.factor!.name}, so no number is shown.`, 'GOD’s Vision sensitivity data')
  }
  r.helped.forEach((i, k) => { const id = impact(i, 'helped'); if (k === 0) s.key.helped = id })
  r.hurt.forEach((i, k) => { const id = impact(i, 'hurt'); if (k === 0) s.key.hurt = id })
  if (r.helped[1]) s.key.helped2 = s.facts.find(f => f.kind === 'helped' && f.label === r.helped[1].name)!.id
  if (r.hurt[1]) s.key.hurt2 = s.facts.find(f => f.kind === 'hurt' && f.label === r.hurt[1].name)!.id
  const bars = r.sectors.filter(b => b.total != null).sort((a, b) => Math.abs(b.total!) - Math.abs(a.total!)).slice(0, 6)
  for (const b of bars) s.add({ kind: 'sector', section: 'scenario', text: `Historically, ${b.name}${b.symbol && !b.name.includes(b.symbol) ? ` (${b.symbol})` : ''} tended to move ${p1(b.total!)}${b.low != null ? ` (90% range ${p1(b.low)} to ${p1(b.high!)})` : ''}; ${b.note}`, value: b.total!, unit: '%', label: b.name, source: src, status: 'estimate' })
  const none = r.sectors.filter(b => b.total == null).map(b => b.name)
  if (none.length) s.cant(`No reliable historical link for these sectors: ${none.join(', ')}.`, 'GOD’s Vision sensitivity data')
  for (const i of r.indirect.slice(0, 3)) s.add({ kind: 'indirect', section: 'connections', text: i.text, source: GRAPH, status: 'static-reference' })
  const total = r.stocks.length + r.notEstimated.length
  if (r.notEstimated.length) s.cant(`${r.notEstimated.length} of ${total} ${MKT[r.market].who} stocks in the data have no reliable historical link to ${r.factor!.name}, so they get no number.`, 'GOD’s Vision sensitivity data')
  s.cant(`These are historical estimates from ${r.window.start} to ${r.window.end} (${r.window.freq} moves); relationships change over time.`, 'GOD’s Vision sensitivity data')
}

// ── CONNECTIONS: the Entity Graph ────────────────────────────────────────────
export function pathFacts(s: Sheet, a: EntityRef, b: EntityRef): void {
  const path = findPath(a.id, b.id)
  if (!path) { s.key.noPath = s.cant(`No chain of links connects ${a.name} and ${b.name} in the Entity Graph.`, 'Entity Graph'); return }
  let cur = a.name
  s.key.hops = path.length
  path.forEach((v, k) => {
    const id = s.add({ kind: 'path-step', section: 'connections', text: `${linkSentence(cur, v)}: ${v.link.reason}`, label: linkSentence(cur, v), source: GRAPH, status: 'static-reference' })
    if (k === 0) s.key.step1 = id
    cur = v.other.name
  })
}

const GROUP_FOR: [RegExp, string[]][] = [
  [/\b(suppl\w*|supply chain)\b/i, ['Supply chain']], [/\b(customers?|clients?|buys? from)\b/i, ['Supply chain']],
  [/\b(compet\w*|rivals?|peers?)\b/i, ['Competitors']], [/\b(expos\w*|depend\w*|sensitive)\b/i, ['Exposure']],
]
/** One entity's direct connections, narrowed to what was asked (suppliers, competitors, exposure), at most 8. */
export function groupFacts(s: Sheet, a: EntityRef, question: string): void {
  const c = connectionsFor(a.id)
  if (!c) { s.cant(`${a.name} has no connections in the Entity Graph.`, 'Entity Graph'); return }
  const want = GROUP_FOR.filter(([re]) => re.test(question)).flatMap(([, g]) => g)
  let items = c.groups.filter(g => !want.length || want.includes(g.title)).flatMap(g => g.items.map(i => ({ ...i, group: g.title })))
  // "Who supplies X": only X's suppliers; "X's customers": only those it supplies.
  if (/\bwho supplies\b|\bsuppliers? (of|to|for)\b/i.test(question)) items = items.filter(i => i.description.startsWith('supplied by'))
  if (/\bcustomers?\b|\bclients?\b/i.test(question)) items = items.filter(i => i.description.startsWith('supplies'))
  if (!items.length) { s.key.noPath = s.cant(`The Entity Graph lists no ${want.length ? want.join(' / ').toLowerCase() + ' ' : ''}links for ${a.name}.`, 'Entity Graph'); return }
  items.slice(0, 8).forEach((i, k) => {
    const id = s.add({ kind: 'link', section: 'connections', text: `${a.name}: ${i.description} (${i.reason})`, label: i.description, source: GRAPH, status: 'static-reference' })
    if (k === 0) s.key.step1 = id
  })
  s.key.links = Math.min(items.length, 8)
}

// ── MARKET_TODAY: the Market Brain ───────────────────────────────────────────
export function brainFacts(s: Sheet, b: Brain, t: BrainText, focus: EntityRef[]): void {
  const m = b.market, open = b.session.status === 'OPEN'
  const st: DataStatus = open ? 'live' : 'cached'
  const q = (x: { name: string; changePct: number; at: number; source: { name: string; url?: string } }, kind: string) =>
    s.add({ kind, section: 'market', text: `${x.name} ${p1(x.changePct)}${open ? ' today' : ` in the session of ${b.session.date ? fmtDay(b.session.date) : 'the last trade'}`}`, value: x.changePct, unit: '%', label: x.name, source: { ...x.source, asOf: x.at }, status: st })
  // Focus (an index, commodity or currency the question named) first.
  for (const f of focus) {
    const sym = getEntity(f.id)?.symbols ?? []
    const hit = [...b.state.indices, ...b.crossAsset].find(x => sym.includes(x.symbol))
    if (hit) s.key.focus = q(hit, 'focus')
    else if (f.type !== 'country') s.cant(`${f.name}: no notable move in today's market data (the summary lists commodities, currencies and yields only when they move a notable amount).`, 'Market Brain')
  }
  b.state.indices.forEach((x, k) => { const id = q(x, 'index'); if (k === 0) s.key.bench = id })
  if (b.state.breadth) {
    const br = b.state.breadth, tot = br.advancing + br.declining + br.unchanged
    s.key.breadth = s.add({ kind: 'breadth', section: 'market', text: `${br.advancing} of ${tot} ${br.universe.replace(/^\d+ /, '')} up, ${br.declining} down`, value: br.advancing, source: { ...br.source, asOf: br.at }, status: st })
  }
  if (b.state.indexWhy) s.key.indexWhy = s.add({ kind: 'index-why', section: 'market', text: `${b.state.indices[0]?.name ?? 'Index'} evidence: ${b.state.indexWhy}`, source: { name: 'Evidence Engine', asOf: b.builtAt }, status: st })
  if (b.sectors.strongest.length) {
    s.key.strong = s.add({ kind: 'sectors', section: 'market', text: `Strongest sectors: ${b.sectors.strongest.map(x => `${x.name} ${p1(x.changePct)}`).join(', ')} (${b.sectors.basis})`, source: { ...b.sectors.strongest[0].source, asOf: b.sectors.strongest[0].at }, status: st })
    s.key.weak = s.add({ kind: 'sectors', section: 'market', text: `Weakest sectors: ${b.sectors.weakest.map(x => `${x.name} ${p1(x.changePct)}`).join(', ')} (${b.sectors.basis})`, source: { ...b.sectors.weakest[0].source, asOf: b.sectors.weakest[0].at }, status: st })
  }
  for (const x of b.crossAsset.slice(0, 4)) {
    const y = x.symbol === '^TNX' || x.symbol === '^IRX'
    s.add({ kind: 'cross-asset', section: 'market', text: y ? `${x.name} ${signed(Math.round((x.change ?? 0) * 100), 0, '−')}bp` : `${x.name} ${p1(x.changePct)}`, value: y ? Math.round((x.change ?? 0) * 100) : x.changePct, unit: y ? 'bp' : '%', source: { ...x.source, asOf: x.at }, status: st })
  }
  b.themes.slice(0, 3).forEach((th, k) => {
    const id = s.add({ kind: 'theme', section: 'news', text: `${th.title}: ${th.stories} related headlines from ${th.sources} outlets; ${t.themeMoves[th.id]}`, label: th.title, source: { name: 'Market Brain themes', asOf: b.builtAt }, status: st })
    if (k === 0) s.key.theme = id
    for (const h of th.headlines.filter(h => quotable(h.title, h.source.name, h.source.url)).slice(0, 2)) s.add({ kind: 'headline', section: 'news', text: `“${h.title}” (${outlet(h.source.name)}, ${fmtWhen(h.at, m)})`, quote: h.title, source: { ...h.source, name: outlet(h.source.name), asOf: h.at }, status: 'cached' })
  })
  if (!b.themes.length) s.cant('No news theme met the bar today (at least 3 stories from 2 outlets plus a quoted instrument they are about).', 'Market Brain')
  const up = b.movers.filter(x => x.changePct > 0).slice(0, 2), down = b.movers.filter(x => x.changePct < 0).slice(0, 2)
  for (const x of [...up, ...down]) s.add({ kind: 'mover', section: 'moved', text: `${x.name} ${p1(x.changePct)} (${x.summary})`, value: x.changePct, unit: '%', label: x.name, source: { ...x.source, asOf: x.at }, status: st })
  if (!open) s.cant(`The ${MKT[m].who} market is ${b.session.status.toLowerCase()}; figures are from the session of ${fmtDay(b.session.date)}.`)
  s.key.open = open ? 1 : 0
  s.key.sessionDate = b.session.date
  const missing = Object.entries(b.inputs ?? {}).filter(([, v]) => v !== 'ok').map(([k, v]) => `${k} (${v})`)
  if (missing.length) s.cant(`Some inputs were not fully available: ${missing.join(', ')}.`, 'Market Brain')
}

// ── Data status for the whole answer ─────────────────────────────────────────
const RANK: Record<DataStatus, number> = { live: 0, delayed: 1, cached: 2, 'static-reference': 2, estimate: 2, stale: 4, unavailable: 5 }
export function overallStatus(facts: Fact[], intent: Intent): FactSheet['dataStatus'] {
  const main = facts.filter(f => f.section !== 'cant')
  if (intent === 'ADVICE' || intent === 'UNSUPPORTED') return { status: 'static-reference', asOf: null, note: 'A set reply; no live market data used.' }
  if (!main.length) return { status: 'unavailable', asOf: null, note: 'No data behind this answer.' }
  const stale = main.filter(f => f.status === 'stale')
  if (stale.length) return { status: 'stale', asOf: null, note: 'Some figures are not current; they are marked as such.' }
  const kind: Partial<Record<Intent, DataStatus>> = { WHAT_IF: 'estimate', CONNECTIONS: 'static-reference', ADVICE: 'static-reference' }
  const asOfs = main.map(f => (typeof f.source.asOf === 'number' ? f.source.asOf : null)).filter((x): x is number => x != null)
  // Market data only: reference links and estimates never make an answer look "live".
  const market = main.filter(f => f.status !== 'static-reference' && f.status !== 'estimate')
  const status = kind[intent] ?? (market.length ? market.reduce<DataStatus>((w, f) => (RANK[f.status] > RANK[w] ? f.status : w), 'live') : 'unavailable')
  if (status === 'unavailable') return { status, asOf: null, note: 'No market data arrived for this answer.' }
  const note = status === 'estimate' ? 'Historical estimates, not live data.' : status === 'static-reference' ? 'Curated reference data, not a live feed.' : status === 'live' ? 'Prices from the app’s live caches (up to a minute old).' : status === 'delayed' ? 'Prices up to 15 minutes old.' : 'Served from cache within its refresh window.'
  return { status, asOf: asOfs.length ? Math.max(...asOfs) : null, note }
}

export const SECTIONS: { key: Section; title: string }[] = [
  { key: 'moved', title: 'What moved' }, { key: 'market', title: 'Market today' }, { key: 'scenario', title: 'Scenario' },
  { key: 'news', title: 'Related news' }, { key: 'connections', title: 'Connections' }, { key: 'pattern', title: 'Historical pattern' },
  { key: 'portfolio', title: 'Your holdings' }, { key: 'cant', title: 'What we can’t tell' },
]
export { MARKET_CONTROL }
