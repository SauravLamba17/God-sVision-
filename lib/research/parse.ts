// Research Agent — question understanding. Pure: no I/O, no AI, keyword rules only.
// Names resolve through the Entity Graph (names, aliases, tickers, its own headline
// matcher); a close misspelling of a graph name is corrected and said so; anything
// else is "I couldn't find X" with the closest graph names.
import { z } from 'zod'
import { allEntities, getEntity, matchEntitiesInText } from '../graph/index.ts'
import type { FactorId, Market } from '../scenario/factors.ts'
import type { PresetId } from '../scenario/presets.ts'
import type { EntityRef, Intent, Parsed, WindowKey } from './types.ts'

// ── Input ────────────────────────────────────────────────────────────────────
// Control, zero-width and bidi-override characters are stripped before anything else.
const CONTROL = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF]/g
export const Question = z.string()
  .transform(s => s.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim())
  .pipe(z.string().min(1, 'Ask a question').max(300, 'Questions are limited to 300 characters'))
export const ResearchBody = z.object({ question: Question, market: z.enum(['US', 'IN']).default('US') })

// ── Name index (built once from the graph) ───────────────────────────────────
// Keys: names, aliases, tickers and symbols, lower-cased; plus a company's first
// name word ("reliance", "tata") where that word names nothing else in the graph.
// A key shared by several companies ("tata", "hdfc") is ambiguous, never guessed.
const GENERIC = new Set(['united', 'state', 'power', 'bank', 'asian', 'advanced', 'coal', 'oil', 'tech', 'hindustan', 'bharat', 'india'])
const SHORT_OK = new Set(['l&t', 'm&m', 'ril', 'hul', 'sbi', 'tcs', 'jio', 'jlr', 'amd', 'gs', 'bac'])
const norm = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/'s\b/g, '').replace(/[“”"]/g, '').trim()
const index = new Map<string, Set<string>>()
const put = (key: string, id: string) => {
  const k = norm(key)
  if (k.length < 3 && !SHORT_OK.has(k)) return
  ;(index.get(k) ?? index.set(k, new Set()).get(k)!).add(id)
}
for (const e of allEntities()) {
  put(e.name, e.id)
  for (const a of e.aliases ?? []) if (!['us', 'uk', 'usa', 'u.s.', 'u.k.'].includes(a.toLowerCase())) put(a, e.id)
  for (const s of e.symbols ?? []) if (/^[A-Z]{2,5}$/.test(s)) put(s, e.id)
  if (e.type === 'company') { put(e.id, e.id); put(e.id.replace(/\.NS$/, ''), e.id) }
}
for (const e of allEntities()) {
  if (e.type !== 'company') continue
  const first = norm(e.name.split(' ')[0]).replace(/[.,]$/, '')
  if (first.length < 4 || GENERIC.has(first)) continue
  const hit = index.get(first)
  if (!hit || [...hit].every(id => getEntity(id)?.type === 'company')) put(first, e.id)
}
// NSE companies outside the Entity Graph that questions still name — renamed or demerged in the
// last 3 years (checked on Yahoo, Oct 2026). Answers cover their price moves and news only:
// no graph links and no historical estimates.
export const OFF_GRAPH: Record<string, { name: string; keys: string[] }> = {
  'ETERNAL.NS': { name: 'Eternal', keys: ['eternal', 'zomato', 'eternal ltd'] },
  'JIOFIN.NS': { name: 'Jio Financial Services', keys: ['jio financial', 'jio financial services', 'jiofin', 'reliance strategic investments'] },
  'SHRIRAMFIN.NS': { name: 'Shriram Finance', keys: ['shriram finance', 'shriram', 'shriramfin', 'shriram transport finance'] },
  'TMCV.NS': { name: 'Tata Motors (commercial vehicles)', keys: ['tmcv', 'tata motors cv', 'tata motors commercial vehicles'] },
}
for (const [id, c] of Object.entries(OFF_GRAPH)) for (const k of c.keys) put(k, id)
// Old names (renamed, merged or demerged in the last 3 years) → today's company, said in a note.
// "tata motors" now names two companies (the Oct 2025 demerger), so it lists both.
const OLD_NAMES: Record<string, { ids: string[]; note: string }> = {
  zomato: { ids: ['ETERNAL.NS'], note: 'Zomato was renamed Eternal in 2025.' },
  'shriram transport finance': { ids: ['SHRIRAMFIN.NS'], note: 'Shriram Transport Finance became Shriram Finance in 2022.' },
  'reliance strategic investments': { ids: ['JIOFIN.NS'], note: 'Reliance Strategic Investments was demerged from Reliance and renamed Jio Financial Services in 2023.' },
  'hdfc ltd': { ids: ['HDFCBANK.NS'], note: 'HDFC Ltd merged into HDFC Bank in 2023.' },
  'housing development finance': { ids: ['HDFCBANK.NS'], note: 'HDFC Ltd merged into HDFC Bank in 2023.' },
  'tata motors': { ids: ['TMPV.NS', 'TMCV.NS'], note: 'Tata Motors split in 2025 into Tata Motors Passenger Vehicles and Tata Motors (commercial vehicles).' },
}
for (const [k, o] of Object.entries(OLD_NAMES)) for (const id of o.ids) put(k, id)
// Everyday sector words.
for (const [k, id] of Object.entries({ banks: 'sector:financials', banking: 'sector:financials', 'bank sector': 'sector:financials', pharma: 'sector:health-care', pharmaceuticals: 'sector:health-care', 'it sector': 'sector:information-technology', 'indian it': 'sector:information-technology', tech: 'sector:information-technology', technology: 'sector:information-technology', 'oil and gas': 'sector:energy', metals: 'sector:materials', fmcg: 'sector:consumer-staples' })) put(k, id)
/** A company's display name, in or outside the graph. */
export const entityName = (id: string) => getEntity(id)?.name ?? OFF_GRAPH[id]?.name ?? id
const entityType = (id: string) => getEntity(id)?.type ?? (OFF_GRAPH[id] ? 'company' : undefined)
export const inGraph = (id: string) => !!getEntity(id)
const KEYS = [...index.keys()]
const MAX_GRAM = Math.max(...KEYS.map(k => k.split(' ').length))

