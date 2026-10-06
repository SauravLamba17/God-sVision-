// Market Brain engine — pure: no I/O, no clock reads (time comes from ctx.builtAt).
// Builds one structured picture of a market from the Evidence Engine's context
// (data the app already fetches) and its explanations. No AI.
//
// SCORES (0–1) say how notable an item is — transparent arithmetic:
//   index / sector      min(|move| / 2%, 1)
//   breadth             |advancing − declining| / total
//   mover               min(|move| / 5%, 1)
//   commodity           min(|move| / 3%, 1)        notable at |move| ≥ 1%
//   currency            min(|move| / 0.8%, 1)      notable at ≥ 0.25%
//   yield               min(|change| / 15bp, 1)    notable at ≥ 5bp
//   volatility index    min(|move| / 15%, 1)       notable at ≥ 5%
//   world event         earthquake M6 0.3 / M6.5 0.4 / M7+ 0.55 (≤48h); outbreak report 0.15 (≤14 days);
//                       × 0.6 when it touches no listed company or commodity
//   theme               0.5·min(stories/8, 1) + 0.2·min(sources/4, 1) + 0.3·min(|largest related move|/3%, 1)
//   upcoming            macro high 0.8 / medium 0.5 / low 0.2; earnings 0.6 (graph company) / 0.4
//
// THEMES replace AI "narratives". A theme groups the session's headlines by a
// shared graph entity (sector, commodity, country, currency, or a cluster of
// linked companies). It needs ≥3 distinct stories (near-duplicates merged) from
// ≥2 different outlets AND ≥1 related price move. Nothing is invented from a
// single story; every theme lists its headlines with links.

import type { Explanation, Headline, MarketContext, Market, Quote } from '../evidence/types.ts'
import type { Brain, BrainEvent, BrainMover, BrainQuote, Source, Theme, Upcoming } from './types.ts'
import { allEntities, getEntity, getLinks } from '../graph/index.ts'
import { isMarketNews, sameStory, sessionWindow, zoned } from '../evidence/engine.ts'
import { STRONG } from '../evidence/summary.ts'
import { isSameMarketDay, needsRecompute } from '../evidence/freshness.ts'

const r2 = (n: number) => Math.round(n * 100) / 100
const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const H = 3600_000, DAY = 24 * H

export const MARKET_CONF: Record<Market, {
  tz: string; tzLabel: string; benchmark: string; indices: string[]; volatility: string
  home: { country: string; currency: string }; macroCurrencies: string[]
}> = {
  US: { tz: 'America/New_York', tzLabel: 'ET', benchmark: '^GSPC', indices: ['^GSPC', '^IXIC', '^DJI', '^RUT'], volatility: '^VIX',
        home: { country: 'country:us', currency: 'currency:usd' }, macroCurrencies: ['USD'] },
  IN: { tz: 'Asia/Kolkata', tzLabel: 'IST', benchmark: '^NSEI', indices: ['^NSEI', '^BSESN', '^NSEBANK', 'NIFTYIT.NS', '^NSMIDCP'], volatility: '^INDIAVIX',
        home: { country: 'country:india', currency: 'currency:inr' }, macroCurrencies: ['INR', 'USD'] },
}

const YAHOO: Source = { name: 'Yahoo Finance' }
/** Display names for index symbols (feed labels are inconsistent: "NASDAQ", "FEAR INDEX"). */
const INDEX_NAME: Record<string, string> = {
  '^GSPC': 'S&P 500', '^IXIC': 'Nasdaq', '^DJI': 'Dow', '^RUT': 'Russell 2000', '^VIX': 'VIX',
  '^NSEI': 'Nifty 50', '^BSESN': 'Sensex', '^NSEBANK': 'Bank Nifty', 'NIFTYIT.NS': 'Nifty IT', '^NSMIDCP': 'Nifty Midcap', '^INDIAVIX': 'India VIX',
}
const dayIn = (t: number, tz: string) => new Date(t).toLocaleDateString('en-CA', { timeZone: tz })
const when = (q: Quote) => q.marketTime ?? q.at

function bq(q: Quote, score: number, source: Source = YAHOO, name = q.name): BrainQuote {
  return { symbol: q.symbol, name, changePct: q.changePct, change: q.change ?? null, source, at: when(q), score: r2(clamp01(score)) }
}

