import 'server-only'
// Research Agent — optional AI prose (server). Runs only when AI_PROVIDER is set, the question's
// answer is public (never PORTFOLIO, never private data), the user's daily AI share allows it and
// the global on-demand Gemini budget allows it — counted per actual call, limits unchanged.
// Prose is cached in Postgres under a key with no user data (prose.ts proseCacheKey) and is
// re-validated against the CURRENT facts every time it is served.
import type { FactSheet, Sentence } from './types'
import { AI_LABEL, AI_TIMEOUT_MS, narratable, narrateWith, proseCacheKey, validateProse } from './prose'
import { getAIProvider } from '@/lib/ai'
import { cachedAI } from '@/lib/aiCache'
import { reserveGeminiCall } from '@/lib/gemini'
import { checkLimits, LIMITS } from '@/lib/rateLimit'

export interface Prose { label: string; provider: string; sentences: Sentence[]; generatedAt: number }
const TTL_SECONDS = 3600

/** AI sentences for this FactSheet, or null (not enabled, not allowed, over budget, failed or rejected). Never throws. */
export async function narrateAnswer(fs: FactSheet, userId: string, timeoutMs = AI_TIMEOUT_MS): Promise<Prose | null> {
  if (process.env.NEXT_PHASE === 'phase-production-build' || !narratable(fs)) return null
  const provider = getAIProvider()
  if (!provider?.research) return null
  const r = await cachedAI<string>(proseCacheKey(fs), TTL_SECONDS, async () => {
    const out = await narrateWith(fs, {
      // Per-user share first, so a capped user never spends the shared budget.
      reserve: async () => (await checkLimits([LIMITS.aiUser(userId)])).ok && (await reserveGeminiCall('ondemand')),
      call: prompt => provider.research!(prompt),
      timeoutMs,
    })
    if (!out.ok) throw new Error(`research prose: ${out.reason}`)
    return out.text
  }).catch(() => null)
  if (!r) return null
  const v = validateProse(r.data, fs) // a cached text must still match today's facts
  return v.ok ? { label: AI_LABEL, provider: provider.name, sentences: v.sentences, generatedAt: r.generatedAt } : null
}