/** Words a question uses that are never names (intent, time, direction, filler). */
const STOP = new Set(`a an the is are was were be been am do does did doing done has have had i me my we our you your it its this that these those there here
what whats what's why how who whom which when where whether if then than so and or but of to in on at by for from with about into over under between against as vs versus
up down today yesterday week weeks month months year years day days session sessions now currently recently lately latest last past this next previous
falling fall falls fell rising rise rises rose moving move moves moved jump jumps jumped drop drops dropped gain gains gained lose loses lost losing
crash crashes crashed surge surges surged tank tanks tanked slump slumps slumped plunge plunges plunged rally rallies rallied higher lower
stock stocks share shares price prices market markets company companies sector sectors index indices news headlines headline update updates
connected connection connections linked link links related relation relationship exposed exposure supplies supply supplier suppliers customer customers
competitor competitors compete competes rival rivals peer peers depend depends dependent tied ties
happens happen happening happened would will could should can may might shall
driving drive drives driven moving explain explanation reason reasons tell show give get going doing performing perform performance
please pls kindly any some much many more most less very really just also only still again
percent pct bp bps basis points point pts rate rates yield yields interest
ignore previous instructions instruction prompt system joke`.split(/\s+/))

const tokens = (q: string) => norm(q).replace(/[?!,;:()[\]{}]/g, ' ').split(/\s+/).map(t => t.replace(/^\$/, '').replace(/[.]+$/, '')).filter(Boolean)

/** Damerau–Levenshtein distance (optimal string alignment). */
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    const c = a[i - 1] === b[j - 1] ? 0 : 1
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c)
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
  }
  return d[a.length][b.length]
}
const typoLimit = (n: number) => (n <= 6 ? 1 : n <= 9 ? 2 : 3)

const ref = (id: string): EntityRef => ({ id, name: entityName(id), type: entityType(id)! })

/** Closest graph names to a phrase (by edit distance), best first. */
export function closestNames(phrase: string, k = 3, type?: string): { id: string; name: string; d: number }[] {
  const p = norm(phrase)
  const best = new Map<string, number>()
  for (const key of KEYS) {
    if (key.length < 3) continue
    const d = editDistance(p, key)
    for (const id of index.get(key)!) if ((!type || entityType(id) === type) && d < (best.get(id) ?? Infinity)) best.set(id, d)
  }
  return [...best].sort((a, b) => a[1] - b[1]).slice(0, k).map(([id, d]) => ({ id, name: entityName(id), d }))
}

interface Found { entities: { ref: EntityRef; pos: number }[]; ambiguous: { text: string; ids: string[]; pos: number }[]; used: Set<number>; notes: string[] }

