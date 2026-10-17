// Scenario Engine — pure: no I/O, no clock reads, no AI. Every magnitude comes from
// data/scenario/sensitivities.json (passed in); event presets are directional only.
//
//   direct      b × shock, with a 90% band (b ± 1.645·SE) × shock      (SE: HC1 robust)
//   market part bMarket × c × shock — the stock's market beta times the market's own
//               typical reaction to the factor; included only when that reaction is reliable
//   total       direct + market part (band shifted by the market part)
//   sector bar  the sector fund/index's own total effect; where no fund exists, the median
//               total of the sector's reliable constituents, with the count — only when ≥ 3 have one
//   indirect    graph supplier/customer links of estimated stocks — named, never given a number
// Sensitivities that miss the reliability rule never produce numbers ("no reliable historical link").
import { FACTORS, MARKET_CONTROL, MARKET_FACTORS, SECTOR_FUNDS, shockLabel, type FactorId, type Market, type Unit } from './factors.ts'
import { oilFor, PRESETS, presetBlurb, presetById, presetFactor, presetSize, presetTitle, type EventPreset, type PresetId } from './presets.ts'
import { allEntities, getEntity, getLinks } from '../graph/index.ts'
import { BANNED } from '../evidence/summary.ts'
import { pct } from '../format.ts'

// ── Data file shape ──────────────────────────────────────────────────────────
export interface Fit { b: number; se: number; t: number; r2: number; n: number; bMarket: number; halves: [number, number] | null; freq: 'daily' | 'weekly'; path: string | null; reliable: boolean }
export interface Entry { name: string; market: Market; sector: string | null; industry?: string | null; members?: string[] | null; window: { start: string; end: string }; factors: Partial<Record<FactorId, Fit>> }
export interface MarketFit { c: number; se: number; t: number; n: number; halves: [number, number] | null; freq: string; reliable: boolean }
export interface FactorMeta { name: string; symbol: string; unit: Unit; freq: 'daily' | 'weekly'; window: { start: string; end: string }; moves20d: { n: number; min: number; p1: number; p5: number; p50: number; p95: number; p99: number; max: number } }
export interface SensitivityData {
  meta: { generatedAt: string; window: { daily: { start: string; end: string }; weekly: { start: string; end: string } }; reliableRule: string; counts: Record<string, unknown> }
  factors: Record<FactorId, FactorMeta>
  market: Record<Market, Partial<Record<FactorId, MarketFit>>>
  stocks: Record<string, Entry>
  sectors: Record<string, Entry>
}

// ── Results ──────────────────────────────────────────────────────────────────
export type Quality = 'strong' | 'moderate' | 'fair'
export interface Impact {
  symbol: string; name: string; industry: string | null
  total: number; low: number; high: number          // % move, 90% band
  direct: number; marketPart: number
  fit: { t: number; r2: number; n: number; freq: 'daily' | 'weekly'; quality: Quality }
  path: string | null
  text: string
}
export interface SectorBar { id: string; name: string; basis: 'fund' | 'median'; symbol?: string; total: number | null; low?: number; high?: number; count?: { reliable: number; of: number }; path?: string | null; note: string }
export interface Indirect { symbol: string; name: string; link: string; from: { symbol: string; name: string; total: number }; text: string }
export interface EventTouch { symbol: string; name: string; direction: 'hurt' | 'helped'; path: string; reason: string }

export interface ScenarioResult {
  market: Market
  kind: 'factor' | 'event'
  preset: PresetId | null
  title: string
  description: string
  factor?: { id: FactorId; name: string; symbol: string; unit: Unit; shock: number; label: string; freq: 'daily' | 'weekly' }
  range?: { p5: number; p95: number; beyond: boolean; text: string }
  window: { start: string; end: string; freq: 'daily' | 'weekly' }
  generatedAt: string
  marketReaction?: { name: string; reliable: boolean; value: number | null; low: number | null; high: number | null; text: string }
  stocks: Impact[]
  hurt: Impact[]
  helped: Impact[]
  notEstimated: { symbol: string; name: string }[]
  sectors: SectorBar[]
  indirect: Indirect[]
  event?: EventTouch[]
  notes: string[]
}

