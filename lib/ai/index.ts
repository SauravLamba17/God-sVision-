import 'server-only'
// AI provider layer. Feature code calls narrateExplanations(); which provider
// runs (or none) is config: AI_PROVIDER + limits in ./config.ts. Adding a paid
// provider = a new file implementing AIProvider + a case below.
import type { AIProvider, NarrationItem } from './types'
import { aiConfig } from './config'
import { geminiProvider } from './gemini'
import { reserveFeature } from './budget'
import { cachedAI } from '@/lib/aiCache'
import type { Explanation, Market, Snapshot } from '@/lib/evidence/types'
import { BANNED } from '@/lib/evidence/summary'
import { needsRecompute } from '@/lib/evidence/freshness'

export type { AIProvider } from './types'

export function getAIProvider(): AIProvider | null {
  switch (aiConfig().provider) {
    case 'gemini': return geminiProvider()
    default: return null // 'none' or unknown → deterministic summaries only
  }
}

/** Reject narration that breaks the rules; the deterministic summary shows instead. */
export function validNarration(text: unknown, e: Explanation): text is string {
  if (typeof text !== 'string') return false
  const t = text.trim()
  if (t.length < 10 || t.length > 260 || BANNED.test(t)) return false
  // Must not restate the item's own move (it would go stale; the screen shows it live).
  const own = Math.abs(e.snapshot.changePct).toFixed(1)
  if (new RegExp(`(?<![\\d.])${own.replace('.', '\\.')}\\s?%`).test(t)) return false
  return true
}

interface Batch { items: Record<string, { text: string; snapshot: Snapshot }>; provider: string }

/**
 * Optional AI narration for the biggest movers: one call per window for up to
 * AI_NARRATION_BATCH items, cached in Postgres for AI_NARRATION_TTL_SECONDS.
 * Attached only where the cached narration's snapshot still matches the live
 * evidence (same direction, ≤1.5pt drift). Never throws.
 */
export async function narrateExplanations(market: Market, explanations: Record<string, Explanation>): Promise<void> {
  // Never during `next build` (ISR prerender) — it would count against the daily cap.
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  const provider = getAIProvider()
  if (!provider) return
  const cfg = aiConfig()
  const picks = Object.values(explanations).filter(e => e.kind === 'stock')
    .sort((a, b) => Math.abs(b.snapshot.changePct) - Math.abs(a.snapshot.changePct)).slice(0, cfg.narrationBatch)
  if (!picks.length) return

  const windowStart = Math.floor(Date.now() / 1000 / cfg.narrationTtlSeconds)
  const result = await cachedAI<Batch>(`ai:why:${market}:${windowStart}`, cfg.narrationTtlSeconds, async () => {
    if (!(await reserveFeature('why', cfg.narrationDailyLimit))) throw new Error('AI narration daily limit reached')
    const items: NarrationItem[] = picks.map(e => ({
      id: e.id, name: e.name, direction: e.snapshot.changePct >= 0 ? 'up' : 'down',
      drivers: e.drivers.map(d => ({ label: d.label, evidence: d.evidence })),
    }))
    const texts = await provider.narrate(items)
    const out: Batch['items'] = {}
    for (const e of picks) if (validNarration(texts[e.id], e)) out[e.id] = { text: texts[e.id].trim(), snapshot: e.snapshot }
    return { items: out, provider: provider.name }
  }).catch(() => null)
  if (!result) return

  for (const [id, n] of Object.entries(result.data.items)) {
    const e = explanations[id]
    if (e && !needsRecompute(n.snapshot, e.snapshot.changePct)) {
      e.narration = { text: n.text, provider: result.data.provider, generatedAt: result.generatedAt, snapshot: n.snapshot }
    }
  }
}
