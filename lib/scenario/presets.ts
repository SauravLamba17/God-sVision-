// Scenario presets. Factor presets carry a shock size in the factor's unit; every
// result magnitude still comes from data/scenario/sensitivities.json. Event presets
// have no measurable history: they are directional only — which listed companies
// are linked to the event and how (graph links, or a curated business exposure
// with its reason) — and never show a percentage.
import type { FactorId, Market } from './factors.ts'

export type PresetId = 'oil-up' | 'oil-down' | 'rates-up' | 'rates-down' | 'inr-weak' | 'gold-up' | 'vix-spike' | 'taiwan-chips' | 'china-slowdown' | 'india-monsoon'

export interface FactorPreset {
  id: PresetId; kind: 'factor'; title: string; blurb: string; markets: Market[]
  /** 'oil' = the market's own benchmark: WTI in the US, Brent in India. */
  factor: FactorId | 'oil'; shock: number
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
  { id: 'oil-up', kind: 'factor', title: 'Oil +20%', blurb: 'Crude oil rises 20% (WTI in the US, Brent in India).', markets: ['US', 'IN'], factor: 'oil', shock: 20 },
  { id: 'oil-down', kind: 'factor', title: 'Oil −20%', blurb: 'Crude oil falls 20% (WTI in the US, Brent in India).', markets: ['US', 'IN'], factor: 'oil', shock: -20 },
  { id: 'rates-up', kind: 'factor', title: 'US 10Y +100bp', blurb: 'The US 10-year Treasury yield rises one percentage point.', markets: ['US', 'IN'], factor: 'us10y', shock: 100 },
  { id: 'rates-down', kind: 'factor', title: 'US 10Y −100bp', blurb: 'The US 10-year Treasury yield falls one percentage point.', markets: ['US', 'IN'], factor: 'us10y', shock: -100 },
  { id: 'inr-weak', kind: 'factor', title: 'USD/INR +3%', blurb: 'The rupee weakens 3% against the US dollar.', markets: ['IN', 'US'], factor: 'usdinr', shock: 3 },
  { id: 'gold-up', kind: 'factor', title: 'Gold +15%', blurb: 'Gold rises 15%.', markets: ['US', 'IN'], factor: 'gold', shock: 15 },
  { id: 'vix-spike', kind: 'factor', title: 'VIX spike (+10 pts)', blurb: 'The VIX volatility index jumps 10 points.', markets: ['US', 'IN'], factor: 'vix', shock: 10 },
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
