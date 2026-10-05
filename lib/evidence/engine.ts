// Evidence Engine — pure: no I/O, no clock reads (time comes from ctx.builtAt).
// Turns one live move plus the app's already-fetched data into scored drivers.
//
// SCORING (0–1). A driver's score estimates how much of the move it plausibly
// accounts for, from transparent arithmetic — not a model:
//
//   market    0.85 × min(|benchmark move| / |move|, 1), same direction, |benchmark| ≥ 0.25%
//             (assumes beta ≈ 1: if the index fell 2% and the stock 3%, ~2/3 of it is "the market")
//   sector    0.75 × min(|sector move| / |move|, 1), same direction, |sector| ≥ 0.4%
//   peers     0.6 × (share of linked peers moving ≥1% the same way) × min(avg |peer move| / |move|, 1)
//   news      per headline: 0.55 × context × focus × recency (+0.15 if keyword tone matches the move)
//               context 1 if the headline has financial/market context (shares, earnings,
//                       guidance, deal, order, rating, regulator, lawsuit, CEO, a % move…),
//                       else the headline scores 0 ("Oracle rescues Nashville Symphony")
//               focus   1 if it names ≤2 companies, else 0.6 (round-ups)
//               recency 1 (≤12h), 0.8 (≤24h), 0.5 (older), measured to the quote's market time
//               window  only headlines published after the previous session's close and
//                       no later than the quote's market time (the last trade) attach —
//                       news after the close belongs to the next session's move
//               0 if it describes a move over months ("slump 27% YTD") with no cue for this session
//               0 if the headline states a price direction opposite to the live move
//               ("shares rise 2%" on a −2% day describes another session's move)
//   related   0.3 × context × recency, same window — a headline names a linked company
//             (labelled with its graph role: peer, supplier, customer, parent, subsidiary)
//   linked    earthquakes M6+: 0.3 (M6) / 0.4 (M6.5) / 0.55 (M7+) × link weight
//               (home country 1, supplier's home 0.8, exposed country 0.6), within 48h
//             WHO outbreak reports in a linked country within 14 days: 0.15 (0.25 for health care)
//   commodity 0.45 × min(|commodity move| / 3%, 1), |move| ≥ 1% (direction-neutral: exposure can cut both ways)
//   currency  0.35 × min(|FX move| / 0.8%, 1), |move| ≥ 0.25%
//   scheduled earnings within a day: 0.6 (0.7 if reported just before this session);
//             high-impact macro release today in its currency: 0.15 (0.35 for indices)
//   volume    0.25 × min((volume / average − 1) / 2, 1), only at ≥1.8× average
//   breadth   (indices) 0.6 × share of sectors/constituents moving the same way
//   global    (indices) 0.4 × share of peer markets moving ≥0.3% the same way
//   index news: headlines naming the index, or its country plus a market term
//               (stocks, Wall Street, yields, Fed…) — × 0.8
//
// Drivers scoring < SHOW_THRESHOLD are dropped. If none reaches CLEAR_THRESHOLD
// the result leads with "no clear driver found" — a valid, honest answer.

import type { Driver, Explanation, Headline, MarketContext, Market, Quote } from './types.ts'
import { getEntity, getLinks, resolveEntity } from '../graph/index.ts'
import { summarize } from './summary.ts'

export const SHOW_THRESHOLD = 0.2
export const CLEAR_THRESHOLD = 0.3
const FLAT = 0.3 // |move| below this is "little changed"