export const Z90 = 1.645
/** Fewest constituents with a reliable link for a constituent-median sector bar (sector funds/indices need none). */
export const MIN_MEDIAN = 3
/** Our own wording must never claim cause or predict. */
export const SCENARIO_BANNED = /\b(will|predict\w*|forecast\w*|because|caus(e|ed|es|ing))\b/i
export function assertScenarioWording(text: string): void {
  if (SCENARIO_BANNED.test(text) || BANNED.test(text)) throw new Error(`scenario wording rule violated: ${text}`)
}

const quality = (t: number): Quality => (Math.abs(t) >= 6 ? 'strong' : Math.abs(t) >= 4 ? 'moderate' : 'fair')
const p1 = (n: number) => pct(n, 1, '−')
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const unitWord = (u: Unit) => (u === 'pct' ? 'percent' : u === 'bp' ? 'basis points' : 'points')

/** null if acceptable, else why not. */
export function validateShock(market: Market, factor: FactorId, shock: number): string | null {
  if (!MARKET_FACTORS[market].includes(factor)) return `${FACTORS[factor].name} is not estimated for ${market === 'US' ? 'US' : 'Indian'} stocks${factor === 'wti' || factor === 'brent' ? ` (use ${FACTORS[oilFor(market)].name})` : ''}`
  if (!Number.isFinite(shock)) return 'shock must be a number'
  const max = FACTORS[factor].maxShock
  if (Math.abs(shock) > max) return `shock must be between −${max} and +${max} ${unitWord(FACTORS[factor].unit)}`
  return null
}

function impactOf(symbol: string, e: Entry, fit: Fit, f: FactorId, shock: number, mkt: MarketFit | undefined, market: Market): Impact {
  const direct = fit.b * shock
  const band = [(fit.b - Z90 * fit.se) * shock, (fit.b + Z90 * fit.se) * shock].sort((a, b) => a - b)
  const marketPart = mkt?.reliable ? fit.bMarket * mkt.c * shock : 0
  const total = direct + marketPart
  const name = e.name
  const text = `Historically, when ${FACTORS[f].name} moved ${shockLabel(shock, FACTORS[f].unit)}, ${name} tended to move ${p1(total)} (90% range ${p1(band[0] + marketPart)} to ${p1(band[1] + marketPart)})`
    + (mkt?.reliable && Math.abs(marketPart) >= 0.05 ? `: ${p1(direct)} direct and ${p1(marketPart)} with the ${MARKET_CONTROL[market].name}'s typical reaction.` : '.')
  return { symbol, name, industry: e.industry ?? null, total, low: band[0] + marketPart, high: band[1] + marketPart, direct, marketPart,
    fit: { t: fit.t, r2: fit.r2, n: fit.n, freq: fit.freq, quality: quality(fit.t) }, path: fit.path, text }
}