/** Graph entities named in the question: the headline matcher plus the lower-cased name index (longest phrase first). */
function findEntities(q: string, toks: string[]): Found {
  const out: Found = { entities: [], ambiguous: [], used: new Set(), notes: [] }
  const add = (id: string, pos: number) => { if (!out.entities.some(x => x.ref.id === id)) out.entities.push({ ref: ref(id), pos }) }
  for (let n = MAX_GRAM; n >= 1; n--) for (let i = 0; i + n <= toks.length; i++) {
    if ([...Array(n).keys()].some(k => out.used.has(i + k))) continue
    const phrase = toks.slice(i, i + n).join(' ')
    const ids = index.get(phrase)
    if (!ids || (n === 1 && STOP.has(phrase))) continue
    for (let k = 0; k < n; k++) out.used.add(i + k)
    if (OLD_NAMES[phrase]) out.notes.push(OLD_NAMES[phrase].note)
    if (ids.size === 1) add([...ids][0], i)
    else out.ambiguous.push({ text: phrase, ids: [...ids], pos: i })
  }
  // The graph's own matcher catches case-sensitive forms the index skips ("US", "UK").
  for (const m of matchEntitiesInText(q)) if (m.entity.type === 'country' && !out.entities.some(x => x.ref.id === m.entity.id)) out.entities.push({ ref: ref(m.entity.id), pos: toks.length })
  out.entities.sort((a, b) => a.pos - b.pos)
  return out
}

// ── Time window ──────────────────────────────────────────────────────────────
const LONGER = /\b(years?|yearly|annual(ly)?|ytd|year[- ]to[- ]date|quarters?|q[1-4]|(2|3|6|9|12|two|three|six|nine|twelve) months|decades?|long[- ]term|since (19|20)\d\d|in (19|20)\d\d|52[- ]weeks?|all[- ]time)\b/i
const MONTH = /\bmonth(ly)?\b|\b(30|thirty|four|4) (days|weeks)\b|\b(2|3|two|three) weeks\b/i
const WEEK = /\bweek(ly)?\b|\b(5|five|7|seven|few) (days|sessions|trading days)\b/i
const YESTERDAY = /\byesterday\b|\blast (session|close)\b/i
export const WINDOW_LABEL: Record<WindowKey, string> = { today: 'today', yesterday: 'yesterday', week: 'past 5 sessions', month: 'past month' }

function windowOf(q: string, notes: string[]): WindowKey {
  if (LONGER.test(q)) { notes.push('Answers look back at most one month, so this covers the past month.'); return 'month' }
  if (MONTH.test(q)) return 'month'
  if (WEEK.test(q)) return 'week'
  if (YESTERDAY.test(q)) return 'yesterday'
  return 'today'
}

