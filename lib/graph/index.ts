// Entity Graph — curated, code-only reference data (see meta.ts for the review date).
// Imports use explicit .ts extensions so scripts/graph-test.ts can run under
// Node's built-in type stripping without a bundler.
import type { Entity, Link } from './types.ts'
import { SYMMETRIC } from './types.ts'
import { ENTITIES } from './entities.ts'
import { LINKS } from './links.ts'
import { GRAPH_META } from './meta.ts'
export { GRAPH_META }
const GRAPH_META_REVIEWED = GRAPH_META.lastReviewed
export type { Entity, Link, EntityType, LinkType } from './types.ts'

const byId = new Map<string, Entity>(ENTITIES.map(e => [e.id, e]))
const bySymbol = new Map<string, Entity>()
for (const e of ENTITIES) for (const s of e.symbols ?? []) bySymbol.set(s.toUpperCase(), e)

export interface LinkView { link: Link; direction: 'out' | 'in'; other: Entity }

const adjacency = new Map<string, LinkView[]>()
for (const link of LINKS) {
  const from = byId.get(link.from), to = byId.get(link.to)
  if (!from || !to) continue // broken targets are caught by scripts/graph-test.ts
  ;(adjacency.get(from.id) ?? adjacency.set(from.id, []).get(from.id)!).push({ link, direction: 'out', other: to })
  ;(adjacency.get(to.id) ?? adjacency.set(to.id, []).get(to.id)!).push({ link, direction: 'in', other: from })
}

export const allEntities = (): readonly Entity[] => ENTITIES
export const allLinks = (): readonly Link[] => LINKS

/** Exact id lookup ('AAPL', 'RELIANCE.NS', 'index:sp500'). */
export function getEntity(id: string): Entity | undefined {
  return byId.get(id)
}

/** Id, or a market symbol the app shows ('^GSPC', 'SPY', 'GC=F', 'XLK'). */
export function resolveEntity(idOrSymbol: string): Entity | undefined {
  return byId.get(idOrSymbol) ?? bySymbol.get(idOrSymbol.toUpperCase())
}

/** Direct links in both directions. */
export function getLinks(id: string): LinkView[] {
  return adjacency.get(id) ?? []
}

/** Everything within `depth` hops (links followed in either direction). */
export function neighbours(id: string, depth = 1): { entity: Entity; depth: number; via: LinkView }[] {
  const out: { entity: Entity; depth: number; via: LinkView }[] = []
  const seen = new Set([id])
  let frontier = [id]
  for (let d = 1; d <= depth && frontier.length; d++) {
    const next: string[] = []
    for (const cur of frontier) for (const v of getLinks(cur)) {
      if (seen.has(v.other.id)) continue
      seen.add(v.other.id)
      out.push({ entity: v.other, depth: d, via: v })
      next.push(v.other.id)
    }
    frontier = next
  }
  return out
}

// Broad structural links (everyone in the US, every IT company) cost more, so
// paths prefer specific relationships: TSMC → supplies Nvidia → Nasdaq, rather
// than TSMC → IT sector → Apple → Nasdaq.
const STRUCTURAL = new Set(['in_sector', 'headquartered_in', 'part_of', 'benchmark_of', 'currency_of', 'constituent_of'])
const cost = (v: LinkView) => (STRUCTURAL.has(v.link.type) ? 1.5 : 1)

/** Cheapest link chain from a to b (Dijkstra; graph is small). null if unconnected. */
export function findPath(a: string, b: string): LinkView[] | null {
  if (!byId.has(a) || !byId.has(b)) return null
  if (a === b) return []
  const dist = new Map<string, number>([[a, 0]])
  const prev = new Map<string, { from: string; via: LinkView }>()
  const done = new Set<string>()
  while (true) {
    let cur: string | null = null, best = Infinity
    for (const [id, d] of dist) if (!done.has(id) && d < best) { best = d; cur = id }
    if (cur === null) return null
    if (cur === b) break
    done.add(cur)
    for (const v of getLinks(cur)) {
      const nd = best + cost(v)
      if (nd < (dist.get(v.other.id) ?? Infinity)) { dist.set(v.other.id, nd); prev.set(v.other.id, { from: cur, via: v }) }
    }
  }
  const path: LinkView[] = []
  for (let id = b; id !== a; id = prev.get(id)!.from) path.unshift(prev.get(id)!.via)
  return path
}