/** India has no sector ETFs in the app: average the Nifty 50 names per graph sector (n ≥ 2). */
export function indiaSectors(quotes: Record<string, Quote>): { id: string; name: string; changePct: number; n: number; at: number }[] {
  const groups = new Map<string, Quote[]>()
  for (const q of Object.values(quotes)) {
    const s = getEntity(q.symbol)?.sector
    if (s) groups.set(s, [...(groups.get(s) ?? []), q])
  }
  return [...groups].filter(([, qs]) => qs.length >= 2).map(([id, qs]) => ({
    id, name: getEntity(id)?.name ?? id, n: qs.length,
    changePct: qs.reduce((a, q) => a + q.changePct, 0) / qs.length, at: Math.max(...qs.map(when)),
  }))
}

// ── Outlets: "Economic Times" / "Economic Times Markets", "Guardian Business" /
// "Guardian Politics" are one source. Keyed on the first significant word.
/** ponytail: unrelated outlets sharing a first word ("Business Standard", "Business Today")
 *  merge too — that only makes the ≥2-sources bar stricter, never looser. */
export function outletKey(name: string): string {
  return name.toLowerCase().replace(/\(google news\)/g, '').replace(/^the\s+/, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ')[0] ?? ''
}

// ── Themes ───────────────────────────────────────────────────────────────────
const PEER_LINKS = new Set(['competitor_of', 'supplier_of', 'subsidiary_of'])

function themeKeys(h: Headline, market: Market): { id: string; kind: Theme['kind'] }[] {
  const { home } = MARKET_CONF[market]
  const keys: { id: string; kind: Theme['kind'] }[] = []
  for (const id of h.entities) {
    const e = getEntity(id)
    if (!e) continue
    if (e.type === 'sector' || e.type === 'commodity') keys.push({ id, kind: e.type })
    else if (e.type === 'country' && id !== home.country) keys.push({ id, kind: 'country' })
    else if (e.type === 'region') keys.push({ id, kind: 'region' })
    else if (e.type === 'currency' && id !== home.currency) keys.push({ id, kind: 'currency' })
    else if (e.type === 'company') {
      // Only this market's listed companies group into its sector/cluster themes
      // (Microsoft news is not an Indian IT theme).
      if ((market === 'IN') !== id.endsWith('.NS')) continue
      if (e.sector) keys.push({ id: e.sector, kind: 'sector' })
      keys.push({ id: `cluster:${id}`, kind: 'cluster' })
      for (const v of getLinks(id)) if (PEER_LINKS.has(v.link.type) && v.other.type === 'company') keys.push({ id: `cluster:${v.other.id}`, kind: 'cluster' })
    }
  }
  return keys
}

/** Related price moves for a theme (empty → the theme is not shown). */
function relatedMoves(id: string, kind: Theme['kind'], ctx: MarketContext, inSectors: ReturnType<typeof indiaSectors>): BrainQuote[] {
  const out: BrainQuote[] = []
  const stock = (sym: string, min: number) => { const q = ctx.quotes[sym]; if (q && Math.abs(q.changePct) >= min) out.push(bq(q, Math.abs(q.changePct) / 5, YAHOO, getEntity(sym)?.name ?? q.name)) }
  if (kind === 'sector') {
    const etf = ctx.sectorEtfs[id]
    if (etf && Math.abs(etf.changePct) >= 0.5) out.push(bq(etf, Math.abs(etf.changePct) / 2, { name: `${etf.etf} (Yahoo Finance)` }, `${getEntity(id)?.name ?? id} (${etf.etf})`))
    const avg = inSectors.find(s => s.id === id)
    if (ctx.market === 'IN' && avg && Math.abs(avg.changePct) >= 0.5) {
      out.push({ symbol: id, name: `${avg.name} (avg of ${avg.n} Nifty 50 stocks)`, changePct: avg.changePct, source: { name: 'Nifty 50 constituents (Yahoo Finance)' }, at: avg.at, score: r2(clamp01(Math.abs(avg.changePct) / 2)) })
    }
    for (const q of Object.values(ctx.quotes)) if (getEntity(q.symbol)?.sector === id) stock(q.symbol, 2)
  } else if (kind === 'commodity') {
    const c = ctx.commodities[id]
    if (c && Math.abs(c.changePct) >= 1) out.push(bq(c, Math.abs(c.changePct) / 3, { name: `${c.name} futures (Yahoo Finance)` }))
    for (const v of getLinks(id)) if (v.direction === 'in' && v.link.type === 'exposed_to') stock(v.other.id, 2)
  } else if (kind === 'country') {
    for (const v of getLinks(id)) {
      if (v.direction === 'in' && v.link.type === 'benchmark_of') {
        for (const sym of v.other.symbols ?? []) { const q = ctx.globalIndices[sym] ?? ctx.indices[sym]; if (q && Math.abs(q.changePct) >= 0.5) out.push(bq(q, Math.abs(q.changePct) / 2)) }
      }
      if (v.direction === 'in' && v.link.type === 'currency_of') { const c = ctx.currencies[v.other.id]; if (c && Math.abs(c.changePct) >= 0.25) out.push(bq(c, Math.abs(c.changePct) / 0.8)) }
    }
    for (const e of allEntities()) if (e.type === 'company' && e.country === id) stock(e.id, 2)
  } else if (kind === 'currency') {
    const c = ctx.currencies[id]
    if (c && Math.abs(c.changePct) >= 0.25) out.push(bq(c, Math.abs(c.changePct) / 0.8))
  } else if (kind === 'cluster') {
    const hub = id.slice('cluster:'.length)
    for (const sym of [hub, ...getLinks(hub).filter(v => PEER_LINKS.has(v.link.type)).map(v => v.other.id)]) stock(sym, 1.5)
  }
  const seen = new Set<string>()
  return out.filter(q => !seen.has(q.symbol) && seen.add(q.symbol)).sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 4)
}