function sectorBars(data: SensitivityData, market: Market, f: FactorId, shock: number, mkt: MarketFit | undefined, impacts: Map<string, Impact>): SectorBar[] {
  const stocks = Object.entries(data.stocks).filter(([, e]) => e.market === market)
  const sectorIds = [...new Set(stocks.map(([, e]) => e.sector).filter((s): s is string => !!s))]
  const bars: SectorBar[] = []
  const fundBar = (symbol: string, id: string, name: string): SectorBar => {
    const e = data.sectors[symbol], fit = e?.factors[f]
    if (!fit?.reliable) return { id, name, basis: 'fund', symbol, total: null, note: 'no reliable historical link' }
    const i = impactOf(symbol, e, fit, f, shock, mkt, market)
    return { id, name, basis: 'fund', symbol, total: i.total, low: i.low, high: i.high, path: fit.path, note: `${symbol} sector fund/index, ${fit.freq} moves` }
  }
  for (const sid of sectorIds) {
    const name = getEntity(sid)?.name ?? sid
    const fund = SECTOR_FUNDS.find(x => x.market === market && x.sector === sid && data.sectors[x.symbol])
    if (fund) { bars.push(fundBar(fund.symbol, sid, fund.name)); continue }
    const members = stocks.filter(([, e]) => e.sector === sid)
    const est = members.map(([s]) => impacts.get(s)).filter((i): i is Impact => !!i)
    // A median of one or two stocks is not a sector: no bar below MIN_MEDIAN (the stocks still appear individually).
    if (est.length >= MIN_MEDIAN) bars.push({ id: sid, name, basis: 'median', total: median(est.map(i => i.total)), count: { reliable: est.length, of: members.length }, note: `median of ${est.length} of ${members.length} constituents with a reliable link` })
  }
  for (const fund of SECTOR_FUNDS.filter(x => x.market === market && x.members && data.sectors[x.symbol])) bars.push(fundBar(fund.symbol, fund.symbol, fund.name))
  return bars.sort((a, b) => (b.total ?? -Infinity) - (a.total ?? -Infinity))
}

/** Graph supplier/customer neighbours of estimated stocks that have no estimate of their own. */
function indirectLinks(impacts: Map<string, Impact>, market: Market): Indirect[] {
  const out: Indirect[] = []
  for (const [sym, i] of impacts) for (const v of getLinks(sym)) {
    if (v.link.type !== 'supplier_of' || impacts.has(v.other.id) || v.other.type !== 'company' || (market === 'IN') !== v.other.id.endsWith('.NS')) continue
    if (out.some(o => o.symbol === v.other.id && o.from.symbol === sym)) continue
    const link = v.direction === 'out' ? `customer of ${i.name}` : `supplier to ${i.name}`
    out.push({ symbol: v.other.id, name: v.other.name, link, from: { symbol: sym, name: i.name, total: i.total },
      text: `Indirect: ${v.other.name} is a ${link} (${i.name}: ${p1(i.total)}); no estimate of its own.` })
  }
  return out
}

function eventTouches(p: EventPreset, market: Market, universe: Set<string>): EventTouch[] {
  const out: EventTouch[] = []
  const add = (id: string, path: string, r: { direction: 'hurt' | 'helped'; reason: string }) => {
    const e = getEntity(id)
    if (!e || e.type !== 'company' || !universe.has(id) || out.some(o => o.symbol === id)) return
    out.push({ symbol: id, name: e.name, direction: r.direction, path, reason: r.reason })
  }
  const companies = allEntities().filter(e => e.type === 'company')
  for (const r of p.rules) {
    if (r.rel === 'curated') { for (const id of r.ids) add(id, `${p.title} → ${getEntity(id)?.industry?.toLowerCase() ?? 'business'} → ${getEntity(id)?.name}`, r); continue }
    const origin = getEntity(r.origin)?.name ?? r.origin
    const hq = companies.filter(c => c.country === r.origin)
    if (r.rel === 'headquartered_in') for (const c of hq) add(c.id, `${origin} → headquartered there → ${c.name}`, r)
    if (r.rel === 'customers_of_hq_in') for (const c of hq) for (const v of getLinks(c.id)) if (v.link.type === 'supplier_of' && v.direction === 'out') add(v.other.id, `${origin} → ${c.name} → supplies ${v.other.name}`, r)
    if (r.rel === 'suppliers_to_hq_in') for (const c of hq) for (const v of getLinks(c.id)) if (v.link.type === 'supplier_of' && v.direction === 'in') add(v.other.id, `${origin} → ${c.name} → supplied by ${v.other.name}`, r)
    if (r.rel === 'exposed_to') for (const v of getLinks(r.origin)) if (v.link.type === 'exposed_to' && v.direction === 'in') add(v.other.id, `${origin} → ${v.link.reason.toLowerCase()} → ${v.other.name}`, r)
  }
  return out
}

