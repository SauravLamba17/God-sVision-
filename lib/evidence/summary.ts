// Deterministic one-line summary. WORDING RULE: evidence shows correlation or
// coincidence, not proof of cause — "moved with", "coincides with", "related".
// Never "because", "caused by", "due to", "driven by"… (BANNED is enforced
// here and checked by scripts/evidence-test.ts).
import type { Driver } from './types.ts'

export const BANNED = /\b(because|caus(e|ed|es|ing)|due to|driven by|thanks to|owing to|as a result|trigger(ed|s)?|spark(ed|s)?|fuel(l)?ed)\b/i

const MAX_CLAUSES = 4

/** Body of the line, without the "SYMBOL ±x.x%" head — the UI prefixes the LIVE move. */
export function summarize(drivers: Driver[]): string {
  if (drivers[0]?.type === 'no_clear_driver') return drivers[0].label

  const by = (t: Driver['type']) => drivers.filter(d => d.type === t)
  const clauses: { text: string; score: number }[] = []

  const market = by('market').find(d => d.label.startsWith('moved with'))
  const sector = by('sector')[0]
  if (market && sector) clauses.push({ text: `${market.label} and ${sector.label}`, score: market.score + sector.score })
  else if (market) clauses.push({ text: market.label, score: market.score })
  else if (sector) clauses.push({ text: `moved with ${sector.label}`, score: sector.score })

  const news = by('news')
  if (news.length) clauses.push({ text: `${news.length} related headline${news.length > 1 ? 's' : ''}`, score: Math.max(...news.map(d => d.score)) })

  for (const t of ['peers', 'breadth', 'global', 'related_news', 'linked_event', 'commodity', 'currency', 'scheduled', 'volume'] as const) {
    const d = by(t)[0]
    if (d) clauses.push({ text: d.label, score: d.score })
  }

  const text = clauses.sort((a, b) => b.score - a.score).slice(0, MAX_CLAUSES).map(c => c.text).join(' · ')
  if (BANNED.test(text)) throw new Error(`summary wording rule violated: ${text}`)
  return text
}

/** The full line as shown: live symbol and move + the evidence body. */
export function formatLine(symbol: string, liveChangePct: number, body: string): string {
  const pct = `${liveChangePct >= 0 ? '+' : '−'}${Math.abs(liveChangePct).toFixed(1)}%`
  return `${symbol.replace(/\.NS$/, '')} ${pct} · ${body}`
}