// ── Topics for country / region themes (fixed list + graph entities) ──────────
// A country or region theme is titled "<place> — <topic>" and needs its own
// ≥3 stories from ≥2 outlets plus a related move (the place's market/currency, or the topic's own).
function dedupeMoves(ms: BrainQuote[]): BrainQuote[] {
  const seen = new Set<string>()
  return ms.filter(q => !seen.has(q.symbol) && seen.add(q.symbol)).sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 4)
}
const hasEntity = (h: Headline, pred: (id: string) => boolean) => h.entities.some(pred)
const sectorMove = (sectorId: string, ctx: MarketContext, inSectors: ReturnType<typeof indiaSectors>): BrainQuote[] => {
  const etf = ctx.sectorEtfs[sectorId]
  if (etf && Math.abs(etf.changePct) >= 0.5) return [bq(etf, Math.abs(etf.changePct) / 2, { name: `${etf.etf} (Yahoo Finance)` }, `${getEntity(sectorId)?.name ?? sectorId} (${etf.etf})`)]
  const avg = inSectors.find(s => s.id === sectorId)
  if (ctx.market === 'IN' && avg && Math.abs(avg.changePct) >= 0.5) return [{ symbol: sectorId, name: `${avg.name} (avg of ${avg.n} Nifty 50 stocks)`, changePct: avg.changePct, source: { name: 'Nifty 50 constituents (Yahoo Finance)' }, at: avg.at, score: r2(clamp01(Math.abs(avg.changePct) / 2)) }]
  return []
}
interface Topic { id: string; label: (place: string) => string; match: (h: Headline) => boolean; moves: (ctx: MarketContext, inSectors: ReturnType<typeof indiaSectors>) => BrainQuote[] }
export const TOPICS: Topic[] = [
  { id: 'rates', label: p => (p === 'country:us' ? 'Fed / rates' : 'rates / central bank'),
    match: h => /\b(Fed|FOMC|Federal Reserve|central bank|RBI|ECB|BOJ|Bank of (England|Japan)|PBOC|rate (cut|hike)s?|interest rates?|policy rate|repo rate|rate path|yields?|bonds?|Treasur(y|ies))\b/i.test(h.title),
    moves: ctx => Object.values(ctx.rates ?? {}).filter(y => Math.abs((y.change ?? 0) * 100) >= 5).map(y => bq(y, Math.abs((y.change ?? 0) * 100) / 15)) },
  { id: 'trade', label: () => 'tariffs / trade',
    match: h => /\b(tariffs?|trade (deal|war|talks|pact|deficit|surplus|tensions?)|exports?|imports?|sanctions?|customs dut(y|ies)|export curbs?)\b/i.test(h.title),
    moves: () => [] },
  { id: 'tech', label: () => 'tech',
    match: h => /\b(tech|technology|AI|chips?|chipmakers?|semiconductors?|software|cloud|data cent(er|re)s?)\b/i.test(h.title) || hasEntity(h, id => id === 'sector:information-technology' || getEntity(id)?.sector === 'sector:information-technology'),
    moves: (ctx, s) => sectorMove('sector:information-technology', ctx, s) },
  { id: 'energy', label: () => 'oil / energy',
    match: h => /\b(oil|crude|OPEC\+?|Brent|WTI|natural gas|LNG|energy|fuel|refiner(y|ies|s)?)\b/i.test(h.title) || hasEntity(h, id => id === 'commodity:crude-oil' || id === 'commodity:natural-gas' || id === 'sector:energy'),
    moves: (ctx, s) => [...['commodity:crude-oil', 'commodity:natural-gas'].map(id => ctx.commodities[id]).filter((c): c is Quote => !!c && Math.abs(c.changePct) >= 1).map(c => bq(c, Math.abs(c.changePct) / 3, { name: `${c.name} futures (Yahoo Finance)` })), ...sectorMove('sector:energy', ctx, s)] },
  { id: 'economy', label: () => 'economy / inflation',
    match: h => /\b(inflation|CPI|jobs|payrolls|unemployment|GDP|recession|economy|economic growth|consumer spending|PMI|retail sales)\b/i.test(h.title),
    moves: () => [] },
  { id: 'currency', label: () => 'currency',
    match: h => /\b(dollar|rupee|yen|yuan|renminbi|euro|sterling|currency|forex)\b/i.test(h.title) || hasEntity(h, id => getEntity(id)?.type === 'currency'),
    moves: ctx => Object.values(ctx.currencies).filter(c => Math.abs(c.changePct) >= 0.25).map(c => bq(c, Math.abs(c.changePct) / 0.8)) },
]

