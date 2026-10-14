/**
 * Old vs new news feeds against the SAME live data.   npm run compare:news [-- baseline.json]
 *
 * Builds the real US evidence context once (quotes, indices, sectors, general news,
 * per-ticker news, market feeds — fetched directly by this process), then explains
 * every target twice: "old" = the context without market-feed headlines (Headline.feed),
 * "new" = everything. Targets: today's top 10 US movers by |move| (same per-ticker news
 * as /api/why/us) and a fixed list (same path as /api/why/recompute). Also compares
 * Market Brain themes and reports feed fetch time, CPU and engine time.
 * Optional baseline.json (a saved earlier run's attributions) lists which of them the
 * current filters drop.
 */
import './serverModules.ts'
import fs from 'node:fs'
import type { Explanation, MarketContext, Quote } from '../lib/evidence/types.ts'

const { marketEvidence, symbolsEvidence, HERO_INDICES } = await import('../lib/evidence/index.ts')
const { explain, isNotAReason } = await import('../lib/evidence/engine.ts')
const { STRONG } = await import('../lib/evidence/summary.ts')
const { buildBrain } = await import('../lib/brain/engine.ts')
const { MARKET_FEEDS, feedUrl, parseFeed } = await import('../lib/apis/marketNews.ts')

const FIXED = (process.env.COMPARE_SYMBOLS ?? 'ACN,TSLA,TXN,AVGO,ORCL,NVDA,AAPL,MSFT,JPM,XOM').split(',')
const old = (c: MarketContext): MarketContext => ({ ...c, headlines: c.headlines.filter(h => !h.feed) })
const strong = (e: Explanation) => e.drivers.some(d => d.score >= STRONG && d.type !== 'no_clear_driver')
const newsOf = (e: Explanation) => e.drivers.filter(d => d.type === 'news' || d.type === 'related_news')
const ms = (t: number) => `${(performance.now() - t).toFixed(0)} ms`

// ── Live context (cold: every loader fetches) ────────────────────────────────
const cpu0 = process.cpuUsage(), t0 = performance.now()
const { ctx } = await marketEvidence('US')
console.log(`context with per-ticker news (cold): ${ms(t0)}, CPU ${((process.cpuUsage(cpu0).user + process.cpuUsage(cpu0).system) / 1000).toFixed(0)} ms (all inputs)`)
const fx = await symbolsEvidence('US', FIXED)

const movers = Object.values(ctx.quotes).sort((a, b) => b.changePct - a.changePct)
const targets = [...movers.slice(0, 10), ...movers.slice(-10)]
const top10 = [...new Map(targets.map(q => [q.symbol, q])).values()].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 10)

const feedOf = new Map(ctx.headlines.map(h => [h.title, h.feed]))
const rows: { group: string; q: Quote; o: Explanation; n: Explanation }[] = []
for (const q of top10) rows.push({ group: 'mover', q, o: explain(q, 'stock', old(ctx)), n: explain(q, 'stock', ctx) })
for (const q of fx.stocks) {
  rows.push({ group: 'fixed', q, o: explain(q, 'stock', old(fx.withNews)), n: explain(q, 'stock', fx.withNews) })
  for (const h of fx.withNews.headlines) if (!feedOf.has(h.title)) feedOf.set(h.title, h.feed)
}

// ── Coverage ─────────────────────────────────────────────────────────────────
const n = ctx.headlines.length, nOld = old(ctx).headlines.length
console.log(`\nheadlines in context: old ${nOld}, new ${n} (+${n - nOld} from market feeds, after de-duplication against the general feed)`)
for (const g of ['mover', 'fixed']) {
  const rs = rows.filter(r => r.group === g)
  console.log(`\n${g === 'mover' ? 'TOP 10 US MOVERS' : `FIXED (${FIXED.join(', ')})`}: strong driver old ${rs.filter(r => strong(r.o)).length}/${rs.length} → new ${rs.filter(r => strong(r.n)).length}/${rs.length}`)
  for (const r of rs) {
    const head = `  ${r.q.symbol.padEnd(5)} ${r.q.changePct.toFixed(2).padStart(6)}%`
    console.log(`${head}  old ${strong(r.o) ? 'STRONG' : 'weak  '} ${r.o.summary}`)
    if (r.n.summary !== r.o.summary) console.log(`${' '.repeat(head.length)}  new ${strong(r.n) ? 'STRONG' : 'weak  '} ${r.n.summary}`)
  }
}

