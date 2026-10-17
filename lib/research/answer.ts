// Research Agent — the deterministic answer. Pure: turns a FactSheet into a headline
// and short sections where every sentence cites the facts it rests on ([n] = fact n).
// WORDING: "moved with / coincided with / historically tended to". Never "because",
// "caused", "will", "predict", "forecast", "should buy/sell" or price targets; quoted
// headlines (“…”) are third-party text and excluded from the check.
import { BANNED } from '../evidence/summary.ts'
import { p1, SECTIONS } from './build.ts'
import { EXAMPLES, type Answer, type Fact, type FactSheet, type Parsed, type Sentence } from './types.ts'

export const LABEL_AUTO = 'Automatic summary from GOD’s Vision data'
export const RESEARCH_BANNED = /\b(because|caus(e|ed|es|ing)|will|predict\w*|forecast\w*|should (buy|sell|hold|invest)|price targets?|target price)\b/i
/** Throws if our own wording breaks the rule (quoted third-party titles excepted). */
export function assertResearchWording(text: string): void {
  const own = text.replace(/“[^”]*”/g, '')
  if (RESEARCH_BANNED.test(own) || BANNED.test(own)) throw new Error(`research wording rule violated: ${text}`)
}

export { EXAMPLES }

const end = (t: string) => (/[.!?]$/.test(t.replace(/[”)]+$/, '')) ? t : `${t}.`)
const num = (v: FactSheet['key'][string]) => (typeof v === 'number' ? v : null)
const ids = (...xs: (FactSheet['key'][string] | undefined)[]) => xs.filter((x): x is number => typeof x === 'number')
const abs1 = (n: number) => p1(Math.abs(n)).replace(/^[+−-]/, '')