export type ScenarioInput = { market: Market; preset: PresetId } | { market: Market; factor: FactorId; shock: number }

/** Run a preset or a custom single-factor shock for one market. Throws on invalid input. */
export function runScenario(data: SensitivityData, input: ScenarioInput): ScenarioResult {
  const { market } = input
  const preset = 'preset' in input ? presetById(input.preset) : undefined
  if ('preset' in input && (!preset || !preset.markets.includes(market))) throw new Error(`unknown preset for this market: ${input.preset}`)
  const universe = new Set(Object.entries(data.stocks).filter(([, e]) => e.market === market).map(([s]) => s))
  const notes = [
    'Historical estimates: what these stocks tended to do when the factor moved, measured over the data window. Relationships change over time.',
    `Only links that pass the reliability rule (${data.meta.reliableRule}) get a number; everything else is "no reliable historical link".`,
  ]

  if (preset?.kind === 'event') {
    const event = eventTouches(preset, market, universe)
    const r: ScenarioResult = { market, kind: 'event', preset: preset.id, title: preset.title, description: preset.blurb,
      window: { ...data.meta.window.daily, freq: 'daily' }, generatedAt: data.meta.generatedAt,
      stocks: [], hurt: [], helped: [], notEstimated: [], sectors: [], indirect: [], event,
      notes: ['Directional only: there is no measurable history for this event, so no percentages are shown. Links come from the Entity Graph or a curated business exposure, each with its reason.'] }
    for (const t of [r.description, ...r.notes, ...event.map(e => `${e.path} ${e.reason}`)]) assertScenarioWording(t)
    return r
  }

  const f: FactorId = preset?.kind === 'factor' ? presetFactor(preset, market) : (input as { factor: FactorId }).factor
  const size = preset?.kind === 'factor' ? presetSize(preset, market, data.factors) : null
  const shock = size ? size.shock : (input as { shock: number }).shock
  const invalid = validateShock(market, f, shock)
  if (invalid) throw new Error(invalid)
  const fm = data.factors[f], unit = FACTORS[f].unit, label = shockLabel(shock, unit)
  const mkt = data.market[market][f]

  const impacts = new Map<string, Impact>(), notEstimated: { symbol: string; name: string }[] = []
  for (const sym of universe) {
    const e = data.stocks[sym], fit = e.factors[f]
    if (fit?.reliable) impacts.set(sym, impactOf(sym, e, fit, f, shock, mkt, market))
    else notEstimated.push({ symbol: sym, name: e.name })
  }
  const stocks = [...impacts.values()].sort((a, b) => a.total - b.total)
  const beyond = shock > fm.moves20d.p95 || shock < fm.moves20d.p5
  const mName = MARKET_CONTROL[market].name
  const mBand = mkt?.reliable ? [(mkt.c - Z90 * mkt.se) * shock, (mkt.c + Z90 * mkt.se) * shock].sort((a, b) => a - b) : null
  const marketReaction = mkt?.reliable && mBand
    ? { name: mName, reliable: true, value: mkt.c * shock, low: mBand[0], high: mBand[1],
        text: `Historically, when ${FACTORS[f].name} moved ${label}, the ${mName} tended to move ${p1(mkt.c * shock)} (90% range ${p1(mBand[0])} to ${p1(mBand[1])}).` }
    : { name: mName, reliable: false, value: null, low: null, high: null, text: `The ${mName} itself shows no reliable historical link to ${FACTORS[f].name}.` }

  const window = fm.freq === 'weekly' ? { ...data.meta.window.weekly, freq: 'weekly' as const } : { ...data.meta.window.daily, freq: 'daily' as const }
  const range = { p5: fm.moves20d.p5, p95: fm.moves20d.p95, beyond,
    text: beyond
      ? `Beyond historical range — estimate less reliable: ${FACTORS[f].name}'s 20-day moves over ${data.meta.window.daily.start} to ${data.meta.window.daily.end} were between ${shockLabel(round1(fm.moves20d.p5), unit)} and ${shockLabel(round1(fm.moves20d.p95), unit)} 90% of the time.`
      : `Within the usual range of ${FACTORS[f].name}'s 20-day moves (${shockLabel(round1(fm.moves20d.p5), unit)} to ${shockLabel(round1(fm.moves20d.p95), unit)}).` }
  if (fm.freq === 'weekly') notes.push(`${FACTORS[f].name} links are measured on weekly returns over ${window.start} to ${window.end}.`)
  if (f === 'us10y' && market === 'IN') notes.push('Indian stocks are linked to US Treasury yields only where history shows a reliable link; Indian interest rates are not covered.')

  const result: ScenarioResult = {
    market, kind: 'factor', preset: preset?.id ?? null,
    title: preset?.kind === 'factor' && size ? presetTitle(preset, market, size) : `${FACTORS[f].name} ${label}`,
    description: preset?.kind === 'factor' && size ? presetBlurb(preset, market, size) : `Custom shock: ${FACTORS[f].name} moves ${label}.`,
    factor: { id: f, name: FACTORS[f].name, symbol: FACTORS[f].symbol, unit, shock, label, freq: fm.freq },
    range, window, generatedAt: data.meta.generatedAt, marketReaction,
    stocks,
    hurt: stocks.filter(i => i.total < 0).slice(0, 5),
    helped: stocks.filter(i => i.total > 0).reverse().slice(0, 5),
    notEstimated,
    sectors: sectorBars(data, market, f, shock, mkt, impacts),
    indirect: indirectLinks(impacts, market),
    notes,
  }
  for (const t of [result.title, result.description, range.text, marketReaction.text, ...notes, ...stocks.map(i => i.text), ...result.sectors.map(s => s.note), ...result.indirect.map(i => i.text)]) assertScenarioWording(t)
  return result
}
const round1 = (n: number) => Math.round(n * 10) / 10

