// Business links between a factor and a stock, from the Entity Graph. A sensitivity
// without one needs stronger evidence (|t| ≥ 3) to count as reliable, and the
// path is shown next to each result ("Crude oil → oil refining → Reliance Industries").
import { getEntity, getLinks } from '../graph/index.ts'
import { FACTORS, type FactorId, type SectorFund } from './factors.ts'

// Rate-sensitive sectors (curated): lending margins, bond-like valuations, funding costs.
// The graph has no "interest rate" entity, so US 10Y links go through the sector.
const RATE_SECTORS = new Set(['sector:financials', 'sector:real-estate', 'sector:utilities'])

/** "Crude oil → oil refining → Valero Energy", or null when the graph has no business link. */
export function exposurePath(id: string, factor: FactorId): string | null {
  const e = getEntity(id), f = FACTORS[factor]
  if (!e) return null
  if (factor === 'us10y') return e.sector && RATE_SECTORS.has(e.sector) ? `${f.name} → ${getEntity(e.sector)?.name.toLowerCase()} → ${e.name}` : null
  const targets = factor === 'usdinr' ? ['currency:usd', 'currency:inr'] : f.entity ? [f.entity] : []
  const v = getLinks(id).find(v => v.direction === 'out' && v.link.type === 'exposed_to' && targets.includes(v.other.id))
  return v ? `${getEntity(v.other.id)?.name} → ${(e.industry ?? 'business').toLowerCase()} → ${e.name}` : null
}

/** Graph companies a sector fund stands for (its sector in its market, or explicit members). */
export function fundMembers(f: SectorFund, ids: Iterable<string>): string[] {
  return [...ids].filter(id => f.members ? f.members.includes(id) : getEntity(id)?.sector === f.sector && (f.market === 'IN') === id.endsWith('.NS'))
}

/** A fund's path: via its first member with a business link to the factor. */
export function fundPath(f: SectorFund, factor: FactorId, ids: Iterable<string>): string | null {
  for (const id of fundMembers(f, ids)) { const p = exposurePath(id, factor); if (p) return `${p.split(' → ')[0]} → ${f.name} (e.g. ${getEntity(id)?.name})` }
  return null
}
