import 'server-only'
import type { Explanation, Market, MarketContext, Quote } from './types.ts'
import { buildContext, toMs } from './context.ts'
import { explain } from './engine.ts'
import { readThrough } from '@/lib/cache'
import { getQuote } from '@/lib/apis/yahoo'

export type { Explanation, Market } from './types.ts'

// Index cards the dashboards show, by market.
export const HERO_INDICES: Record<Market, string[]> = { US: ['^GSPC', '^IXIC'], IN: ['^NSEI', '^BSESN', '^NSEBANK'] }
const MOVERS_PER_SIDE = 10

// One context per market per instance for 20s: recomputes arriving together
// share it instead of re-reading every cache.
const memo = new Map<Market, { ctx: MarketContext; at: number }>()
async function context(market: Market): Promise<MarketContext> {
  const m = memo.get(market)
  if (m && Date.now() - m.at < 20_000) return m.ctx
  const ctx = await buildContext(market)
  memo.set(market, { ctx, at: Date.now() })
  return ctx
}

export interface MarketExplanations {
  market: Market
  generatedAt: number
  explanations: Record<string, Explanation>
  inputs: MarketContext['inputs']
  computeMs: number
}

/** Explanations for today's movers and the hero index cards. */
export async function explainMarket(market: Market): Promise<MarketExplanations> {
  const ctx = await context(market)
  const t0 = performance.now()
  const stocks = Object.values(ctx.quotes).sort((a, b) => b.changePct - a.changePct)
  const targets = [...stocks.slice(0, MOVERS_PER_SIDE), ...stocks.slice(-MOVERS_PER_SIDE)]
  const explanations: Record<string, Explanation> = {}
  for (const q of targets) explanations[q.symbol] = explain(q, 'stock', ctx)
  for (const sym of HERO_INDICES[market]) if (ctx.indices[sym]) explanations[sym] = explain(ctx.indices[sym], 'index', ctx)
  return { market, generatedAt: ctx.builtAt, explanations, inputs: ctx.inputs, computeMs: Math.round((performance.now() - t0) * 10) / 10 }
}

/** Fresh evidence for specific symbols (drift/flip recompute, deep dive). */
export async function explainSymbols(market: Market, symbols: string[]): Promise<Record<string, Explanation>> {
  const ctx = await context(market)
  const out: Record<string, Explanation> = {}
  for (const sym of symbols) {
    if (ctx.indices[sym]) { out[sym] = explain(ctx.indices[sym], 'index', ctx); continue }
    let q: Quote | undefined = ctx.quotes[sym]
    if (!q) {
      // Not among the quotes the dashboards hold (e.g. a deep-dive ticker): one
      // cached quote, under the key /api/stocks already uses for single quotes.
      const r = await readThrough(`quote_${sym}`, 60, () => getQuote(sym)).catch(() => null)
      const d: any = r?.data
      if (d?.regularMarketChangePercent != null) {
        q = { symbol: sym, name: d.longName ?? d.shortName ?? sym, price: d.regularMarketPrice ?? null, changePct: d.regularMarketChangePercent, volume: d.regularMarketVolume ?? null, avgVolume: d.averageDailyVolume3Month ?? null, at: Date.now(), marketTime: toMs(d.regularMarketTime) }
      }
    }
    if (q) out[sym] = explain(q, 'stock', ctx)
  }
  return out
}