// ── Every attribution that changed ───────────────────────────────────────────
console.log('\nNEW ATTRIBUTIONS (in the new run, not the old):')
let added = 0
for (const r of rows) {
  const before = new Set(newsOf(r.o).map(d => d.evidence))
  for (const d of newsOf(r.n)) if (!before.has(d.evidence)) {
    added++
    const title = d.type === 'related_news' ? d.evidence.split(' — ')[0] : d.evidence
    console.log(`  ${r.q.symbol} (${r.group}) ${d.type} ${d.score.toFixed(2)}${d.score >= STRONG ? ' STRONG' : ''}: "${d.evidence}" [${d.source.name}; feed ${feedOf.get(title) ?? 'general/ticker'}] ${d.source.url ?? ''}`)
  }
  const after = new Set(newsOf(r.n).map(d => d.evidence))
  for (const d of newsOf(r.o)) if (!after.has(d.evidence)) console.log(`  ${r.q.symbol} (${r.group}) displaced from the top 3: ${d.score.toFixed(2)} "${d.evidence}" [${d.source.name}]`)
}
if (!added) console.log('  none')

// ── Market Brain themes ──────────────────────────────────────────────────────
const explanations = (c: MarketContext) => {
  const out: Record<string, Explanation> = {}
  for (const q of targets) out[q.symbol] = explain(q, 'stock', c)
  for (const s of HERO_INDICES.US) if (c.indices[s]) out[s] = explain(c.indices[s], 'index', c)
  return out
}
const tb = performance.now(); const bOld = buildBrain({ ctx: old(ctx), explanations: explanations(old(ctx)), status: 'compare' }); const brainOldMs = performance.now() - tb
const tn = performance.now(); const bNew = buildBrain({ ctx, explanations: explanations(ctx), status: 'compare' }); const brainNewMs = performance.now() - tn
const themeLine = (t: (typeof bNew.themes)[number]) => `${t.title} — ${t.stories} stories, ${t.sources} outlets, score ${t.score}`
console.log(`\nUS THEMES old (${bOld.themes.length}): ${bOld.themes.map(themeLine).join(' | ') || 'none'}`)
console.log(`US THEMES new (${bNew.themes.length}): ${bNew.themes.map(themeLine).join(' | ') || 'none'}`)
const oldIds = new Set(bOld.themes.map(t => `${t.id}:${t.stories}`))
for (const t of bNew.themes) if (!oldIds.has(`${t.id}:${t.stories}`)) {
  console.log(`  ${t.title} (new or changed) — moves: ${t.moves.map(m => `${m.name} ${m.changePct.toFixed(1)}%`).join(', ')}`)
  for (const h of t.headlines) console.log(`    - ${h.title} [${h.source.name}; feed ${feedOf.get(h.title) ?? 'general'}]`)
}

// ── Cost ─────────────────────────────────────────────────────────────────────
const te = (c: MarketContext) => { const s = performance.now(); for (let i = 0; i < 5; i++) for (const q of targets) explain(q, 'stock', c); return (performance.now() - s) / (5 * targets.length) }
const eOld = te(old(ctx)), eNew = te(ctx)
console.log(`\nengine: ${eOld.toFixed(2)} → ${eNew.toFixed(2)} ms per explanation (${targets.length + HERO_INDICES.US.length} per dashboard: ~${(eOld * 22).toFixed(0)} → ~${(eNew * 22).toFixed(0)} ms); brain build ${brainOldMs.toFixed(1)} → ${brainNewMs.toFixed(1)} ms`)
// One refresh of every market feed (what an instance pays once per TTL): network wall time and CPU (fetch + parse).
const c1 = process.cpuUsage(), w1 = performance.now()
const per = await Promise.all(MARKET_FEEDS.map(async f => {
  const s = performance.now()
  try {
    const res = await fetch(feedUrl(f, Date.now()), { signal: AbortSignal.timeout(f.timeoutMs), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GODsVision/1.0)' } })
    const xml = await res.text(), p = performance.now()
    const items = await parseFeed(xml, f)
    return `${f.name}: HTTP ${res.status}, ${items.length} items, ${(p - s).toFixed(0)} ms fetch, ${(performance.now() - p).toFixed(1)} ms parse`
  } catch (e) { return `${f.name}: ${(e as Error).message} after ${(performance.now() - s).toFixed(0)} ms` }
}))
const c1u = process.cpuUsage(c1)
console.log(`feed refresh (all ${MARKET_FEEDS.length} in parallel): ${ms(w1)} wall, ${((c1u.user + c1u.system) / 1000).toFixed(0)} ms CPU\n  ${per.join('\n  ')}`)

// ── Baseline attributions the current filters drop ──────────────────────────
if (process.argv[2]) {
  const base = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
  console.log(`\nBASELINE (${base.at}) attributions now filtered as noise:`)
  for (const r of [...base.movers, ...base.fixed]) for (const line of r.news ?? []) {
    const title = line.replace(/^[\d.]+ /, '').replace(/ \[[^\]]*\]$/, '').split(' — ')[0]
    if (isNotAReason(title)) console.log(`  ${r.symbol}: ${line}`)
  }
}
process.exit(0)