/** Human-readable form of one link as seen from `id` ("supplies Nvidia", "supplied by TSMC"). */
export function describeLink(v: LinkView): string {
  const t = v.link.type, o = v.other.name
  const out: Record<string, string> = {
    supplier_of: `supplies ${o}`, competitor_of: `competes with ${o}`, constituent_of: `in ${o}`,
    exposed_to: `exposed to ${o}`, headquartered_in: `headquartered in ${o}`, in_sector: `${o} sector`,
    subsidiary_of: `majority-owned by ${o}`, currency_of: `currency of ${o}`, benchmark_of: `benchmark for ${o}`,
    major_producer_of: `major producer of ${o}`, part_of: `part of ${o}`,
  }
  const inn: Record<string, string> = {
    supplier_of: `supplied by ${o}`, competitor_of: `competes with ${o}`, constituent_of: `includes ${o}`,
    exposed_to: `${o} is exposed to it`, headquartered_in: `home of ${o}`, in_sector: `includes ${o}`,
    subsidiary_of: `majority owner of ${o}`, currency_of: `uses ${o}`, benchmark_of: `tracked by ${o}`,
    major_producer_of: `${o} is a major producer`, part_of: `includes ${o}`,
  }
  return (v.direction === 'out' || SYMMETRIC.has(t) ? out : inn)[t] ?? `${t} ${o}`
}

// ── Headline matching ────────────────────────────────────────────────────────
export interface EntityMatch { entity: Entity; text: string; index: number }

// Base tickers that are also common acronyms/words, so a bare uppercase hit
// isn't trusted (the company name or a $cashtag still matches).
const TICKER_STOPLIST = new Set(['ITC', 'TITAN', 'NOW', 'ALL', 'ARE', 'CAN', 'ONE'])
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const B = "(?<![\\w&$])", E = "(?![\\w&])" // word boundaries that keep "L&T"/"M&M" whole

interface Matcher { entity: Entity; re: RegExp }
let matchers: Matcher[] | null = null

function buildMatchers(): Matcher[] {
  const ms: Matcher[] = []
  for (const e of ENTITIES) {
    const cs = new Set(e.caseSensitive ?? [])
    for (const a of e.aliases ?? []) ms.push({ entity: e, re: new RegExp(B + esc(a) + E, cs.has(a) ? 'g' : 'gi') })
    for (const p of e.patterns ?? []) ms.push({ entity: e, re: new RegExp(B + p, 'g') })
    if (e.type === 'company') {
      const base = e.id.replace(/\.NS$/, '')
      // Exact uppercase ticker, 3+ chars, not a common word…
      if (base.length >= 3 && !TICKER_STOPLIST.has(base)) ms.push({ entity: e, re: new RegExp(B + esc(base) + E, 'g') })
      // …or any length as a $cashtag ($V, $LT).
      ms.push({ entity: e, re: new RegExp('\\$' + esc(base) + E, 'g') })
    }
  }
  return ms
}

/**
 * Entities a headline mentions: whole-word, longest match wins, each entity
 * once, in order of appearance. Never matches short tickers like "A"/"IT"/"V"
 * as bare words.
 */
export function matchEntitiesInText(text: string): EntityMatch[] {
  matchers ??= buildMatchers()
  const hits: EntityMatch[] = []
  for (const { entity, re } of matchers) {
    re.lastIndex = 0
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const after = text.slice(m.index + m[0].length), before = text.slice(0, m.index)
      if (entity.notFollowedBy?.some(w => new RegExp('^\\s+' + esc(w) + '(?![\\w])', 'i').test(after))) continue
      if (entity.notPrecededBy?.some(w => new RegExp('(?<![\\w])' + esc(w) + '\\s+$', 'i').test(before))) continue
      hits.push({ entity, text: m[0], index: m.index })
    }
  }
  // Longest spans first; drop anything overlapping an accepted span.
  hits.sort((x, y) => y.text.length - x.text.length || x.index - y.index)
  const taken: [number, number][] = [], seen = new Set<string>(), out: EntityMatch[] = []
  for (const h of hits) {
    const s = h.index, e = h.index + h.text.length
    if (taken.some(([ts, te]) => s < te && e > ts)) continue
    taken.push([s, e])
    if (seen.has(h.entity.id)) continue
    seen.add(h.entity.id)
    out.push(h)
  }
  return out.sort((x, y) => x.index - y.index)
}

// ── Display helper: a stock's direct links, grouped (used by the deep dive) ──
export interface ConnectionGroup { title: string; items: { id: string; name: string; description: string; reason: string }[] }

const GROUPS: { title: string; types: string[] }[] = [
  { title: 'Supply chain', types: ['supplier_of'] },
  { title: 'Competitors', types: ['competitor_of'] },
  { title: 'Exposure', types: ['exposed_to'] },
  { title: 'Ownership', types: ['subsidiary_of'] },
  { title: 'Index membership', types: ['constituent_of'] },
  { title: 'Sector & headquarters', types: ['in_sector', 'headquartered_in'] },
]

/** Grouped direct connections for one entity, or null if it isn't in the graph. */
export function connectionsFor(id: string): { lastReviewed: string; groups: ConnectionGroup[] } | null {
  if (!byId.has(id)) return null
  const links = getLinks(id)
  const groups = GROUPS.map(g => ({
    title: g.title,
    items: links.filter(v => g.types.includes(v.link.type))
      .map(v => ({ id: v.other.id, name: v.other.name, description: describeLink(v), reason: v.link.reason })),
  })).filter(g => g.items.length > 0)
  return { lastReviewed: GRAPH_META_REVIEWED, groups }
}