const r2 = (n: number) => Math.round(n * 100) / 100
const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
export const fmtPct = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}%`
const sameDir = (a: number, b: number) => (a > 0 && b > 0) || (a < 0 && b < 0)
const H = 3600_000

// A company headline counts only with financial/market context — a mention of
// the name alone ("Apple pie recipe", "Oracle rescues Nashville Symphony") doesn't.
// "shares", "beats" and "misses" count only in their market sense ("shares jump",
// "beats estimates"), not as verbs ("employee shares why culture beats perks").
const SHARES = /\bshares (of|in|up|down|ris\w*|rose|fall\w*|fell|jump\w*|surg\w*|soar\w*|slump\w*|plung\w*|tumbl\w*|drop\w*|gain\w*|climb\w*|slid\w*|sink\w*|sank|hit\w*|trad\w*|end\w*|clos\w*|open\w*|rall\w*|extend\w*|advanc\w*|declin\w*|edg\w*|are|were|have|after|on|at|to)\b|\bshare price\b/i
const FINANCIAL_TERMS = /\b(stocks?|equity|earnings|results|profits?|loss(es)?|revenues?|sales|margins?|guidance|forecasts?|outlook|quarter(ly)?|Q[1-4]|deals?|acqui\w*|mergers?|takeover|buyout|stake|orders?|contracts?|ratings?|upgrades?|downgrades?|(price )?targets?|analysts?|regulat\w*|antitrust|probe|investigation|SEBI|SEC|FDA|approval|lawsuits?|sues|sued|court|settlement|fined?|penalty|layoffs?|job cuts|CEO|CFO|chairman|resigns?|appoints?|dividends?|buybacks?|IPO|listing|bonds?|debt|valuation|market cap|(beat|miss)(s|es|ed)? (estimates|expectations|forecasts?|consensus|street)|block deal|bulk deal|tariffs?|recall|bankruptcy)\b|\d+(\.\d+)?\s?%/i
type Matcher = { test(s: string): boolean }
const FINANCIAL: Matcher = { test: s => SHARES.test(s) || FINANCIAL_TERMS.test(s) }

function recency(publishedAt: number, end: number) {
  const age = end - publishedAt
  return age <= 12 * H ? 1 : age <= 24 * H ? 0.8 : 0.5
}

// ── Session window ───────────────────────────────────────────────────────────
const SESSION: Record<Market, { tz: string; close: [number, number] }> = {
  US: { tz: 'America/New_York', close: [16, 0] },
  IN: { tz: 'Asia/Kolkata', close: [15, 30] },
}
/** Epoch ms of hh:mm on a YYYY-MM-DD date in a time zone. */
function zoned(date: string, [hh, mm]: [number, number], tz: string): number {
  const guess = Date.parse(`${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`)
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(guess).map(x => [x.type, x.value]))
  const shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute)
  return guess - (shown - guess)
}
/**
 * Headlines that may attach to a quote's move: published after the previous
 * session's close and no later than the quote's last trade (its market time;
 * build time if the feed gave none). Exported for tests.
 * ponytail: "previous session" = previous weekday, so after an exchange holiday
 * the window starts a day late (stricter, never looser); a holiday calendar fixes it.
 */
export function sessionWindow(t: Pick<Quote, 'marketTime'>, market: Market, builtAt: number): { start: number; end: number } {
  const end = Math.min(t.marketTime ?? builtAt, builtAt)
  const { tz, close } = SESSION[market]
  const d = new Date(new Date(end).toLocaleDateString('en-CA', { timeZone: tz }) + 'T00:00:00Z')
  // d = the last trade's session date; step back to the previous weekday.
  do d.setUTCDate(d.getUTCDate() - 1); while (d.getUTCDay() === 0 || d.getUTCDay() === 6)
  return { start: zoned(d.toISOString().slice(0, 10), close, tz), end }
}
const inWindow = (h: Headline, w: { start: number; end: number }) => h.publishedAt > w.start && h.publishedAt <= w.end

// ── Graph relationship of a linked company, as the reader should see it ────────
function role(v: { link: { type: string }; direction: 'in' | 'out' }): string {
  switch (v.link.type) {
    case 'competitor_of': return 'peer'
    case 'supplier_of':   return v.direction === 'out' ? 'customer' : 'supplier' // out: this company supplies the other
    case 'subsidiary_of': return v.direction === 'out' ? 'parent' : 'subsidiary'
    default:              return 'linked'
  }
}

// For stocks outside the graph (most US movers): match the company's own name.
const SUFFIX = /[,.]?\s+(Inc|Incorporated|Corp|Corporation|Co|Company|Ltd|Limited|plc|PLC|Holdings?|Group|N\.?V|S\.?A|AG|SE|Class [A-Z]|Common Stock)\.?$/
export function coreName(name: string): string {
  let n = name.trim()
  for (let i = 0; i < 3; i++) n = n.replace(SUFFIX, '').trim()
  return n
}
const COMMON = new Set(['Target', 'Visa', 'Apple', 'Ball', 'Snap', 'Block', 'Gap', 'Live', 'Match', 'Best', 'Global', 'United', 'General', 'American', 'First'])
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function mentionsTarget(h: Headline, targetId: string, name: string): boolean {
  if (h.entities.includes(targetId)) return true
  if (getEntity(targetId)) return false // graph entities rely on the graph's careful matcher
  const core = coreName(name)
  const base = targetId.replace(/\.NS$/, '')
  if (core.length >= 4 && !COMMON.has(core) && new RegExp(`(?<![\\w&])${esc(core)}(?![\\w&])`).test(h.title)) return true
  if (base.length >= 3 && new RegExp(`(?<![\\w&$])${esc(base)}(?![\\w&])|\\$${esc(base)}(?![\\w])`).test(h.title)) return true
  return false
}

// Price direction stated in a headline ("shares rise", "Sensex falls").
const STATED_UP = /\b(rise[sn]?|rising|rose|gain(s|ed)?|jump(s|ed)?|surge[sd]?|soar\w*|rall(y|ies|ied)|climb(s|ed)?|advance[sd]?)\b/i
const STATED_DOWN = /\b(fall(s|en|ing)?|fell|drop(s|ped)?|decline[sd]?|slump\w*|plunge[sd]?|tumble[sd]?|sink(s)?|sank|slide[s]?|slid|crash\w*|sell-?off)\b/i
// Market terms an index headline must contain — the index's own market only
// ("Wall Street's India hospital bet" is not about the Nifty).
// Market-level only: "stocks"/"markets", not one company's "stock"/"share price".
const MARKET_ANY = /\b(stocks|equities|markets?|index|indices|benchmarks?|yields?|bonds?|rate (cut|hike)s?|inflation|GDP|rall(y|ies)|sell-?off)\b/i
// A move over months ("slump 27% YTD") is not evidence for today's move, unless
// the headline also points at this session ("…in one year! ITC shares rise on…").
const LONG_HORIZON = /\b(YTD|year[- ]to[- ]date|this year|in (one|a|1|two|2|three|3) years?|past (week|month|year)|in \d+ (days|sessions|weeks|months|years)|52-week|since (January|listing|IPO))\b/i
const THIS_SESSION = /\b(today|intraday|session|on (Mon|Tues|Wednes|Thurs|Fri)day)\b|\bshares? (ris\w*|rose|jump\w*|surg\w*|soar\w*|fall\w*|fell|drop\w*|slump\w*|plung\w*|tumbl\w*|climb\w*|gain\w*|slid\w*|sink\w*|sank)\b/i
const MARKET_TERMS: Record<Market, Matcher> = {
  US: { test: s => MARKET_ANY.test(s) || /\b(Wall Street|Nasdaq|Dow|S&P|Fed|Treasur(y|ies))\b/i.test(s) },
  IN: { test: s => MARKET_ANY.test(s) || /\b(Dalal Street|Nifty|Sensex|NSE|BSE|RBI)\b/i.test(s) },
}

/** Relevance of one headline to a move (see SCORING). Exported for tests. */
export function headlineScore(h: Headline, move: number, end: number, context: Matcher = FINANCIAL): number {
  const up = STATED_UP.test(h.title), down = STATED_DOWN.test(h.title)
  if ((up && !down && move < 0) || (down && !up && move > 0)) return 0
  if (!context.test(h.title)) return 0
  if (LONG_HORIZON.test(h.title) && !THIS_SESSION.test(h.title)) return 0
  const companies = h.entities.filter(id => getEntity(id)?.type === 'company').length
  const focus = companies <= 2 ? 1 : 0.6
  const tone = (h.sentiment === 'BULLISH' && move > 0) || (h.sentiment === 'BEARISH' && move < 0) ? 0.15 : 0
  return r2(clamp01(0.55 * focus * recency(h.publishedAt, end) + tone))
}

const BENCH_NAME: Record<string, string> = { '^GSPC': 'S&P 500', '^IXIC': 'Nasdaq', '^NSEI': 'Nifty 50', '^BSESN': 'Sensex', '^NSEBANK': 'Bank Nifty' }

function benchmarkFor(id: string, market: Market): string {
  if (market === 'IN') return '^NSEI'
  const inNasdaq = getLinks(id).some(v => v.direction === 'out' && v.link.type === 'constituent_of' && v.other.id === 'index:nasdaq')
  return inNasdaq ? '^IXIC' : '^GSPC'
}

/** India has no sector ETFs in the app: average the other Nifty 50 names in the same graph sector. */
function indiaSectorMove(id: string, sectorId: string, ctx: MarketContext): { changePct: number; n: number; names: string } | null {
  const others = Object.values(ctx.quotes).filter(q => q.symbol !== id && getEntity(q.symbol)?.sector === sectorId)
  if (others.length < 2) return null
  const names = [...others].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 4)
    .map(q => `${getEntity(q.symbol)?.name ?? q.name} ${fmtPct(q.changePct)}`).join(', ')
  return { changePct: others.reduce((a, q) => a + q.changePct, 0) / others.length, n: others.length, names }
}

function sectorShort(name: string) {
  return name.replace('Information Technology', 'tech').replace('Communication Services', 'communication services').replace('Consumer Discretionary', 'consumer discretionary').replace('Consumer Staples', 'consumer staples').toLowerCase()
}

// ── Stock drivers ────────────────────────────────────────────────────────────
function stockDrivers(t: Quote, ctx: MarketContext): Driver[] {
  const m = t.changePct, am = Math.abs(m), now = ctx.builtAt
  const ent = getEntity(t.symbol)
  const out: Driver[] = []

  // market
  const benchSym = benchmarkFor(t.symbol, ctx.market), bench = ctx.indices[benchSym]
  if (bench && Math.abs(bench.changePct) >= 0.25) {
    const share = Math.min(Math.abs(bench.changePct) / am, 1)
    const name = BENCH_NAME[benchSym] ?? bench.name
    if (sameDir(bench.changePct, m)) {
      out.push({ type: 'market', score: r2(0.85 * share), label: `moved with ${name} (${fmtPct(bench.changePct)})`,
        evidence: `${name} ${fmtPct(bench.changePct)} on the session; at a beta of ~1 that matches about ${Math.round(share * 100)}% of this move.`,
        source: { name: `${name} (Yahoo Finance)` }, timestamp: bench.at })
    } else {
      out.push({ type: 'market', score: 0.1, label: `against ${name} (${fmtPct(bench.changePct)})`,
        evidence: `Moved opposite to ${name} (${fmtPct(bench.changePct)}), so the broad market doesn't account for it.`,
        source: { name: `${name} (Yahoo Finance)` }, timestamp: bench.at })
    }
  }

  // sector
  if (ent?.sector) {
    const sec = getEntity(ent.sector)!
    const etf = ctx.sectorEtfs[ent.sector]
    const s = ctx.market === 'US' ? (etf ? { changePct: etf.changePct, n: 0, names: '' } : null) : indiaSectorMove(t.symbol, ent.sector, ctx)
    if (s && Math.abs(s.changePct) >= 0.4 && sameDir(s.changePct, m)) {
      const share = Math.min(Math.abs(s.changePct) / am, 1)
      out.push({ type: 'sector', score: r2(0.75 * share), label: `${sectorShort(sec.name)} (${fmtPct(s.changePct)})`,
        evidence: ctx.market === 'US'
          ? `${sec.name} sector ETF ${etf!.etf} ${fmtPct(s.changePct)}.`
          : `Average of ${s.n} other Nifty 50 ${sec.name} stocks ${fmtPct(s.changePct)} (same sector: ${s.names}).`,
        source: { name: ctx.market === 'US' ? `${etf!.etf} (Yahoo Finance)` : 'Nifty 50 constituents (Yahoo Finance)' },
        timestamp: ctx.market === 'US' ? etf!.at : now })
    }
  }

  // peers (graph-linked companies the app has quotes for)
  if (ent) {
    const peerLinks = getLinks(t.symbol).filter(v => ['competitor_of', 'supplier_of', 'subsidiary_of'].includes(v.link.type) && ctx.quotes[v.other.id])
    if (peerLinks.length) {
      const moving = peerLinks.filter(v => Math.abs(ctx.quotes[v.other.id].changePct) >= 1 && sameDir(ctx.quotes[v.other.id].changePct, m))
      if (moving.length) {
        const avg = moving.reduce((a, v) => a + Math.abs(ctx.quotes[v.other.id].changePct), 0) / moving.length
        const score = 0.6 * (moving.length / peerLinks.length) * Math.min(avg / am, 1)
        // Grouped by real graph role: "peers TCS −2.6%, Infosys −2.8%; customer Alphabet +1.6%"
        const groups = new Map<string, string[]>()
        for (const v of moving.slice(0, 3)) {
          const r = role(v)
          groups.set(r, [...(groups.get(r) ?? []), `${v.other.name} ${fmtPct(ctx.quotes[v.other.id].changePct)}`])
        }
        const label = [...groups].map(([r, names]) => `${names.length > 1 ? `${r}s` : r} ${names.join(', ')}`).join('; ')
        out.push({ type: 'peers', score: r2(score), label,
          evidence: `${moving.length} of ${peerLinks.length} linked companies moved ≥1% the same way: ${moving.map(v => `${v.other.name} ${fmtPct(ctx.quotes[v.other.id].changePct)} (${role(v)} — ${v.link.reason})`).join('; ')}.`,
          source: { name: 'Entity Graph links + Yahoo Finance quotes' }, timestamp: now })
      }
    }
  }

  // news naming the stock, published within this move's session window
  const win = sessionWindow(t, ctx.market, now)
  const direct = ctx.headlines.filter(h => inWindow(h, win) && mentionsTarget(h, t.symbol, t.name))
    .map(h => ({ h, s: headlineScore(h, m, win.end) })).sort((a, b) => b.s - a.s).slice(0, 3)
  for (const { h, s } of direct) {
    out.push({ type: 'news', score: s, label: 'related headline', evidence: h.title,
      source: { name: h.source, url: h.url }, timestamp: h.publishedAt })
  }

  // news naming a directly linked company
  if (ent) {
    const linked = new Map(getLinks(t.symbol).filter(v => ['supplier_of', 'competitor_of', 'subsidiary_of'].includes(v.link.type)).map(v => [v.other.id, v]))
    const rel = ctx.headlines.filter(h => inWindow(h, win) && FINANCIAL.test(h.title) && !direct.some(d => d.h.id === h.id) && h.entities.some(e => linked.has(e)))
      .map(h => {
        const v = linked.get(h.entities.find(e => linked.has(e))!)!
        return { h, v, s: r2(0.3 * recency(h.publishedAt, win.end)) }
      }).sort((a, b) => b.s - a.s).slice(0, 2)
    for (const { h, v, s } of rel) {
      out.push({ type: 'related_news', score: s, label: `related: ${role(v)} ${v.other.name} in headlines`,
        evidence: `${h.title} — ${v.other.name} is a ${role(v)} (${v.link.reason}).`, source: { name: h.source, url: h.url }, timestamp: h.publishedAt })
    }
  }

  // linked events (earthquakes / outbreaks in linked countries)
  if (ent) {
    const weights = new Map<string, { w: number; why: string }>()
    const add = (c: string, w: number, why: string) => { if ((weights.get(c)?.w ?? 0) < w) weights.set(c, { w, why }) }
    if (ent.country) add(ent.country, 1, 'home country')
    for (const v of getLinks(t.symbol)) {
      if (v.link.type === 'supplier_of' && v.direction === 'in' && v.other.country) add(v.other.country, 0.8, `${v.other.name}, supplier`)
      if (v.link.type === 'exposed_to' && v.direction === 'out' && v.other.type === 'country') add(v.other.id, 0.6, 'exposure')
    }
    for (const e of ctx.events) {
      const hit = e.countries.map(c => ({ c, ...weights.get(c)! })).filter(x => x.w).sort((a, b) => b.w - a.w)[0]
      if (!hit) continue
      const country = getEntity(hit.c)?.name ?? hit.c
      if (e.kind === 'earthquake' && e.magnitude != null && e.magnitude >= 6 && now - e.at <= 48 * H) {
        const mag = e.magnitude >= 7 ? 0.55 : e.magnitude >= 6.5 ? 0.4 : 0.3
        out.push({ type: 'linked_event', score: r2(mag * hit.w), label: `linked: M${e.magnitude.toFixed(1)} earthquake, ${country} (${hit.why})`,
          evidence: `${e.title}. ${country} is linked to ${t.name} (${hit.why}).`, source: { name: 'USGS', url: e.url }, timestamp: e.at })
      }
      if (e.kind === 'outbreak' && now - e.at <= 14 * 24 * H) {
        const base = ent.sector === 'sector:health-care' ? 0.25 : 0.15
        out.push({ type: 'linked_event', score: r2(base * hit.w), label: `linked: WHO outbreak report, ${country}`,
          evidence: `${e.title}. ${country} is linked to ${t.name} (${hit.why}).`, source: { name: 'WHO Disease Outbreak News', url: e.url }, timestamp: e.at })
      }
    }
  }

  // commodity / currency exposure
  if (ent) {
    for (const v of getLinks(t.symbol)) {
      if (v.direction !== 'out' || v.link.type !== 'exposed_to') continue
      const c = ctx.commodities[v.other.id]
      if (c && Math.abs(c.changePct) >= 1) {
        out.push({ type: 'commodity', score: r2(0.45 * Math.min(Math.abs(c.changePct) / 3, 1)), label: `coincides with ${v.other.name.toLowerCase()} ${fmtPct(c.changePct)}`,
          evidence: `${v.other.name} ${fmtPct(c.changePct)}; ${t.name} is exposed (${v.link.reason}).`, source: { name: `${c.name} (Yahoo Finance)` }, timestamp: c.at })
      }
      const fx = ctx.currencies[v.other.id]
      if (fx && Math.abs(fx.changePct) >= 0.25) {
        out.push({ type: 'currency', score: r2(0.35 * Math.min(Math.abs(fx.changePct) / 0.8, 1)), label: `coincides with ${fx.name} ${fmtPct(fx.changePct)}`,
          evidence: `${fx.name} ${fmtPct(fx.changePct)}; ${t.name} is exposed (${v.link.reason}).`, source: { name: `${fx.name} (Yahoo Finance)` }, timestamp: fx.at })
      }
    }
  }

  // scheduled: earnings for this stock, high-impact macro today
  const er = ctx.earnings.find(e => e.symbol === t.symbol)
  if (er) {
    const days = (Date.parse(er.date) - Date.parse(new Date(now).toISOString().slice(0, 10))) / (24 * H)
    if (days >= -1 && days <= 1) {
      const justReported = (days === 0 && er.timing === 'BMO') || (days === -1 && er.timing === 'AMC')
      out.push({ type: 'scheduled', score: justReported ? 0.7 : 0.6, label: `earnings ${er.timing !== '—' ? `${er.timing} ` : ''}${er.date}`,
        evidence: `Earnings scheduled ${er.date}${er.timing !== '—' ? ` (${er.timing === 'BMO' ? 'before open' : 'after close'})` : ''}.`, source: { name: 'Nasdaq earnings calendar' }, timestamp: now })
    }
  }
  out.push(...macroDrivers(ctx, 0.15))

  // unusual volume
  if (t.volume && t.avgVolume && t.avgVolume > 0) {
    const ratio = t.volume / t.avgVolume
    if (ratio >= 1.8) {
      out.push({ type: 'volume', score: r2(0.25 * Math.min((ratio - 1) / 2, 1)), label: `volume ${ratio.toFixed(1)}× average`,
        evidence: `Volume ${ratio.toFixed(1)}× its average — activity specific to this stock.`, source: { name: 'Yahoo Finance' }, timestamp: t.at })
    }
  }
  return out
}