export function buildThemes(ctx: MarketContext, win: { start: number; end: number }, inSectors = indiaSectors(ctx.quotes)): Theme[] {
  const groups = new Map<string, { kind: Theme['kind']; hs: Headline[] }>()
  for (const h of ctx.headlines) {
    if (h.publishedAt <= win.start || h.publishedAt > win.end) continue
    // General news flow only (per-ticker searches would bias themes toward the movers),
    // and only real market/company news — no listicles, opinion, recaps or questions.
    if (h.via === 'ticker' || !isMarketNews(h.title)) continue
    for (const k of themeKeys(h, ctx.market)) {
      const g = groups.get(k.id) ?? groups.set(k.id, { kind: k.kind, hs: [] }).get(k.id)!
      if (!g.hs.includes(h)) g.hs.push(h)
    }
  }
  const themes: (Theme & { ids: Set<number> })[] = []
  /** A theme from these stories, or null if it misses the bar (≥3 stories, ≥2 outlets, ≥1 related move). */
  const make = (id: string, kind: Theme['kind'], stories: Headline[], moves: BrainQuote[], title: string, topic?: string) => {
    const sources = new Set(stories.map(h => outletKey(h.source)))
    if (stories.length < 3 || sources.size < 2 || !moves.length) return
    const tone = { positive: 0, negative: 0, neutral: 0 }
    for (const h of stories) tone[h.sentiment === 'BULLISH' ? 'positive' : h.sentiment === 'BEARISH' ? 'negative' : 'neutral']++
    themes.push({
      id, kind, topic, title,
      score: r2(0.5 * Math.min(stories.length / 8, 1) + 0.2 * Math.min(sources.size / 4, 1) + 0.3 * Math.min(Math.abs(moves[0].changePct) / 3, 1)),
      stories: stories.length, sources: sources.size,
      headlines: stories.slice(0, 8).map(h => ({ title: h.title, source: { name: h.source, url: h.url }, at: h.publishedAt, tone: h.sentiment })),
      moves, tone, ids: new Set(stories.map(h => h.id)),
    })
  }
  for (const [id, { kind, hs }] of groups) {
    // distinct stories: newest first, near-duplicates merged
    const stories: Headline[] = []
    for (const h of [...hs].sort((a, b) => b.publishedAt - a.publishedAt)) if (!stories.some(s => sameStory(s.title, h.title))) stories.push(h)
    const place = getEntity(id)
    if (kind === 'country' || kind === 'region') {
      // A place alone is too broad ("United States"): split by the specific shared
      // topic in its headlines; a topic needs the same bar on its own, else no theme.
      const placeMoves = relatedMoves(id, kind, ctx, inSectors)
      for (const t of TOPICS) {
        const ts = stories.filter(h => t.match(h))
        const moves = dedupeMoves([...t.moves(ctx, inSectors), ...placeMoves])
        make(`${id}#${t.id}`, kind, ts, moves, `${place?.name ?? id} — ${t.label(id)}`, t.id)
      }
      continue
    }
    if (kind === 'cluster') {
      // a cluster needs ≥2 different companies in its headlines, else it is one company's news
      const companies = new Set(stories.flatMap(h => h.entities.filter(e => getEntity(e)?.type === 'company')))
      if (companies.size < 2) continue
    }
    const hub = kind === 'cluster' ? getEntity(id.slice(8)) : place
    make(id, kind, stories, relatedMoves(id, kind, ctx, inSectors), kind === 'cluster' ? `${hub?.name ?? id} & linked companies` : hub?.name ?? id)
  }
  // Keep the strongest; drop a theme whose stories are ≥70% inside a stronger one.
  const kept: typeof themes = []
  for (const t of themes.sort((a, b) => b.score - a.score)) {
    if (kept.some(k => [...t.ids].filter(i => k.ids.has(i)).length / t.ids.size >= 0.7)) continue
    kept.push(t)
    if (kept.length === 5) break
  }
  return kept.map(({ ids, ...t }) => t)
}

