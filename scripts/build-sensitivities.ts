/**
 * Builds data/scenario/sensitivities.json — offline, never at request time.
 *   npm run build:sensitivities            (resumes from data/scenario/.cache)
 *   npm run build:sensitivities -- --fresh (re-downloads everything)
 * Refresh monthly; /admin/health warns when the file is older than 45 days.
 *
 * Source: Yahoo v8 chart endpoint (query1, the one the app already uses), 5 years
 * of daily bars per symbol. Throttled to one request every 1.5 s with backoff on
 * 429/5xx; every download is saved to data/scenario/.cache/<symbol>.json
 * (git-ignored) the moment it arrives, so a run cut off by a rate limit continues
 * where it stopped (cache entries are reused for 24 h).
 *
 * METHOD — one joint regression per stock (and per sector fund), with the market
 * as a control and every factor of its market together, so one factor cannot
 * stand in for another (oil and yields move together, for instance):
 *   stock % = a + bMarket·market % + Σ b_k·factor_k move
 *   US: WTI, gold, dollar index, US 10Y (bp), USD/INR, VIX (pts) — market S&P 500
 *   IN: Brent, gold, dollar index, US 10Y (bp), USD/INR, VIX (pts) — market Nifty 50
 * Daily moves over the last 2 years for every factor except USD/INR, which uses
 * weekly NON-overlapping returns (ISO weeks) over 5 years in the same joint form.
 * Standard errors are heteroskedasticity-robust (HC1). The market's own response
 * (market % = a + Σ c_k·factor_k, same data) gives the total effect b + bMarket·c.
 *
 * RELIABLE only if: n ≥ 250, |t| ≥ 2.5, the coefficient has the same sign in both
 * halves of the window; and |t| ≥ 3 when the graph has no business link between
 * the stock and the factor (lib/scenario/exposure.ts). Everything else is "no
 * reliable historical link". Expected-by-chance counts come from a permutation
 * test: factor rows are shuffled against stock rows (5 seeds) and the same rule
 * applied — every pass there is a false link by construction.
 *
 * ALIGNMENT (time zones): each series is dated in its own exchange's time zone.
 *   US stocks — same date for every factor.
 *   India stocks (daily) — factors trading in US hours (oil, gold, dollar index,
 *   US 10Y, VIX) use the PREVIOUS US session's move: an NSE close (15:30 IST) comes
 *   before that day's US session, so Monday's Indian return is paired with Friday's
 *   US move. USD/INR and the Nifty control are same-period. Weekly rows use the
 *   same ISO week for everything (the one-session offset is small at a week).
 *   ponytail: after an Indian holiday a 2-day stock return is paired with one US
 *   session; rare (≈15 days a year) and it only adds noise, never a false link.
 *
 * 20-day factor moves (overlapping windows, last 2 years) give each factor's
 * historical range: shocks beyond its 5th–95th percentile are flagged.
 */
import fs from 'node:fs'
import path from 'node:path'
import { allEntities } from '../lib/graph/index.ts'
import { FACTORS, FACTOR_IDS, MARKET_CONTROL, MARKET_FACTORS, SECTOR_FUNDS, WEEKLY_FACTORS, type FactorId, type Market } from '../lib/scenario/factors.ts'
import { exposurePath, fundPath } from '../lib/scenario/exposure.ts'
import { PRESETS, presetSize, type FactorPreset } from '../lib/scenario/presets.ts'
import { alignedMove, dailyMoves, decide, isReliable, KEEP_T, olsHC1, percentile, rng, rollingMoves, RULE, weekly, type Change, type Series } from '../lib/scenario/stats.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'data/scenario/sensitivities.json')
const SIZES_OUT = path.join(ROOT, 'data/scenario/preset-sizes.json') // for the /scenarios page (client-safe, tiny)
const CACHE = path.join(ROOT, 'data/scenario/.cache')
const FRESH = process.argv.includes('--fresh')
const RANGE = '5y', DAILY_YEARS = 2
const GAP_MS = 1500
const PERMUTATIONS = 5