function macroDrivers(ctx: MarketContext, score: number): Driver[] {
  const today = new Date(ctx.builtAt).toISOString().slice(0, 10)
  const cur = ctx.market === 'US' ? 'USD' : 'INR'
  return ctx.macro.filter(e => e.impact === 'high' && e.currency === cur && e.date === today).slice(0, 2).map(e => ({
    type: 'scheduled' as const, score, label: `coincides with ${e.title} (high impact)`,
    evidence: `${e.title} (${e.currency}, high impact) scheduled today ${e.time}.`, source: { name: 'Economic calendar' }, timestamp: ctx.builtAt,
  }))
}

// ── Index drivers ────────────────────────────────────────────────────────────
function indexDrivers(t: Quote, ctx: MarketContext): Driver[] {
  const m = t.changePct, now = ctx.builtAt, out: Driver[] = []
  const ent = resolveEntity(t.symbol)

  // breadth: sector ETFs (US) or the index's own constituents the app has quotes for (India)
  if (ctx.market === 'US') {
    const secs = Object.values(ctx.sectorEtfs)
    if (secs.length) {
      const same = secs.filter(s => sameDir(s.changePct, m))
      const top = [...same].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0]
      out.push({ type: 'breadth', score: r2(0.6 * same.length / secs.length),
        label: `${same.length} of ${secs.length} sectors ${m >= 0 ? 'up' : 'down'}${top ? `; largest ${sectorShort(top.name)} ${fmtPct(top.changePct)}` : ''}`,
        evidence: secs.map(s => `${s.etf} ${fmtPct(s.changePct)}`).join(', '), source: { name: 'SPDR sector ETFs (Yahoo Finance)' }, timestamp: secs[0].at })
    }
  } else if (ent) {
    const members = getLinks(ent.id).filter(v => v.link.type === 'constituent_of' && v.direction === 'in' && ctx.quotes[v.other.id]).map(v => ctx.quotes[v.other.id])
    if (members.length >= 3) {
      const same = members.filter(q => sameDir(q.changePct, m))
      const top = [...same].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 2)
      out.push({ type: 'breadth', score: r2(0.6 * same.length / members.length),
        label: `${same.length} of ${members.length} constituents ${m >= 0 ? 'up' : 'down'}${top.length ? `; largest ${top.map(q => `${getEntity(q.symbol)?.name ?? q.name} ${fmtPct(q.changePct)}`).join(', ')}` : ''}`,
        evidence: `${same.length} of ${members.length} constituents the app tracks moved the same way.`, source: { name: 'Index constituents (Yahoo Finance)' }, timestamp: now })
    }
  }

  // other markets moving the same way
  const peers = Object.values(ctx.globalIndices).filter(q => q.symbol !== t.symbol && Math.abs(q.changePct) >= 0.3)
  if (peers.length) {
    const same = peers.filter(q => sameDir(q.changePct, m))
    if (same.length) {
      out.push({ type: 'global', score: r2(0.4 * same.length / peers.length),
        label: `moved with ${same.slice(0, 2).map(q => `${q.name} ${fmtPct(q.changePct)}`).join(', ')}`,
        evidence: `${same.length} of ${peers.length} other major markets moved ≥0.3% the same way.`, source: { name: 'Global indices (Yahoo Finance)' }, timestamp: same[0].at })
    }
  }

  // headlines naming the index or its country, in a market context
  const country = ctx.market === 'US' ? 'country:us' : 'country:india'
  const win = sessionWindow(t, ctx.market, now)
  const hs = ctx.headlines.filter(h => inWindow(h, win) && ((ent && h.entities.includes(ent.id)) || h.entities.includes(country)))
    .map(h => ({ h, s: headlineScore(h, m, win.end, MARKET_TERMS[ctx.market]) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 2)
  for (const { h, s } of hs) out.push({ type: 'news', score: r2(s * 0.8), label: 'related headline', evidence: h.title, source: { name: h.source, url: h.url }, timestamp: h.publishedAt })

  // India: crude oil (big importer) and the rupee
  if (ctx.market === 'IN') {
    const oil = ctx.commodities['commodity:crude-oil']
    if (oil && Math.abs(oil.changePct) >= 1.5) out.push({ type: 'commodity', score: r2(0.3 * Math.min(Math.abs(oil.changePct) / 3, 1)), label: `coincides with crude oil ${fmtPct(oil.changePct)}`,
      evidence: `Crude oil ${fmtPct(oil.changePct)}; India imports most of its oil.`, source: { name: 'Crude oil futures (Yahoo Finance)' }, timestamp: oil.at })
    const inr = ctx.currencies['currency:usd']
    if (inr && Math.abs(inr.changePct) >= 0.25) out.push({ type: 'currency', score: r2(0.25 * Math.min(Math.abs(inr.changePct) / 0.8, 1)), label: `coincides with USD/INR ${fmtPct(inr.changePct)}`,
      evidence: `USD/INR ${fmtPct(inr.changePct)}.`, source: { name: 'USD/INR (Yahoo Finance)' }, timestamp: inr.at })
  }
  out.push(...macroDrivers(ctx, 0.35))
  return out
}

// ── Public ───────────────────────────────────────────────────────────────────
export function explain(target: Quote, kind: 'stock' | 'index', ctx: MarketContext): Explanation {
  const flat = Math.abs(target.changePct) < FLAT
  const all = flat ? [] : (kind === 'stock' ? stockDrivers(target, ctx) : indexDrivers(target, ctx))
  let drivers = all.filter(d => d.score >= SHOW_THRESHOLD).sort((a, b) => b.score - a.score)
  if (!drivers.some(d => d.score >= CLEAR_THRESHOLD)) {
    drivers = [{
      type: 'no_clear_driver', score: 0,
      label: flat ? 'little changed' : 'no clear driver found',
      evidence: flat
        ? `Moved less than ${FLAT}% — too small to attribute.`
        : 'Nothing in the market, sector, peer, news, linked-event, exposure, calendar or volume data accounts for this move.',
      source: { name: 'Evidence Engine' }, timestamp: ctx.builtAt,
    }, ...drivers]
  }
  const name = getEntity(target.symbol)?.name ?? resolveEntity(target.symbol)?.name ?? target.name
  return {
    id: target.symbol, name, kind, market: ctx.market,
    snapshot: { symbol: target.symbol, price: target.price, changePct: target.changePct, at: target.at, marketTime: target.marketTime ?? null },
    drivers, summary: summarize(drivers), generatedAt: ctx.builtAt,
  }
}