// ── World events touching listed companies / countries / commodities ──────────
function worldEvents(ctx: MarketContext): BrainEvent[] {
  const now = ctx.builtAt
  const out: BrainEvent[] = []
  for (const e of ctx.events) {
    let base = 0
    if (e.kind === 'earthquake' && (e.magnitude ?? 0) >= 6 && now - e.at <= 48 * H) base = e.magnitude! >= 7 ? 0.55 : e.magnitude! >= 6.5 ? 0.4 : 0.3
    if (e.kind === 'outbreak' && now - e.at <= 14 * DAY) base = 0.15
    if (!base || !e.countries.length) continue
    const touches: BrainEvent['touches'] = []
    const add = (id: string, name: string, type: string, via: string) => { if (!touches.some(t => t.id === id)) touches.push({ id, name, type, via }) }
    for (const c of e.countries) {
      const country = getEntity(c)
      if (!country) continue
      add(c, country.name, 'country', 'location')
      for (const co of allEntities()) if (co.type === 'company' && co.country === c) {
        add(co.id, co.name, 'company', 'headquartered there')
        for (const v of getLinks(co.id)) if (v.direction === 'out' && v.link.type === 'supplier_of') add(v.other.id, v.other.name, 'company', `customer of ${co.name}`)
      }
      for (const v of getLinks(c)) {
        if (v.direction === 'in' && v.link.type === 'exposed_to' && v.other.type === 'company') add(v.other.id, v.other.name, 'company', `exposed to ${country.name}`)
        if (v.direction === 'out' && v.link.type === 'major_producer_of') add(v.other.id, v.other.name, 'commodity', `${country.name} is a major producer`)
      }
    }
    const material = touches.some(t => t.type !== 'country')
    out.push({ kind: e.kind, title: e.title, source: { name: e.kind === 'earthquake' ? 'USGS' : 'WHO Disease Outbreak News', url: e.url }, at: e.at,
      score: r2(base * (material ? 1 : 0.6)), touches: touches.slice(0, 8) })
  }
  return out.sort((a, b) => b.score - a.score || b.at - a.at).slice(0, 5)
}

