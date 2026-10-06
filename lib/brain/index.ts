import 'server-only'
// Market Brain — server entry. Built from the Evidence Engine's context and
// explanations (same cached inputs, no new upstream calls), cached per market
// and shared by all users: rebuilt every 15 min while the exchange is open and
// hourly otherwise — lazily, on the first request after expiry (no polling).
//
// Accuracy, on every request:
//   - rebuilt first if built on another market day, or if an index move has
//     flipped or drifted > 1.5pt since the snapshot;
//   - every % shown is replaced with the live value from the current (≤30–60s)
//     caches, then the text is rendered — numbers never come from cached text;
//   - AI prose (optional) is shown only while its own snapshot still holds.
import type { Market, MarketContext } from '@/lib/evidence/types'
import type { Brain } from './types'
import { buildBrain, indiaSectors, MARKET_CONF, rebuildReason, withLive } from './engine'
import { renderBrain, type BrainText } from './text'
import { context, marketEvidence } from '@/lib/evidence'
import { readThrough, setCache } from '@/lib/cache'
import { getMarketStatus } from '@/lib/utils'
import { getIndianMarketStatus } from '@/lib/apis/india'
import { narrateBrain } from '@/lib/ai'

const status = (m: Market) => (m === 'US' ? getMarketStatus() : getIndianMarketStatus())
const ttl = (m: Market) => (status(m) === 'OPEN' ? 900 : 3600)
const key = (m: Market) => `market_brain_${m}`

async function build(market: Market): Promise<Brain & { buildMs: number }> {
  const { ctx, explanations } = await marketEvidence(market)
  const t0 = performance.now()
  const brain = buildBrain({ ctx, explanations, status: status(market) })
  const buildMs = Math.round((performance.now() - t0) * 10) / 10
  await narrateBrain(brain, renderBrain(brain)) // optional; no-op unless AI_PROVIDER is set
  return { ...brain, buildMs }
}

type Live = Record<string, { changePct: number; change?: number | null; at: number }>
function liveValues(ctx: MarketContext): Live {
  const live: Live = {}
  const put = (q: { symbol: string; changePct: number; change?: number | null; at: number; marketTime?: number | null }) => { live[q.symbol] = { changePct: q.changePct, change: q.change ?? null, at: q.marketTime ?? q.at } }
  for (const group of [ctx.indices, ctx.sectorEtfs, ctx.quotes, ctx.commodities, ctx.currencies, ctx.rates ?? {}, ctx.globalIndices]) Object.values(group).forEach(put)
  if (ctx.market === 'IN') for (const s of indiaSectors(ctx.quotes)) live[s.id] = { changePct: s.changePct, at: s.at }
  return live
}

export interface BrainResponse {
  brain: Brain
  text: BrainText
  generatedAt: number          // when the structured brain was built
  renderedAt: number           // when this response's live numbers were read
  buildMs: number
  rebuilt: string | null       // why this request rebuilt it, if it did
  showNarration: boolean
}

export async function getBrain(market: Market): Promise<BrainResponse> {
  const now = Date.now()
  const ctx = await context(market) // ≤20s memo over the 30–60s source caches
  const live = liveValues(ctx)
  const liveIdx = Object.fromEntries([...MARKET_CONF[market].indices, MARKET_CONF[market].volatility].filter(s => live[s]).map(s => [s, live[s].changePct]))

  let brain = (await readThrough(key(market), ttl(market), () => build(market))).data
  const rebuilt = rebuildReason(brain, liveIdx, now)
  if (rebuilt) {
    brain = await build(market)
    await setCache(key(market), brain, ttl(market))
  }
  const shown = withLive(brain, live)
  const narr = brain.narration
  const showNarration = !!narr && !rebuildReason({ market, builtAt: narr.generatedAt, snapshot: narr.snapshot }, liveIdx, now)
  return { brain: shown, text: renderBrain(shown), generatedAt: brain.builtAt, renderedAt: now, buildMs: brain.buildMs, rebuilt, showNarration }
}