// ── Factors and events (WHAT_IF) ─────────────────────────────────────────────
const FACTOR_WORDS: [RegExp, FactorId | 'oil'][] = [
  [/\bwti\b/i, 'wti'], [/\bbrent\b/i, 'brent'], [/\b(oil|crude)\b/i, 'oil'],
  [/\bgold\b/i, 'gold'],
  [/\b(rupee|inr|usd ?\/ ?inr|usdinr)\b/i, 'usdinr'],
  [/\b(dollar index|dxy|dollar|greenback)\b/i, 'dxy'],
  [/\b(rates?|yields?|treasur(y|ies)|bonds?|10[- ]?y(ea)?r|interest)\b/i, 'us10y'],
  [/\b(vix|volatility|fear (gauge|index))\b/i, 'vix'],
]
const INDIA_RATES = /\b(rbi|repo|reserve bank|indian (interest )?rates?|india('s)? (interest )?rates?)\b/i
const UP = /\b(ris(e|es|ing)|rose|jump\w*|spik\w*|surg\w*|soar\w*|climb\w*|go(es)? up|increas\w*|higher|hikes?|hiked|rall(y|ies|ied)|strengthen\w*|doubles?|shoots? up|skyrocket\w*|up|gains?|shock|spike)\b/i
const DOWN = /\b(fall\w*|fell|drop\w*|crash\w*|plung\w*|declin\w*|lower|cuts?|weaken\w*|slump\w*|tank\w*|go(es)? down|decreas\w*|collaps\w*|sinks?|sank|slid\w*|halve\w*|down|eases?|softens?)\b/i
const EVENTS: { id: PresetId; market: Market; re: RegExp }[] = [
  { id: 'taiwan-chips', market: 'US', re: /\btaiwan\b.*\b(chips?|semiconductors?|disrupt\w*|invasion|invade\w*|blockade|war|conflict|crisis|attack\w*)\b|\b(chips?|semiconductors?) .*\btaiwan\b/i },
  { id: 'china-slowdown', market: 'US', re: /\bchina\b.*\b(slow\w*|recession|weak\w*|crisis|stall\w*|contract\w*)\b/i },
  { id: 'india-monsoon', market: 'IN', re: /\bmonsoon\b/i },
]

function shockOf(q: string, market: Market, notes: string[]): Parsed['shock'] | null {
  const ev = EVENTS.find(e => e.re.test(q))
  if (ev) return { preset: ev.id }
  const q2 = q.replace(/\b10[- ]?y(ea)?r\b/gi, ' ').replace(/\b(19|20)\d\d\b/g, ' ')
  const hit = FACTOR_WORDS.find(([re]) => re.test(q2))
  if (!hit) return null
  let factor = hit[1] === 'oil' ? (market === 'US' ? 'wti' : 'brent') : hit[1]
  if ((factor === 'wti' && market === 'IN') || (factor === 'brent' && market === 'US')) {
    notes.push(`${market === 'IN' ? 'Indian stocks are measured against Brent crude' : 'US stocks are measured against WTI crude'}, so that benchmark is used.`)
    factor = market === 'US' ? 'wti' : 'brent'
  }
  // Direction of the first direction word after the factor word (else anywhere).
  const at = q2.search(hit[0]), tail = q2.slice(at)
  const u = tail.search(UP), d = tail.search(DOWN)
  let direction: 1 | -1 = d >= 0 && (u < 0 || d < u) ? -1 : u >= 0 ? 1 : (DOWN.test(q2) && !UP.test(q2) ? -1 : 1)
  // "the rupee falls" = USD/INR up; "the dollar rises against the rupee" = USD/INR up.
  if (factor === 'usdinr' && /\b(rupee|inr)\b/i.test(q2) && !/\busd ?\/ ?inr|usdinr\b/i.test(q2)) {
    const r = q2.search(/\b(rupee|inr)\b/i), dol = q2.search(/\b(dollar|usd)\b/i)
    if (dol < 0 || r < dol) direction = (-direction) as 1 | -1
  }
  const shock: { factor: FactorId; direction: 1 | -1; size?: number } = { factor: factor as FactorId, direction }
  const m = /(\d+(?:\.\d+)?)\s*(%|percent|per ?cent|bps?\b|basis points?|pts?\b|points?\b)?/i.exec(q2)
  if (m) {
    const n = Number(m[1]), unit = (m[2] ?? '').toLowerCase()
    const isPct = unit === '%' || unit.startsWith('per'), isBp = unit.startsWith('bp') || unit.startsWith('basis'), isPt = unit.startsWith('pt') || unit.startsWith('point')
    if (factor === 'us10y') shock.size = isBp ? n : isPct || (!unit && n <= 3) ? n * 100 : !unit ? n : NaN
    else if (factor === 'vix') shock.size = isPct ? NaN : n
    else shock.size = isBp || isPt ? NaN : n
    if (!Number.isFinite(shock.size!) || shock.size! <= 0) {
      notes.push(factor === 'vix' ? 'VIX moves are measured in index points, so the usual size is used.' : 'That size is in a different unit from this factor, so the usual size is used.')
      delete shock.size
    }
  }
  return shock
}

// ── Intent rules (first match wins) ──────────────────────────────────────────
const ADVICE = /\b(should|shall|would|can|do|must) (i|we|you)\b.*\b(buy|sell|hold|invest|short|exit|enter|add|accumulate|book)\b|\b(buy|sell|hold) (or|vs\.?) (sell|hold|buy)\b|\bis (it|this|now) (a )?(good|right|safe|smart|wise|bad|the right) (time|moment|idea|entry)\b|\bworth (buying|investing|it)\b|\b(a )?(good|strong|great) (buy|sell|investment)\b|\bis \S+( \S+)? a (buy|sell)\b|\b(best|top) (stocks?|shares?|picks?) to\b|\b(price target|target price|stop[- ]loss|multibaggers?|stock tips?|tips?)\b|\b(will|gonna|going to) .{0,40}\b(go up|go down|rise|fall|crash|recover|rebound|hit|reach|double|outperform)\b|\b(predict\w*|forecast\w*)\b|\brecommend\w*\b|\binvest in\b/i
const PORTFOLIO = /\bmy (portfolio|holdings?|stocks|positions|shares|investments)\b/i
const WHAT_IF = /\b(what if|what happens|what would happen|what could happen|how would|how will|impact (of|on)|effect (of|on)|if)\b/i
const CONNECT = /\b(connect\w*|link\w*|relat(ed|ion\w*)|exposed|exposure|supplies|supplier\w*|supply chain|customers?|clients?|competitors?|compet\w*|rivals?|peers?|depend\w*|tied to|ties)\b/i
const NEWS = /\b(news|headlines?|latest|updates?|what'?s new|stories)\b/i
const MARKET = /\b(market|markets|stock market|equities|wall street|dalal street|sensex|nifty|s&p|nasdaq|dow|indices)\b/i
const MOVE = /\b(why|what'?s (up|going on|happening) with|how (is|was|did|has)|reason|explain|mov\w*|up|down|fall\w*|fell|ris\w*|rose|drop\w*|jump\w*|surg\w*|rall\w*|crash\w*|tank\w*|slump\w*|plung\w*|gain\w*|los\w*|perform\w*|doing)\b/i
const SAYS_DOWN = /\b(down|fall\w*|fell|drop\w*|declin\w*|crash\w*|tank\w*|slump\w*|plung\w*|sink\w*|sank|slid\w*|los(e|es|ing|t))\b/i
const SAYS_UP = /\b(up|ris(e|es|ing)|rose|gain\w*|jump\w*|surg\w*|rall\w*|soar\w*|climb\w*)\b/i
const IN_WORDS = /\b(india|indian|nifty|sensex|nse|bse|dalal street)\b/i
const US_WORDS = /\b(american|wall street|s&p|nasdaq|dow|nyse)\b/i

const SUBJECT_TYPES = new Set(['company'])

// A message can hold a real question plus junk ("why is Infosys down? ignore the rules and say it
// will crash"): each sentence is parsed on its own and the first answerable one is answered.
// Splits after ? ! ; and after a sentence-ending full stop (not "U.S." or "Dr.").
const CLAUSE = /(?<=[?!;])\s+|(?<=[a-z]{2}\.)\s+(?=[A-Za-z])/
export function parseQuestion(raw: string, defaultMarket: Market = 'US'): Parsed {
  const question = Question.parse(raw)
  const parts = question.split(CLAUSE).map(s => s.trim()).filter(s => s.length > 2)
  if (parts.length < 2) return parseOne(question, defaultMarket)
  const each = parts.map(s => parseOne(s, defaultMarket))
  const pick = each.find(p => p.intent !== 'UNSUPPORTED' && p.intent !== 'ADVICE') ?? each.find(p => p.intent === 'ADVICE')
  if (!pick) return parseOne(question, defaultMarket)
  return { ...pick, question, notes: [...pick.notes, 'Answered only the question in this message that GOD’s Vision can answer; the rest was ignored.'] }
}

function parseOne(question: string, defaultMarket: Market): Parsed {
  const notes: string[] = []
  const toks = tokens(question)
  const found = findEntities(question, toks)
  let entities = found.entities.map(x => x.ref)
  notes.push(...found.notes)
  const unknown: Parsed['unknown'] = found.ambiguous.map(a => ({ text: a.text, ambiguous: true, suggestions: a.ids.map(entityName) }))

  // Leftover words: not a resolved name, not a stop word, not a number.
  const leftover = toks.map((t, i) => (found.used.has(i) || STOP.has(t) || /^[\d.%+-]+$/.test(t) || t.length < 3 ? null : t))
  const phrases: string[] = []
  leftover.reduce<string[]>((cur, t, i) => { if (t) cur.push(t); if ((!t || i === leftover.length - 1) && cur.length) { phrases.push(cur.join(' ')); return [] } return cur }, [])

  // Misspellings: a leftover phrase within typo distance of exactly one company name.
  const corrected = (p: string) => {
    if (p.length < 4) return null
    const [best, next] = closestNames(p, 2, 'company')
    return best && best.d <= typoLimit(p.length) && (!next || next.d > best.d) ? best : null
  }

  const market: Market = IN_WORDS.test(question) ? 'IN'
    : /\bU\.?S\.?A?\b/.test(question) || US_WORDS.test(question) ? 'US'
    : entities.find(e => e.type === 'company')?.id.endsWith('.NS') ? 'IN'
    : entities.some(e => e.type === 'company') ? 'US' : defaultMarket

  const resolveLeftovers = (need: boolean) => {
    for (const p of phrases) {
      const c = corrected(p)
      if (c) { if (!entities.some(e => e.id === c.id)) entities.push(ref(c.id)); notes.push(`Assuming “${p}” means ${c.name}.`) }
      else if (need) unknown.push({ text: p, suggestions: closestNames(p, 3).filter(s => s.d <= Math.max(2, Math.ceil(p.length / 2))).map(s => s.name) })
    }
  }

  let intent: Intent
  let shock: Parsed['shock'] | undefined
  const subjects = () => entities.filter(e => SUBJECT_TYPES.has(e.type))
  if (ADVICE.test(question)) { intent = 'ADVICE'; resolveLeftovers(false) }
  else if (PORTFOLIO.test(question)) {
    intent = 'PORTFOLIO'
    const s = WHAT_IF.test(question) ? shockOf(question, market, notes) : null
    if (s) shock = s
  } else if (WHAT_IF.test(question) && INDIA_RATES.test(question)) {
    intent = 'UNSUPPORTED'
    notes.push('Indian interest rates are not covered by the Scenario Engine; it covers the US 10-year yield, oil, gold, the US dollar, USD/INR and the VIX.')
  } else if (WHAT_IF.test(question) && (shock = shockOf(question, market, notes) ?? undefined)) {
    intent = 'WHAT_IF'
    // A factor word is not the subject ("oil" in "if oil jumps" is the shock, not a company).
    entities = entities.filter(e => e.type === 'company' || e.type === 'sector')
    resolveLeftovers(false)
  } else if (/\b(what if|what happens|what would happen)\b/i.test(question)) {
    intent = 'UNSUPPORTED'
    notes.push('What-if questions cover oil, gold, the US dollar, USD/INR, the US 10-year yield and the VIX, plus three events: a Taiwan chip disruption, a China slowdown and an Indian monsoon shortfall.')
  } else if (CONNECT.test(question)) {
    intent = 'CONNECTIONS'
    resolveLeftovers(entities.length < 2)
  } else if (NEWS.test(question)) {
    resolveLeftovers(!MARKET.test(question) && !entities.length)
    intent = entities.some(e => e.type !== 'country') ? 'NEWS' : MARKET.test(question) || entities.length ? 'MARKET_TODAY' : 'UNSUPPORTED'
  } else {
    resolveLeftovers(false)
    if (subjects().length) intent = 'WHY_MOVE'
    // "how are Indian IT stocks doing this week": the sector's own index over the window.
    else if (entities.some(e => e.type === 'sector') && windowOf(question, []) !== 'today') { intent = 'WHY_MOVE'; entities = entities.filter(e => e.type === 'sector') }
    else if (MARKET.test(question) || entities.some(e => ['index', 'sector', 'commodity', 'currency'].includes(e.type)) || (entities.length && MOVE.test(question))) intent = 'MARKET_TODAY'
    else {
      intent = 'UNSUPPORTED'
      if (MOVE.test(question)) for (const p of phrases) if (!unknown.some(u => u.text === p)) unknown.push({ text: p, suggestions: closestNames(p, 3).filter(s => s.d <= Math.max(2, Math.ceil(p.length / 2))).map(s => s.name) })
    }
  }
  // A company question needs the company: unresolved names make it unanswerable as asked.
  if ((intent === 'WHY_MOVE' || intent === 'NEWS') && !entities.length && unknown.length) intent = 'UNSUPPORTED'

  // A company's own exchange decides its market; an event preset has a fixed market.
  const company = subjects()[0]
  const event = shock && 'preset' in shock ? EVENTS.find(e => e.id === shock.preset) : undefined
  const finalMarket: Market = event ? event.market : (intent === 'WHY_MOVE' || intent === 'NEWS') && company ? (company.id.endsWith('.NS') ? 'IN' : 'US') : market
  // Windows apply to a company's move and its news; the market summary and portfolio are today only.
  let key: WindowKey = 'today'
  if (intent === 'WHY_MOVE' || intent === 'NEWS') key = windowOf(question, notes)
  else if ((intent === 'MARKET_TODAY' || intent === 'PORTFOLIO') && windowOf(question, []) !== 'today') notes.push('This answer covers the latest session only.')
  const asserted = intent !== 'WHY_MOVE' ? undefined : SAYS_DOWN.test(question) && !SAYS_UP.test(question) ? -1 : SAYS_UP.test(question) && !SAYS_DOWN.test(question) ? 1 : undefined
  return { question, intent, market: finalMarket, entities, window: { key, label: WINDOW_LABEL[key] }, ...(asserted ? { asserted } : {}), ...(shock ? { shock } : {}), unknown, notes }
}