// ── Upcoming scheduled events ──────────────────────────────────────────────────
function upcoming(ctx: MarketContext): Upcoming[] {
  const { tz, macroCurrencies } = MARKET_CONF[ctx.market]
  const now = ctx.builtAt, horizon = now + 7 * DAY
  const out: Upcoming[] = []
  for (const m of ctx.macro) {
    if (!macroCurrencies.includes(m.currency) || !m.date) continue
    // A foreign currency's events only when high impact (India brain: USD high-impact releases).
    if (m.currency !== macroCurrencies[0] && m.impact !== 'high') continue
    if (m.impact === 'low') continue
    const [hh, mm] = /^\d\d:\d\d$/.test(m.time) ? m.time.split(':').map(Number) : [0, 0]
    const at = zoned(m.date, [hh, mm], 'America/New_York') // the calendar publishes ET times
    if (at < now || at > horizon) continue
    out.push({ kind: 'macro', title: `${m.title} (${m.currency})`, at, dateLabel: `${m.date}${m.time ? ` ${m.time} ET` : ''}`, impact: m.impact,
      source: { name: 'Economic calendar' }, score: m.impact === 'high' ? 0.8 : 0.5 })
  }
  for (const e of ctx.earnings) {
    const ent = getEntity(e.symbol)
    if (!ent && !ctx.quotes[e.symbol]) continue // only companies the app follows
    const at = zoned(e.date, e.timing === 'BMO' ? [9, 30] : e.timing === 'AMC' ? [16, 0] : [0, 0], tz)
    if (at < now - 12 * H || at > horizon) continue
    out.push({ kind: 'earnings', title: `${ent?.name ?? e.symbol} earnings`, at,
      dateLabel: `${e.date}${e.timing === 'BMO' ? ' before open' : e.timing === 'AMC' ? ' after close' : ''}`,
      source: { name: 'Nasdaq earnings calendar' }, score: ent ? 0.6 : 0.4 })
  }
  return out.sort((a, b) => a.at - b.at).slice(0, 6)
}

// ── Build ────────────────────────────────────────────────────────────────────
export interface BrainInput {
  ctx: MarketContext
  explanations: Record<string, Explanation>
  /** Exchange session status at build time ('OPEN', 'CLOSED', …), from the server. */
  status: string
}

export function buildBrain({ ctx, explanations, status }: BrainInput): Brain {
  const conf = MARKET_CONF[ctx.market]
  const now = ctx.builtAt
  const bench = ctx.indices[conf.benchmark]
  const lastTrade = bench ? when(bench) : null

  // Market state
  const indices = conf.indices.map(s => ctx.indices[s]).filter((q): q is Quote => !!q).map(q => bq(q, Math.abs(q.changePct) / 2, YAHOO, INDEX_NAME[q.symbol] ?? q.name))
  const inSectors = indiaSectors(ctx.quotes)
  let breadth: Brain['state']['breadth'] = null
  const tally = (moves: number[]) => ({ advancing: moves.filter(m => m > 0.05).length, declining: moves.filter(m => m < -0.05).length, unchanged: moves.filter(m => Math.abs(m) <= 0.05).length })
  if (ctx.market === 'US') {
    const etfs = Object.values(ctx.sectorEtfs)
    if (etfs.length) { const t = tally(etfs.map(q => q.changePct)); breadth = { ...t, universe: `${etfs.length} SPDR sector ETFs`, source: { name: 'Sector ETFs (Yahoo Finance)' }, at: Math.max(...etfs.map(when)), score: r2(Math.abs(t.advancing - t.declining) / etfs.length) } }
  } else {
    const qs = Object.values(ctx.quotes)
    if (qs.length) { const t = tally(qs.map(q => q.changePct)); breadth = { ...t, universe: `${qs.length} Nifty 50 stocks`, source: { name: 'Nifty 50 constituents (Yahoo Finance)' }, at: Math.max(...qs.map(when)), score: r2(Math.abs(t.advancing - t.declining) / qs.length) } }
  }
  const benchWhy = explanations[conf.benchmark]

  // Sector picture
  const sectorQuotes: BrainQuote[] = ctx.market === 'US'
    ? Object.entries(ctx.sectorEtfs).map(([id, q]) => bq(q, Math.abs(q.changePct) / 2, { name: `${q.etf} (Yahoo Finance)` }, `${getEntity(id)?.name ?? q.name} (${q.etf})`))
    : inSectors.map(s => ({ symbol: s.id, name: `${s.name} (${s.n} stocks)`, changePct: s.changePct, source: { name: 'Nifty 50 constituents (Yahoo Finance)' }, at: s.at, score: r2(clamp01(Math.abs(s.changePct) / 2)) }))
  const bySector = [...sectorQuotes].sort((a, b) => b.changePct - a.changePct)

  // Top movers with their evidence (strong drivers only)
  const stocks = Object.values(explanations).filter(e => e.kind === 'stock').sort((a, b) => b.snapshot.changePct - a.snapshot.changePct)
  const toMover = (e: Explanation): BrainMover => ({
    symbol: e.id, name: e.name, changePct: e.snapshot.changePct, source: YAHOO, at: e.snapshot.at, score: r2(clamp01(Math.abs(e.snapshot.changePct) / 5)),
    summary: e.summary,
    drivers: e.drivers.filter(d => d.score >= STRONG && d.type !== 'no_clear_driver').map(d => ({ type: d.type, label: d.label, score: d.score, source: d.source, at: d.timestamp })),
  })
  const movers = [...stocks.filter(e => e.snapshot.changePct > 0).slice(0, 3), ...stocks.filter(e => e.snapshot.changePct < 0).slice(-3).reverse()].map(toMover)

  // Cross-asset: what moved notably
  const checked: string[] = []
  const cross: BrainQuote[] = []
  for (const c of Object.values(ctx.commodities)) { checked.push(c.name); if (Math.abs(c.changePct) >= 1) cross.push(bq(c, Math.abs(c.changePct) / 3, { name: `${c.name} futures (Yahoo Finance)` })) }
  for (const c of Object.values(ctx.currencies)) { checked.push(c.name); if (Math.abs(c.changePct) >= 0.25) cross.push(bq(c, Math.abs(c.changePct) / 0.8)) }
  for (const y of Object.values(ctx.rates ?? {})) {
    checked.push(y.name)
    const bp = (y.change ?? 0) * 100
    if (Math.abs(bp) >= 5) cross.push(bq(y, Math.abs(bp) / 15))
  }
  const vol = ctx.indices[conf.volatility]
  if (vol) { const n = INDEX_NAME[vol.symbol] ?? vol.name; checked.push(n); if (Math.abs(vol.changePct) >= 5) cross.push(bq(vol, Math.abs(vol.changePct) / 15, YAHOO, n)) }
  cross.sort((a, b) => b.score - a.score)

  // Themes over the session's headlines
  const win = sessionWindow(bench ?? { marketTime: null }, ctx.market, now)

  return {
    market: ctx.market, builtAt: now,
    session: { status, date: dayIn(lastTrade ?? now, conf.tz), lastTrade },
    snapshot: { at: now, indices: Object.fromEntries([...indices, ...(vol ? [bq(vol, 0)] : [])].map(q => [q.symbol, q.changePct])) },
    state: { indices, breadth, indexWhy: benchWhy && benchWhy.summary !== 'no clear driver found' && benchWhy.summary !== 'little changed' ? benchWhy.summary : null },
    sectors: { strongest: bySector.slice(0, 3), weakest: bySector.slice(-3).reverse(), basis: ctx.market === 'US' ? 'SPDR sector ETFs' : 'average of Nifty 50 stocks per sector' },
    movers, crossAsset: cross, crossAssetChecked: checked,
    events: worldEvents(ctx),
    themes: buildThemes(ctx, win, inSectors),
    upcoming: upcoming(ctx),
    inputs: ctx.inputs,
  }
}