// ── Portfolio ────────────────────────────────────────────────────────────────
export interface Holding { ticker: string; quantity: number; buyPrice: number }
export interface PortfolioLine {
  ticker: string; symbol: string | null; name: string; market: Market | null
  /** Weight: quantity × current price when the app has a cached price, else quantity × buy price. */
  weight: number; weightBasis: 'value' | 'cost'; weightNote: string
  impact: Impact | null; event?: EventTouch | null; reason?: string
}
export interface PortfolioResult {
  /** Per market (US holdings in USD, Indian in INR — never mixed without a rate). */
  groups: { market: Market; currency: 'USD' | 'INR'; weight: number; estimatedWeight: number; total: number | null; low: number | null; high: number | null; text: string }[]
  lines: PortfolioLine[]
  notEstimated: PortfolioLine[]
  notes: string[]
}

/** Map a stored ticker to the data file's symbol (RELIANCE → RELIANCE.NS when only that exists). */
export function resolveHolding(data: SensitivityData, ticker: string): string | null {
  const t = ticker.trim().toUpperCase()
  return data.stocks[t] ? t : data.stocks[`${t}.NS`] ? `${t}.NS` : null
}

export const VALUE_NOTE = 'weighted by current value (cached price)'
export const COST_NOTE = 'weighted by cost, no current price'

/**
 * The user's holdings under a scenario, weighted by current value — quantity × a recent
 * price (`prices`, by symbol, in the holding's own currency; see lib/scenario/prices.ts) — or,
 * when no cached price exists, by cost (quantity × buy price), labelled as such. Each
 * market's group runs its own version of the scenario (oil means WTI for US holdings,
 * Brent for Indian ones). The group range adds the holdings' bands as if they moved
 * together (the widest honest range).
 */
