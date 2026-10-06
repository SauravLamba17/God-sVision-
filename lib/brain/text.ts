// Deterministic text for the Market Brain — pure. Same wording rule as the Why
// Engine: "moved with", "coincides with", "related"; never "because"/"caused".
// No predictions, price targets or advice. Third-party titles (headlines, event
// and calendar names) are quoted in “…” and excluded from the wording check.
import type { Brain, BrainQuote } from './types.ts'
import { BANNED } from '../evidence/summary.ts'
import { fmtPct } from '../evidence/engine.ts'
import { signed } from '../format.ts'
import { MARKET_CONF } from './engine.ts'

/** Forward-looking or advice wording our own text must never use. */
export const PREDICTIVE = /\b(will|would|should|expects?|expected|expecting|likely|forecasts?|predict\w*|price targets?|buy|sell|recommend\w*|could|might|may|poised|set to|outlook|opportunit\w*)\b/i

export const SECTIONS = ['state', 'sectors', 'movers', 'crossAsset', 'events', 'themes', 'upcoming'] as const
export type SectionKey = typeof SECTIONS[number]
export interface BrainText { summary: string; sections: Record<SectionKey, string> }

const pct = (q: Pick<BrainQuote, 'changePct'>) => fmtPct(q.changePct)
const short = (name: string) => name.replace(/ \((avg|[\d]+ stocks)[^)]*\)$/, '')
const quoteList = (qs: BrainQuote[]) => qs.map(q => `${q.name} ${pct(q)}`).join(', ')

function crossItem(q: BrainQuote): string {
  if (q.symbol === '^TNX' || q.symbol === '^IRX') {
    const bp = Math.round((q.change ?? 0) * 100)
    return `${q.name} ${signed(bp, 0, '−')}bp`
  }
  return `${q.name} ${pct(q)}`
}

function timeLabel(t: number | null, b: Brain): string {
  if (!t) return 'time unavailable'
  const { tz, tzLabel } = MARKET_CONF[b.market]
  return `${new Date(t).toLocaleString('en-US', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })} ${tzLabel}`
}

export function renderBrain(b: Brain): BrainText {
  const name = b.market === 'US' ? 'US' : 'Indian'
  const open = b.session.status === 'OPEN'
  const bench = b.state.indices[0]

  // ── state
  const breadth = b.state.breadth
    ? `Breadth: ${b.state.breadth.advancing} of ${b.state.breadth.advancing + b.state.breadth.declining + b.state.breadth.unchanged} ${b.state.breadth.universe.replace(/^\d+ /, '')} up, ${b.state.breadth.declining} down.`
    : 'Breadth unavailable.'
  const state = [
    b.state.indices.length ? `${b.state.indices.map(q => `${q.name} ${pct(q)}`).join(' · ')}.` : 'Index quotes unavailable.',
    breadth,
    b.state.indexWhy ? `${bench?.name ?? 'Index'} evidence: ${b.state.indexWhy}.` : '',
    `Session: ${open ? 'open' : b.session.status.toLowerCase()} — last trade ${timeLabel(b.session.lastTrade, b)}.`,
  ].filter(Boolean).join(' ')

  // ── sectors
  const sectors = b.sectors.strongest.length
    ? `Strongest: ${quoteList(b.sectors.strongest)}. Weakest: ${quoteList(b.sectors.weakest)}. (${b.sectors.basis})`
    : 'Sector data unavailable.'

  // ── movers
  const up = b.movers.filter(m => m.changePct > 0), down = b.movers.filter(m => m.changePct < 0)
  const mv = (ms: typeof b.movers) => ms.map(m => `${m.symbol.replace(/\.NS$/, '')} ${pct(m)} (${m.summary})`).join('; ')
  const movers = b.movers.length ? [up.length ? `Up: ${mv(up)}.` : '', down.length ? `Down: ${mv(down)}.` : ''].filter(Boolean).join(' ') : 'Mover data unavailable.'

  // ── cross-asset
  const crossAsset = b.crossAsset.length
    ? `Notable: ${b.crossAsset.map(crossItem).join(', ')}.`
    : `No notable moves${b.crossAssetChecked.length ? ` (checked ${b.crossAssetChecked.join(', ')})` : ''}.`

  // ── events
  const events = b.events.length
    ? b.events.map(e => {
        const linked = e.touches.filter(t => t.type !== 'country').slice(0, 4).map(t => `${t.name} (${t.via})`)
        const where = e.touches.filter(t => t.type === 'country').map(t => t.name).join(', ')
        return `“${e.title}” — ${where}${linked.length ? `; related: ${linked.join(', ')}` : ''}.`
      }).join(' ')
    : 'No major world events (M6+ earthquakes in 48h, outbreak reports in 14 days) linked to countries, companies or commodities in the graph.'

  // ── themes
  const themes = b.themes.length
    ? b.themes.map(t => `${t.title}: ${t.stories} related headlines from ${t.sources} sources; coincides with ${t.moves.slice(0, 3).map(q => `${short(q.name)} ${pct(q)}`).join(', ')}.`).join(' ')
    : 'No theme met the bar (≥3 stories from ≥2 sources plus a related price move).'

  // ── upcoming
  const upcoming = b.upcoming.length
    ? b.upcoming.map(u => `${u.dateLabel} — “${u.title}”${u.impact ? ` (${u.impact} impact)` : ''}`).join(' · ')
    : 'No scheduled releases or earnings found for the next 7 days.'

  // ── summary
  const dir = !bench ? null : bench.changePct >= 0.3 ? 'higher' : bench.changePct <= -0.3 ? 'lower' : 'little changed'
  const summary = [
    bench && dir ? `${name} stocks ${open ? `are ${dir} in today's session` : `closed ${dir} (session ${b.session.date})`}: ${b.state.indices.slice(0, 3).map(q => `${q.name} ${pct(q)}`).join(', ')}.` : '',
    b.state.breadth ? `${b.state.breadth.advancing} of ${b.state.breadth.advancing + b.state.breadth.declining + b.state.breadth.unchanged} ${b.state.breadth.universe.replace(/^\d+ /, '')} up.` : '',
    b.sectors.strongest[0] && b.sectors.weakest[0] ? `Strongest sector ${short(b.sectors.strongest[0].name)} ${pct(b.sectors.strongest[0])}; weakest ${short(b.sectors.weakest[0].name)} ${pct(b.sectors.weakest[0])}.` : '',
    b.crossAsset.length ? `Alongside: ${b.crossAsset.slice(0, 2).map(crossItem).join(', ')}.` : '',
    b.themes[0] ? `Most covered theme: ${b.themes[0].title} (${b.themes[0].stories} stories).` : '',
  ].filter(Boolean).join(' ')

  const out: BrainText = { summary, sections: { state, sectors, movers, crossAsset, events, themes, upcoming } }
  for (const t of [summary, ...Object.values(out.sections)]) assertWording(t)
  return out
}

/** Throws if our own wording breaks the rule (quoted third-party titles excepted). */
export function assertWording(text: string): void {
  const own = text.replace(/“[^”]*”/g, '')
  if (BANNED.test(own) || PREDICTIVE.test(own)) throw new Error(`brain wording rule violated: ${text}`)
}
