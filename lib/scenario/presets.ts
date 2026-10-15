// Scenario presets. Factor presets are sized from history: each is the factor's 95th
// (up) or 5th (down) percentile 20-day move in data/scenario/sensitivities.json, rounded
// toward zero, so a default preset is never "beyond historical range" — a custom shock
// still can be. Every result magnitude comes from the data file. Event presets have no
// measurable history: they are directional only — which listed companies are linked to
// the event and how (graph links, or a curated business exposure with its reason) — and
// never show a percentage.
import { FACTORS, shockLabel, type FactorId, type Market, type Unit } from './factors.ts'

export type PresetId = 'oil-up' | 'oil-down' | 'rates-up' | 'rates-down' | 'inr-weak' | 'gold-up' | 'vix-spike' | 'taiwan-chips' | 'china-slowdown' | 'india-monsoon'

/** A factor preset is sized from history, not chosen: a large but ordinary 20-day move (see presetSize). */
export interface FactorPreset {
  id: PresetId; kind: 'factor'; name: string; what: string; markets: Market[]
  /** 'oil' = the market's own benchmark: WTI in the US, Brent in India. */
  factor: FactorId | 'oil'; side: 'up' | 'down'
}

/** The factor a preset or a request means in this market ('oil' → WTI in the US, Brent in India). */
export const oilFor = (m: Market): FactorId => (m === 'US' ? 'wti' : 'brent')
export const presetFactor = (p: FactorPreset, m: Market): FactorId => (p.factor === 'oil' ? oilFor(m) : p.factor)

/** Rounds toward zero to a readable step, so a rounded size never leaves the range it came from. */
export function niceTowardZero(x: number, unit: Unit): number {
  const a = Math.abs(x)
  const step = unit === 'bp' ? 5 : unit === 'pt' ? 1 : a >= 10 ? 5 : a >= 3 ? 1 : a >= 1 ? 0.5 : 0.25
  return Math.sign(x) * Math.floor(a / step + 1e-9) * step
}

export interface PresetSize { shock: number; percentile: number }
type Moves = Record<FactorId, { moves20d: { p5: number; p95: number } }>
/** Size = the factor's 95th (up) or 5th (down) percentile 20-day move, rounded toward zero. */
export function presetSize(p: FactorPreset, m: Market, factors: Moves): PresetSize {
  const r = factors[presetFactor(p, m)].moves20d, percentile = p.side === 'up' ? r.p95 : r.p5
  return { shock: niceTowardZero(percentile, FACTORS[presetFactor(p, m)].unit), percentile }
}
export const presetTitle = (p: FactorPreset, m: Market, size: PresetSize) => `${p.name} ${shockLabel(size.shock, FACTORS[presetFactor(p, m)].unit)}`
export function presetBlurb(p: FactorPreset, m: Market, size: PresetSize): string {
  const unit = FACTORS[presetFactor(p, m)].unit
  return `${p.what} — a large 20-day move historically (${p.side === 'up' ? '95th' : '5th'} percentile over the last two years: ${shockLabel(Math.round(size.percentile * 10) / 10, unit)}).`
}

/** Who an event touches: the graph relationship to an origin entity, or a curated industry list. */
export type EventRule =
  | { rel: 'headquartered_in'; origin: string; direction: 'hurt' | 'helped'; reason: string }
  | { rel: 'customers_of_hq_in'; origin: string; direction: 'hurt' | 'helped'; reason: string }
  | { rel: 'suppliers_to_hq_in'; origin: string; direction: 'hurt' | 'helped'; reason: string }
  | { rel: 'exposed_to'; origin: string; direction: 'hurt' | 'helped'; reason: string }
  | { rel: 'curated'; ids: string[]; direction: 'hurt' | 'helped'; reason: string }

export interface EventPreset { id: PresetId; kind: 'event'; title: string; blurb: string; markets: Market[]; rules: EventRule[] }
export type Preset = FactorPreset | EventPreset

export const PRESETS: Preset[] = [
  { id: 'oil-up', kind: 'factor', name: 'Oil', what: 'Crude oil rises (WTI in the US, Brent in India)', markets: ['US', 'IN'], factor: 'oil', side: 'up' },
  { id: 'oil-down', kind: 'factor', name: 'Oil', what: 'Crude oil falls (WTI in the US, Brent in India)', markets: ['US', 'IN'], factor: 'oil', side: 'down' },
  { id: 'rates-up', kind: 'factor', name: 'US 10Y', what: 'The US 10-year Treasury yield rises', markets: ['US', 'IN'], factor: 'us10y', side: 'up' },
  { id: 'rates-down', kind: 'factor', name: 'US 10Y', what: 'The US 10-year Treasury yield falls', markets: ['US', 'IN'], factor: 'us10y', side: 'down' },
  { id: 'inr-weak', kind: 'factor', name: 'USD/INR', what: 'The rupee weakens against the US dollar', markets: ['IN', 'US'], factor: 'usdinr', side: 'up' },
  { id: 'gold-up', kind: 'factor', name: 'Gold', what: 'Gold rises', markets: ['US', 'IN'], factor: 'gold', side: 'up' },
  { id: 'vix-spike', kind: 'factor', name: 'VIX', what: 'The VIX volatility index jumps', markets: ['US', 'IN'], factor: 'vix', side: 'up' },
  {
    id: 'taiwan-chips', kind: 'event', title: 'Taiwan chip disruption', markets: ['US'],
    blurb: 'Chip production in Taiwan is disrupted. Directional only: there is no comparable history to measure.',
    rules: [
      { rel: 'headquartered_in', origin: 'country:taiwan', direction: 'hurt', reason: 'production based in Taiwan' },
      { rel: 'customers_of_hq_in', origin: 'country:taiwan', direction: 'hurt', reason: 'relies on chips made in Taiwan' },
      { rel: 'suppliers_to_hq_in', origin: 'country:taiwan', direction: 'hurt', reason: 'a major customer is in Taiwan' },
    ],
  },
  {
    id: 'china-slowdown', kind: 'event', title: 'China slowdown', markets: ['US'],
    blurb: "China's economy slows sharply. Directional only: linked through the companies' China exposure.",
    rules: [
      { rel: 'exposed_to', origin: 'country:china', direction: 'hurt', reason: 'China is a major market or production base' },
      { rel: 'headquartered_in', origin: 'country:china', direction: 'hurt', reason: 'based in China' },
    ],
  },
  {
    id: 'india-monsoon', kind: 'event', title: 'India monsoon shortfall', markets: ['IN'],
    blurb: 'A weak monsoon hits farm incomes and rural demand. Directional only: curated business exposure, not a historical estimate.',
    rules: [
      { rel: 'curated', ids: ['M&M.NS'], direction: 'hurt', reason: 'tractor sales depend on farm incomes' },
      { rel: 'curated', ids: ['HEROMOTOCO.NS', 'BAJAJ-AUTO.NS'], direction: 'hurt', reason: 'two-wheeler demand leans on rural buyers' },
      { rel: 'curated', ids: ['UPL.NS'], direction: 'hurt', reason: 'agrochemical demand follows the sowing season' },
      { rel: 'curated', ids: ['HINDUNILVR.NS', 'ITC.NS', 'BRITANNIA.NS', 'TATACONSUM.NS', 'NESTLEIND.NS'], direction: 'hurt', reason: 'rural consumers are a large share of FMCG sales' },
    ],
  },
]

export const presetById = (id: string): Preset | undefined => PRESETS.find(p => p.id === id)