fs.mkdirSync(CACHE, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let lastCall = 0, requests = 0, cached = 0

/** 5y of daily closes (adjusted for stocks/funds), dated in the exchange's own time zone. Cached on disk. */
async function series(symbol: string, adjusted: boolean): Promise<Series> {
  const file = path.join(CACHE, `${symbol.replace(/[^\w.=-]/g, '_')}.${RANGE}.json`)
  if (!FRESH && fs.existsSync(file)) {
    const c = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (Date.now() - c.fetchedAt < 24 * 3600_000) { cached++; return c.series }
  }
  for (let attempt = 0; ; attempt++) {
    const wait = lastCall + GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastCall = Date.now(); requests++
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${RANGE}&interval=1d&includePrePost=false`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    }).catch(e => ({ ok: false, status: 0, statusText: (e as Error).message }) as Response)
    if (!res.ok) {
      if (attempt < 4 && (res.status === 0 || res.status === 429 || res.status >= 500)) { const back = 15_000 * 2 ** attempt; console.log(`  ${symbol}: HTTP ${res.status} — retrying in ${back / 1000}s`); await sleep(back); continue }
      throw new Error(`${symbol}: HTTP ${res.status} ${res.statusText}`)
    }
    const r = (await res.json())?.chart?.result?.[0]
    if (!r?.timestamp) throw new Error(`${symbol}: no data`)
    const tz: string = r.meta.exchangeTimezoneName
    const closes: (number | null)[] = (adjusted && r.indicators.adjclose?.[0]?.adjclose) || r.indicators.quote[0].close
    const s: Series = { dates: [], closes: [] }
    r.timestamp.forEach((t: number, i: number) => {
      const c = closes[i]
      if (c == null || !Number.isFinite(c) || c <= 0) return // partial/empty bars
      const d = new Date(t * 1000).toLocaleDateString('en-CA', { timeZone: tz })
      if (s.dates.at(-1) === d) { s.closes[s.closes.length - 1] = c; return } // one bar per date
      s.dates.push(d); s.closes.push(c)
    })
    if (s.dates.length < 60) throw new Error(`${symbol}: only ${s.dates.length} bars`)
    fs.writeFileSync(file, JSON.stringify({ symbol, fetchedAt: Date.now(), tz, series: s }))
    return s
  }
}

const r4 = (n: number) => Number(n.toPrecision(4))
const since = (s: Series, from: string): Series => { const i = s.dates.findIndex(d => d >= from); return i < 0 ? { dates: [], closes: [] } : { dates: s.dates.slice(i), closes: s.closes.slice(i) } }

type Design = { y: number[]; X: number[][] } // X rows: [1, market, ...factors]
interface FactorFit { b: number; se: number; t: number; r2: number; n: number; bMarket: number; halves: [number, number] | null; freq: 'daily' | 'weekly'; path: string | null; reliable: boolean; change?: Change }

/** Fit, plus the same model on each half of the rows (in date order). Column `col` of X is the coefficient wanted. */
function fitWithHalves(d: Design, col: number) {
  const full = olsHC1(d.y, d.X)
  if (!full) return null
  const h = Math.floor(d.y.length / 2)
  const a = olsHC1(d.y.slice(0, h), d.X.slice(0, h)), b = olsHC1(d.y.slice(h), d.X.slice(h))
  return { full, halves: a && b ? [a.coefs, b.coefs] as const : null, col }
}

/** Factor rows shuffled against the y / market rows (the null hypothesis), deterministic per seed. */
function permuted(d: Design, seed: number): Design {
  const r = rng(seed), idx = d.y.map((_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]] }
  return { y: d.y, X: d.X.map((row, t) => [row[0], row[1], ...d.X[idx[t]].slice(2)]) }
}

async function main() {
  const t0 = Date.now()
  // Last refresh's results: links reliable then are kept on a lower bar (hysteresis, see decide()).
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null
  type Prev = Record<string, { reliable: boolean; b: number }> | undefined
  const factorSeries = {} as Record<FactorId, Series>
  for (const id of FACTOR_IDS) factorSeries[id] = await series(FACTORS[id].symbol, false)
  const end = factorSeries.wti.dates.at(-1)!
  const dailyFrom = `${Number(end.slice(0, 4)) - DAILY_YEARS}${end.slice(4)}`
  const tnx = since(factorSeries.us10y, dailyFrom).closes
  if (Math.min(...tnx) < 0.2 || Math.max(...tnx) > 15) throw new Error('^TNX outside 0.2–15: not quoted in percent?')
  const marketSeries = { US: await series(MARKET_CONTROL.US.symbol, false), IN: await series(MARKET_CONTROL.IN.symbol, false) }

  // Daily moves (last 2 years) and weekly moves (5 years) for factors and markets.
  const dF = Object.fromEntries(FACTOR_IDS.map(id => { const s = since(factorSeries[id], dailyFrom); return [id, { dates: s.dates, moves: dailyMoves(s, FACTORS[id].unit) }] })) as Record<FactorId, { dates: string[]; moves: Map<string, number> }>
  const wF = Object.fromEntries(FACTOR_IDS.map(id => [id, dailyMoves(weekly(factorSeries[id]), FACTORS[id].unit)])) as Record<FactorId, Map<string, number>>
  const dM = { US: dailyMoves(since(marketSeries.US, dailyFrom), 'pct'), IN: dailyMoves(since(marketSeries.IN, dailyFrom), 'pct') }
  const wM = { US: dailyMoves(weekly(marketSeries.US), 'pct'), IN: dailyMoves(weekly(marketSeries.IN), 'pct') }
  const mode = (market: Market, id: FactorId) => (market === 'IN' && FACTORS[id].usHours ? 'previous' : 'same') as 'same' | 'previous'

  const dailyDesign = (s: Series, market: Market): Design => {
    const moves = dailyMoves(since(s, dailyFrom), 'pct'), ids = MARKET_FACTORS[market], y: number[] = [], X: number[][] = []
    for (const [d, r] of moves) {
      const m = dM[market].get(d), f = ids.map(id => alignedMove(d, dF[id].dates, dF[id].moves, mode(market, id)))
      if (m === undefined || f.some(v => v === undefined)) continue
      y.push(r); X.push([1, m, ...(f as number[])])
    }
    return { y, X }
  }
  const weeklyDesign = (s: Series, market: Market): Design => {
    const moves = dailyMoves(weekly(s), 'pct'), ids = MARKET_FACTORS[market], y: number[] = [], X: number[][] = []
    for (const [w, r] of moves) {
      const m = wM[market].get(w), f = ids.map(id => wF[id].get(w))
      if (m === undefined || f.some(v => v === undefined)) continue
      y.push(r); X.push([1, m, ...(f as number[])])
    }
    return { y, X }
  }
  /** Same regressors without the market column: the market's own response to the factors. */
  const marketDesign = (market: Market, freq: 'daily' | 'weekly'): Design => {
    const d = freq === 'daily' ? dailyDesign(marketSeries[market], market) : weeklyDesign(marketSeries[market], market)
    return { y: d.y, X: d.X.map(r => [1, ...r.slice(2)]) }
  }

  // ── Market responses (c), daily and weekly; USD/INR weekly — always computed.
  // Reliable by the same rule (a market-level link needs no graph path).
  const market = {} as Record<Market, Record<string, { c: number; se: number; t: number; n: number; halves: [number, number] | null; freq: string; reliable: boolean; change?: Change }>>
  for (const mk of ['US', 'IN'] as Market[]) {
    market[mk] = {}
    for (const freq of ['daily', 'weekly'] as const) {
      const fit = fitWithHalves(marketDesign(mk, freq), 0)!
      MARKET_FACTORS[mk].forEach((id, j) => {
        if ((freq === 'weekly') !== WEEKLY_FACTORS.has(id)) return
        const c = fit.full.coefs[j + 1], halves = fit.halves ? [fit.halves[0][j + 1].b, fit.halves[1][j + 1].b] as [number, number] : null
        const d = decide({ n: fit.full.n, t: c.t, b: c.b, halves }, true, prev?.market?.[mk]?.[id] && { reliable: prev.market[mk][id].reliable, b: prev.market[mk][id].c })
        market[mk][id] = { c: r4(c.b), se: r4(c.se), t: r4(c.t), n: fit.full.n, halves: halves && [r4(halves[0]), r4(halves[1])], freq, ...d }
      })
    }
  }

  /** Every factor's fit for one stock/fund; plus permutation passes for the chance estimate. */
  const chance: Record<string, number> = Object.fromEntries(FACTOR_IDS.map(id => [id, 0]))
  const fitsFor = (s: Series, mk: Market, pathOf: (id: FactorId) => string | null, before: Prev) => {
    const designs = { daily: dailyDesign(s, mk), weekly: weeklyDesign(s, mk) }
    const out: Record<string, FactorFit> = {}
    for (const freq of ['daily', 'weekly'] as const) {
      const d = designs[freq]
      if (d.y.length < 30) continue
      const fit = fitWithHalves(d, 0)
      MARKET_FACTORS[mk].forEach((id, j) => {
        if ((freq === 'weekly') !== WEEKLY_FACTORS.has(id) || !fit) return
        const c = fit.full.coefs[j + 2], halves = fit.halves ? [fit.halves[0][j + 2].b, fit.halves[1][j + 2].b] as [number, number] : null
        const path = pathOf(id)
        const f = { b: c.b, se: c.se, t: c.t, r2: fit.full.r2, n: fit.full.n, bMarket: fit.full.coefs[1].b, halves }
        out[id] = { b: r4(f.b), se: r4(f.se), t: r4(f.t), r2: r4(f.r2), n: f.n, bMarket: r4(f.bMarket), halves: halves && [r4(halves[0]), r4(halves[1])], freq, path, ...decide(f, !!path, before?.[id]) }
      })
      for (let p = 0; p < PERMUTATIONS; p++) {
        const pf = fitWithHalves(permuted(d, 1000 + p), 0)
        if (!pf) continue
        MARKET_FACTORS[mk].forEach((id, j) => {
          if ((freq === 'weekly') !== WEEKLY_FACTORS.has(id) || !pf.halves) return
          const c = pf.full.coefs[j + 2]
          if (isReliable({ n: pf.full.n, t: c.t, b: c.b, halves: [pf.halves[0][j + 2].b, pf.halves[1][j + 2].b] }, !!pathOf(id))) chance[id] += 1 / PERMUTATIONS
        })
      }
    }
    return out
  }

  const companies = allEntities().filter(e => e.type === 'company')
  const stocks: Record<string, unknown> = {}, failed: string[] = []
  for (const [i, e] of companies.entries()) {
    const mk: Market = e.id.endsWith('.NS') ? 'IN' : 'US'
    try {
      const s = await series(e.id, true)
      stocks[e.id] = { name: e.name, market: mk, sector: e.sector ?? null, industry: e.industry ?? null, window: { start: s.dates[0], end: s.dates.at(-1) }, factors: fitsFor(s, mk, id => exposurePath(e.id, id), prev?.stocks?.[e.id]?.factors) }
      process.stdout.write(`\r  stocks ${i + 1}/${companies.length} (${requests} requests, ${cached} from cache)   `)
    } catch (err) { failed.push(`${e.id}: ${(err as Error).message}`) }
  }
  const ids = companies.map(c => c.id)
  const sectors: Record<string, unknown> = {}
  for (const f of SECTOR_FUNDS) {
    try {
      const s = await series(f.symbol, true)
      sectors[f.symbol] = { name: f.name, market: f.market, sector: f.sector ?? null, members: f.members ?? null, window: { start: s.dates[0], end: s.dates.at(-1) }, factors: fitsFor(s, f.market, id => fundPath(f, id, ids), prev?.sectors?.[f.symbol]?.factors) }
    } catch (err) { failed.push(`${f.symbol}: ${(err as Error).message}`) }
  }
  console.log()

  const factorsOut = Object.fromEntries(FACTOR_IDS.map(id => {
    const s = since(factorSeries[id], dailyFrom), rm = rollingMoves(s, FACTORS[id].unit, 20)
    return [id, { name: FACTORS[id].name, symbol: FACTORS[id].symbol, unit: FACTORS[id].unit, freq: WEEKLY_FACTORS.has(id) ? 'weekly' : 'daily',
      window: WEEKLY_FACTORS.has(id) ? { start: factorSeries[id].dates[0], end: s.dates.at(-1) } : { start: s.dates[0], end: s.dates.at(-1) },
      moves20d: { n: rm.length, min: r4(Math.min(...rm)), p1: r4(percentile(rm, 1)), p5: r4(percentile(rm, 5)), p50: r4(percentile(rm, 50)), p95: r4(percentile(rm, 95)), p99: r4(percentile(rm, 99)), max: r4(Math.max(...rm)) } }]
  }))

  const pairs = [...Object.values(stocks), ...Object.values(sectors)].flatMap((s: any) => Object.entries(s.factors) as [FactorId, FactorFit][])
  const perFactor = Object.fromEntries(FACTOR_IDS.map(id => {
    const ps = pairs.filter(([k]) => k === id)
    return [id, { pairs: ps.length, reliable: ps.filter(([, f]) => f.reliable).length, expectedByChance: r4(chance[id]) }]
  }))
  const reliable = pairs.filter(([, f]) => f.reliable).length
  const out = {
    meta: {
      generatedAt: new Date().toISOString(),
      source: 'Yahoo Finance v8 chart, daily bars (adjusted closes for stocks and funds)',
      window: { daily: { start: dailyFrom, end }, weekly: { start: factorSeries.usdinr.dates[0], end } },
      method: 'Joint OLS with the market as a control and all of the market\'s factors together; HC1 robust standard errors. stock % = a + bMarket·market % + Σ b_k·factor_k. Daily (2y) for all factors except USD/INR: weekly non-overlapping ISO-week returns (5y). Market response: market % = a + Σ c_k·factor_k. Total effect = b + bMarket·c.',
      alignment: 'US: same date. India daily: previous US session for oil, gold, dollar index, US 10Y and VIX; same day for USD/INR and the Nifty. Weekly: same ISO week.',
      reliableRule: `n >= ${RULE.minN}, |t| >= ${RULE.minT} (HC1), same sign in both halves of the window; |t| >= ${RULE.minTNoPath} when the graph has no business link`,
      keepRule: `a link reliable at the previous refresh stays reliable at |t| >= ${KEEP_T} with both halves and the overall sign unchanged`,
      previousGeneratedAt: prev?.meta?.generatedAt ?? null,
      chance: `Permutation test (${PERMUTATIONS} shuffles of factor rows against stock rows, same rule): average false passes`,
      units: { pct: 'percent', bp: 'basis points', pt: 'index points' },
      counts: { stocks: Object.keys(stocks).length, sectorFunds: Object.keys(sectors).length, pairs: pairs.length, reliable, unreliable: pairs.length - reliable, expectedByChance: r4(Object.values(chance).reduce((a, b) => a + b, 0)), perFactor, requests, fromCache: cached },
      failed,
    },
    factors: factorsOut,
    market,
    stocks,
    sectors,
  }
  // Change summary vs the previous refresh (also written to the GitHub Actions job summary).
  const changes = { new: [] as string[], kept: [] as string[], dropped: [] as string[] }
  for (const group of [stocks, sectors]) for (const [sym, e] of Object.entries(group as Record<string, { factors: Record<string, FactorFit> }>))
    for (const [f, fit] of Object.entries(e.factors)) if (fit.change) changes[fit.change].push(`${sym}/${f} (b ${fit.b}, t ${fit.t})`)
  for (const mk of ['US', 'IN'] as Market[]) for (const [f, fit] of Object.entries(market[mk])) if (fit.change) changes[fit.change].push(`${mk === 'US' ? 'S&P 500' : 'Nifty 50'}/${f} (c ${fit.c}, t ${fit.t})`)
  const summary = [
    `Sensitivity refresh vs ${prev?.meta?.generatedAt ?? 'no previous file'}: ${changes.new.length} new, ${changes.kept.length} kept, ${changes.dropped.length} dropped`,
    ...(['new', 'dropped'] as const).map(k => `  ${k.toUpperCase()}: ${changes[k].join('; ') || 'none'}`),
  ].join('\n')
  console.log(summary)
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### Scenario sensitivities\n\n```\n' + summary + '\n```\n')

  // Partial data never ships: any symbol that failed (after retries) fails the run and nothing is written.
  if (failed.length) { console.error(`
FAILED — nothing written: ${failed.join('; ')}`); process.exit(1) }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out))
  // Preset sizes from this data (95th/5th percentile 20-day moves, rounded toward zero) — the engine recomputes the same.
  const sizes = Object.fromEntries((['US', 'IN'] as Market[]).map(m => [m, Object.fromEntries(PRESETS.filter((p): p is FactorPreset => p.kind === 'factor' && p.markets.includes(m)).map(p => [p.id, presetSize(p, m, factorsOut as never)]))]))
  fs.writeFileSync(SIZES_OUT, JSON.stringify({ generatedAt: out.meta.generatedAt, sizes }, null, 1))
  console.log(`wrote ${path.relative(ROOT, OUT)} — ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB; ${out.meta.counts.stocks} stocks + ${out.meta.counts.sectorFunds} sector funds, ${reliable}/${pairs.length} reliable (≈${out.meta.counts.expectedByChance} by chance); ${requests} requests, ${cached} from cache, ${((Date.now() - t0) / 1000).toFixed(0)} s${failed.length ? `; FAILED: ${failed.join('; ')}` : ''}`)
}

if (process.argv[1]?.endsWith('build-sensitivities.ts')) await main()