function headline(fs: FactSheet): Sentence {
  const { parsed: p, key: k, facts } = fs
  const subject = p.entities.find(e => e.type === 'company') ?? p.entities[0]
  const name = typeof k.name === 'string' ? k.name : subject?.name ?? ''
  const fact = (id: unknown) => facts.find(f => f.id === id)
  switch (p.intent) {
    case 'WHY_MOVE': {
      if (num(k.stale)) return { text: `${name}’s latest quote is not from today, so today’s move is not available yet.`, cites: ids(k.stale, k.move) }
      if (num(k.move) && num(k.moveValue) != null) {
        const v = num(k.moveValue)!, when = String(k.when)
        const head = `${name} ${when === 'today' ? 'is' : 'was'} ${v >= 0 ? 'up' : 'down'} ${abs1(v)} ${when}`
        const clauses = String(k.clauses ?? ''), clauseIds = String(k.clauseIds ?? '').split(',').filter(Boolean).map(Number)
        if (!clauses && !num(k.topNews)) return { text: `${head}; no clear driver found in the market, sector, peer, news, exposure or calendar data.`, cites: ids(k.move, k.noDriver) }
        // Strong drivers by name, then the strongest quotable headline — never a bare count.
        const parts = [clauses, num(k.topNews) ? String(k.topNewsText) : ''].filter(Boolean).join('; ')
        return { text: `${head}; ${parts}.`, cites: [num(k.move)!, ...clauseIds, ...ids(k.topNews)] }
      }
      if (num(k.ret) && num(k.retValue) != null) {
        const r = num(k.retValue)!, label = String(k.label), span = label.startsWith('session') ? `in the ${label}` : `over the ${label}`
        let t = `${name} is ${r >= 0 ? 'up' : 'down'} ${abs1(r)} ${span}`
        const cites = [num(k.ret)!]
        const x = num(k.idxValue)
        if (x != null && num(k.idx)) {
          t += Math.sign(x) !== Math.sign(r) ? `, while the ${k.idxName} moved ${p1(x)}`
            : `, ${Math.abs(r) > Math.abs(x) + 0.5 ? 'more than' : Math.abs(r) < Math.abs(x) - 0.5 ? 'less than' : 'in line with'} the ${k.idxName} (${p1(x)})`
          cites.push(num(k.idx)!)
        }
        const big = num(k.bigValue)
        if (big != null && num(k.big) && !label.startsWith('session')) {
          t += `; the biggest ${big < 0 ? 'drop' : 'gain'} came on ${k.bigDay} (${p1(big)})`
          cites.push(num(k.big)!)
          if (num(k.along) && num(k.alongValue) != null) { t += ` alongside ${k.alongName} (${p1(num(k.alongValue)!)})`; cites.push(num(k.along)!) }
          if (num(k.bigNews)) { t += `, the day ${k.bigNewsText}`; cites.push(num(k.bigNews)!) }
        }
        const top = fact(k.top), bottom = fact(k.bottom)
        if (top && bottom) { t += `; strongest constituent ${top.label} (${p1(top.value!)}), weakest ${bottom.label} (${p1(bottom.value!)})`; cites.push(top.id, bottom.id) }
        return { text: `${t}.`, cites }
      }
      break
    }
    case 'WHAT_IF': {
      if (num(k.invalid)) return { text: fact(k.invalid)!.text, cites: ids(k.invalid) }
      const title = String(k.titleText ?? '')
      const events = facts.filter(f => f.kind === 'event-link')
      if (events.length) return { text: `${title}: directional only; ${events.length} listed companies are linked to it, including ${events.slice(0, 3).map(f => f.text.split(':')[0]).join(', ')}.`, cites: [num(k.title)!, ...events.slice(0, 3).map(f => f.id)] }
      const focus = facts.find(f => f.kind === 'focus')
      if (focus) return { text: `Under “${title}”: ${focus.text}`, cites: ids(k.title, focus.id) }
      const h = [k.helped, k.helped2].map(fact).filter(Boolean) as Fact[], d = [k.hurt, k.hurt2].map(fact).filter(Boolean) as Fact[]
      if (!h.length && !d.length) return { text: `Under “${title}”, no stock has a reliable historical link, so no estimates are shown.`, cites: ids(k.title, k.range) }
      const list = (fs: Fact[]) => fs.map(f => `${f.label} (${p1(f.value!)})`).join(' and ')
      const parts = [h.length ? `the stocks that historically tended to gain most were ${list(h)}` : '', d.length ? `${h.length ? 'those' : 'the stocks'} that tended to fall most were ${list(d)}` : ''].filter(Boolean)
      const beyond = num(k.beyond) ? ' This shock is beyond the usual historical range, so the estimate is less reliable.' : ''
      return { text: `Under “${title}”, ${parts.join(', and ')}.${beyond}`, cites: [...ids(k.title), ...h.map(f => f.id), ...d.map(f => f.id), ...(beyond ? ids(k.range) : [])] }
    }
    case 'CONNECTIONS': {
      if (num(k.noPath)) return { text: fact(k.noPath)!.text, cites: ids(k.noPath) }
      const steps = facts.filter(f => f.kind === 'path-step')
      const [a, b] = p.entities
      if (steps.length === 1) return { text: `${a.name} and ${b.name} are directly linked: ${steps[0].label}.`, cites: [steps[0].id] }
      if (steps.length > 1) return { text: `${a.name} and ${b.name} are connected in ${steps.length} steps: ${steps.map(f => f.label).join('; ')}.`, cites: steps.map(f => f.id) }
      const links = facts.filter(f => f.kind === 'link')
      if (links.length) return { text: `${name}: ${links.length} direct link${links.length > 1 ? 's' : ''} in the Entity Graph, including: ${links[0].label}.`, cites: links.slice(0, 3).map(f => f.id) }
      break
    }
    case 'MARKET_TODAY': {
      const focus = fact(k.focus), bench = fact(k.bench), br = fact(k.breadth), th = fact(k.theme)
      if (!bench) break
      const who = p.market === 'US' ? 'US' : 'Indian'
      const lead = focus ? `${focus.text}. ` : ''
      const rest = [`${who} stocks: ${bench.text}`, br ? br.text : '', th ? `most covered theme: ${th.label}` : ''].filter(Boolean).join('; ')
      return { text: `${lead}${rest}.`, cites: ids(k.focus, k.bench, k.breadth, k.theme) }
    }
    case 'NEWS': {
      const first = facts.find(f => f.kind === 'headline')
      if (first) return { text: `${num(k.news)} headline${num(k.news) === 1 ? '' : 's'} from the ${p.window.key === 'today' ? 'last 2 days' : p.window.label} name${num(k.news) === 1 ? 's' : ''} ${name}; the latest: “${first.quote}” (${first.source.name}).`, cites: [first.id] }
      if (num(k.noNews)) return { text: fact(k.noNews)!.text, cites: ids(k.noNews) }
      break
    }
    case 'PORTFOLIO': {
      const groups = facts.filter(f => f.kind === 'holdings-move' || f.kind === 'holdings-scenario')
      if (groups.length) return { text: groups.map(g => end(g.text)).join(' '), cites: groups.map(f => f.id) }
      const c = facts.find(f => f.section === 'cant')
      if (c) return { text: c.text, cites: [c.id] }
      break
    }
  }
  return { text: '', cites: [] }
}