export function portfolioImpact(data: SensitivityData, input: { preset: PresetId } | { factor: FactorId; shock: number }, holdings: Holding[], prices: Record<string, number> = {}): PortfolioResult {
  const runs = new Map<Market, ScenarioResult | Error>()
  const runFor = (m: Market) => {
    if (!runs.has(m)) { try { runs.set(m, runScenario(data, { market: m, ...input } as ScenarioInput)) } catch (e) { runs.set(m, e as Error) } }
    return runs.get(m)!
  }
  const priceOf = (symbol: string | null, ticker: string) => {
    const p = (symbol && prices[symbol]) || prices[ticker.trim().toUpperCase()]
    return typeof p === 'number' && Number.isFinite(p) && p > 0 ? p : null
  }
  const bySym = new Map<string, PortfolioLine>()
  const notEstimated: PortfolioLine[] = []
  for (const h of holdings) {
    const symbol = resolveHolding(data, h.ticker), price = priceOf(symbol, h.ticker)
    const w = { weight: h.quantity * (price ?? h.buyPrice), weightBasis: (price ? 'value' : 'cost') as 'value' | 'cost', weightNote: price ? VALUE_NOTE : COST_NOTE }
    if (!symbol) { notEstimated.push({ ticker: h.ticker, symbol: null, name: h.ticker, market: null, ...w, impact: null, reason: 'not covered by the sensitivity data' }); continue }
    const prev = bySym.get(symbol)
    if (prev) { prev.weight += w.weight; continue } // same symbol → same price source
    const e = data.stocks[symbol], run = runFor(e.market)
    const line: PortfolioLine = { ticker: h.ticker, symbol, name: e.name, market: e.market, ...w, impact: null }
    if (run instanceof Error) line.reason = run.message
    else if (run.kind === 'event') { line.event = run.event?.find(t => t.symbol === symbol) ?? null; if (!line.event) line.reason = 'not linked to this event' }
    else { line.impact = run.stocks.find(i => i.symbol === symbol) ?? null; if (!line.impact) line.reason = 'no reliable historical link' }
    bySym.set(symbol, line)
  }
  const lines: PortfolioLine[] = []
  for (const l of bySym.values()) (l.impact || l.event ? lines : notEstimated).push(l)

  const groups = (['US', 'IN'] as Market[]).map(m => {
    const all = [...bySym.values()].filter(l => l.market === m), est = all.filter(l => l.impact)
    const weight = all.reduce((a, l) => a + l.weight, 0), estimatedWeight = est.reduce((a, l) => a + l.weight, 0)
    const avg = (k: 'total' | 'low' | 'high') => (estimatedWeight ? est.reduce((a, l) => a + l.weight * l.impact![k], 0) / estimatedWeight : null)
    const total = avg('total'), low = avg('low'), high = avg('high')
    const cur = m === 'US' ? 'USD' : 'INR', who = m === 'US' ? 'US' : 'Indian'
    // The percentage below is of ALL the group's weight, so the label describes all of it.
    const basis = all.every(l => l.weightBasis === 'value') ? 'value' : all.every(l => l.weightBasis === 'cost') ? 'cost' : 'value, cost where no current price'
    const text = !all.length ? '' : total === null
      ? `None of your ${who} holdings has a reliable historical link to this scenario.`
      : `Historically, under this scenario your ${who} holdings with a reliable link (${Math.round((estimatedWeight / weight) * 100)}% of their ${cur} ${basis}) tended to move ${p1(total)} (range ${p1(low!)} to ${p1(high!)}).`
    if (text) assertScenarioWording(text)
    return { market: m, currency: cur as 'USD' | 'INR', weight, estimatedWeight, total, low, high, text }
  }).filter(g => g.weight > 0)
  return {
    groups, lines, notEstimated,
    notes: [
      'Weights use current value (prices up to 5 minutes old, from the app’s caches or one shared lookup); a holding without a price uses cost (quantity × buy price) and is labelled.',
      'US and Indian holdings are shown separately in their own currency, never converted.',
      'Holdings without a reliable historical link are listed as not estimated — never guessed.',
    ],
  }
}

export { PRESETS, oilFor }