// ── Accuracy ─────────────────────────────────────────────────────────────────
/**
 * Why a cached brain must be rebuilt before it is shown, or null if it is current:
 * built on another market day, or an index move flipped / drifted > 1.5pt since the snapshot.
 */
export function rebuildReason(brain: Pick<Brain, 'market' | 'builtAt' | 'snapshot'>, liveIndices: Record<string, number>, now: number): string | null {
  if (!isSameMarketDay(brain.builtAt, now, brain.market)) return 'built on a previous day'
  for (const [sym, snap] of Object.entries(brain.snapshot.indices)) {
    const live = liveIndices[sym]
    if (typeof live === 'number' && needsRecompute({ changePct: snap }, live)) return `${sym} moved from ${snap.toFixed(2)}% to ${live.toFixed(2)}%`
  }
  return null
}

/** A copy of the brain with every on-screen % replaced by its live value (numbers never come from cached text). */
export function withLive(brain: Brain, live: Record<string, { changePct: number; change?: number | null; at: number }>): Brain {
  const fix = <T extends BrainQuote>(q: T): T => { const l = live[q.symbol]; return l ? { ...q, changePct: l.changePct, change: l.change ?? q.change, at: l.at } : q }
  return {
    ...brain,
    state: { ...brain.state, indices: brain.state.indices.map(fix) },
    sectors: { ...brain.sectors, strongest: brain.sectors.strongest.map(fix), weakest: brain.sectors.weakest.map(fix) },
    movers: brain.movers.map(fix),
    crossAsset: brain.crossAsset.map(fix),
    themes: brain.themes.map(t => ({ ...t, moves: t.moves.map(fix) })),
  }
}
