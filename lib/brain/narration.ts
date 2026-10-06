// Rules for optional AI prose of the Market Brain — pure, so tests can drive it.
// The AI rewrites the deterministic sections into a short paragraph. It may only
// use that evidence; any of these rejects it (the deterministic summary shows):
//   - causal wording (BANNED) or predictions/advice (PREDICTIVE)
//   - any number: figures are shown live on screen, so prose stays numberless
//     (digits inside names the evidence uses, like "S&P 500" or "Nifty 50", are allowed)
//   - naming a company, sector, country, commodity or index the evidence doesn't mention
import type { Brain } from './types.ts'
import type { BrainText } from './text.ts'
import { PREDICTIVE } from './text.ts'
import { BANNED } from '../evidence/summary.ts'
import { matchEntitiesInText } from '../graph/index.ts'

export interface BrainNarrationInput { market: 'US' | 'IN'; summary: string; sections: Record<string, string> }

export function narrationInput(b: Brain, t: BrainText): BrainNarrationInput {
  return { market: b.market, summary: t.summary, sections: t.sections }
}

/** Names from the evidence that legitimately contain digits ("S&P 500", "Nifty 50", "Russell 2000"). */
function numberedNames(b: Brain): string[] {
  const names = [...b.state.indices, ...b.sectors.strongest, ...b.sectors.weakest].map(q => q.name)
  return [...names, 'S&P 500', 'Nifty 50', 'Russell 2000', 'Nasdaq-100'].filter(n => /\d/.test(n))
}

export function validBrainNarration(text: unknown, b: Brain, t: BrainText): text is string {
  if (typeof text !== 'string') return false
  const s = text.trim()
  if (s.length < 40 || s.length > 900) return false
  if (BANNED.test(s) || PREDICTIVE.test(s)) return false
  let stripped = s
  for (const n of numberedNames(b)) stripped = stripped.split(n).join('')
  if (/\d/.test(stripped)) return false
  const evidence = [t.summary, ...Object.values(t.sections)].join(' ')
  const allowed = new Set(matchEntitiesInText(evidence).map(m => m.entity.id))
  return matchEntitiesInText(s).every(m => allowed.has(m.entity.id))
}