/** The set reply for advice, unsupported questions and names that resolve to nothing. */
function fixedReply(p: Parsed): string {
  const subject = p.entities.find(e => e.type === 'company')
  if (p.intent === 'ADVICE') return 'GOD’s Vision explains what moved and what has historically moved together; it does not give buy or sell advice or price calls.'
    + (subject ? ` For ${subject.name} it can show why it is moving today or over the past week or month, its latest news, how it is connected to other companies, and its historical links to oil, rates, the dollar and other factors.` : '')
  const missing = p.unknown.map(u => u.ambiguous
    ? `“${u.text}” matches several companies: ${u.suggestions.join(', ')}. Ask about one of them.`
    : `I couldn’t find “${u.text}”${u.suggestions.length ? `. Closest matches: ${u.suggestions.join(', ')}.` : ' among the companies GOD’s Vision covers (US large caps, the Nifty 50 and a few more).'}`)
  if (missing.length) return missing.join(' ')
  return 'I can explain why a stock moved (today, this week or this month), what has historically happened when oil, rates, the dollar, the rupee, gold or the VIX moved, how companies are connected, what is driving the market today, the latest news on a company, and how your own holdings moved.'
}

export function composeAnswer(fs: FactSheet): Answer {
  const p = fs.parsed
  const fixed = p.intent === 'ADVICE' || p.intent === 'UNSUPPORTED'
  const head = fixed ? { text: fixedReply(p), cites: [] } : headline(fs)
  // No headline from data: lead with "still loading" when the time budget ran out, else the first limitation.
  if (!head.text) { const c = fs.facts.find(f => f.id === fs.key.loading) ?? fs.facts.find(f => f.section === 'cant'); if (c) { head.text = c.text; head.cites = [c.id] } }
  const sections = SECTIONS.map(({ key, title }) => {
    const facts = fs.facts.filter(f => f.section === key)
    const sentences: Sentence[] = []
    for (const f of facts) {
      // Same-day comparisons read as one sentence.
      const last = sentences.at(-1), prev = fs.facts.find(x => x.id === last?.cites.at(-1))
      if (f.kind === 'same-day' && prev?.kind === 'same-day') { last!.text = `${last!.text.replace(/\.$/, '')}; ${f.text}.`; last!.cites.push(f.id); continue }
      sentences.push({ text: end(f.text), cites: [f.id] })
    }
    return { key, title: fixed && key !== 'cant' ? (key === 'connections' ? 'What it can show: connections' : key === 'pattern' ? 'What it can show: historical pattern' : title) : title, sentences }
  }).filter(s => s.sentences.length)
  const notes = [...p.notes]
  // The question's own direction ("why is X falling") is checked against the data, never assumed.
  const moved = num(fs.key.moveValue) ?? num(fs.key.retValue)
  if (p.intent === 'WHY_MOVE' && p.asserted && moved != null && Math.abs(moved) >= 0.05 && Math.sign(moved) !== p.asserted)
    notes.push(`The question says ${p.asserted < 0 ? 'falling' : 'rising'}, but the data shows ${moved < 0 ? 'a fall' : 'a rise'} over this period.`)
  if (p.intent === 'UNSUPPORTED') notes.push(`Try: ${EXAMPLES[p.market].slice(0, 3).join(' · ')}`)
  // Sources: one entry per (name, url), listing the facts that use it.
  const sources: Answer['sources'] = []
  for (const f of fs.facts) {
    const s = sources.find(x => x.name === f.source.name && x.url === f.source.url)
    if (s) s.facts.push(f.id)
    else sources.push({ n: sources.length + 1, name: f.source.name, url: f.source.url, asOf: f.source.asOf, facts: [f.id] })
  }
  const answer: Answer = { label: LABEL_AUTO, kind: fixed ? 'fixed' : 'answer', headline: head, notes, sections, sources }
  for (const t of [head.text, ...notes, ...sections.flatMap(s => s.sentences.map(x => x.text))]) assertResearchWording(t)
  return answer
}

/** Plain-text form (reports, tests): sentences with [n] markers, then the sources. */
export function answerText(a: Answer, fs: FactSheet): string {
  const cite = (s: Sentence) => `${s.text}${s.cites.map(c => ` [${c}]`).join('')}`
  const when = (t: number | string | null) => (t == null ? '' : typeof t === 'number' ? ` · ${new Date(t).toISOString().slice(0, 16).replace('T', ' ')} UTC` : ` · ${t.slice(0, 10)}`)
  return [
    `${a.label} · data: ${fs.dataStatus.status}${fs.dataStatus.asOf ? ` (as of ${new Date(fs.dataStatus.asOf).toISOString().slice(0, 16).replace('T', ' ')} UTC)` : ''}`,
    cite(a.headline),
    ...a.notes.map(n => `Note: ${n}`),
    ...a.sections.flatMap(s => [`— ${s.title}`, ...s.sentences.map(x => `  ${cite(x)}`)]),
    ...(fs.facts.length ? ['— Sources', ...a.sources.map(s => `  ${s.name}${s.url ? ` <${s.url}>` : ''}${when(s.asOf)} → facts ${s.facts.join(', ')}`)] : []),
  ].join('\n')
}
