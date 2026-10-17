/**
 * Scenario Engine checks.   npm run test:scenario
 *  1. Engine invariants (zero, sign flip, scaling)   2. Oil sanity (both markets)
 *  3. Reliability: unreliable links never produce numbers   4. Beyond-range flags
 *  5. Event presets: no percentages   6. Data-file integrity   7. Wording
 *  8. Method: alignment, weekly returns, HC1 regression   9. Portfolio   10. CPU
 *  11. Live: the API through a LOCAL server (shared throwaway account, see
 *      liveAccount.ts; `npm run test:scenario -- --cleanup` deletes it).
 *  `-- --offline` skips 11 (the monthly refresh workflow runs this way); the GATE
 *  checks are the oil / rates / sector sanity gate a data refresh must pass.
 */
import fs from 'node:fs'
import { assertScenarioWording, COST_NOTE, MIN_MEDIAN, portfolioImpact, runScenario, SCENARIO_BANNED, validateShock, VALUE_NOTE, type ScenarioResult, type SensitivityData } from '../lib/scenario/engine.ts'
import { FACTOR_IDS, FACTORS, MARKET_FACTORS, SECTOR_FUNDS, type FactorId, type Market } from '../lib/scenario/factors.ts'
import { PRESETS, presetFactor, presetSize, type FactorPreset } from '../lib/scenario/presets.ts'
import { alignedMove, dailyMoves, decide, isoWeek, isReliable, olsHC1, rng, weekly } from '../lib/scenario/stats.ts'
import { MAX_TICKERS, parseSpark, sparkUrls } from '../lib/scenario/spark.ts'
import { allEntities, getEntity } from '../lib/graph/index.ts'
import { signIn, cleanupAccount, CLEANUP } from './liveAccount.ts'

const rows: { check: string; pass: boolean; detail: string }[] = []
const check = (name: string, pass: boolean, detail = '') => rows.push({ check: name, pass, detail })
const data: SensitivityData = JSON.parse(fs.readFileSync(new URL('../data/scenario/sensitivities.json', import.meta.url), 'utf8'))
const presetSizes = JSON.parse(fs.readFileSync(new URL('../data/scenario/preset-sizes.json', import.meta.url), 'utf8'))
const OFFLINE = process.argv.includes('--offline')
const run = (market: Market, q: { preset: any } | { factor: any; shock: number }) => runScenario(data, { market, ...q } as any)
const all: ScenarioResult[] = []
const keep = (r: ScenarioResult) => (all.push(r), r)

// ── 1. Invariants ────────────────────────────────────────────────────────────
for (const market of ['US', 'IN'] as Market[]) {
  for (const factor of MARKET_FACTORS[market]) {
    const zero = keep(run(market, { factor, shock: 0 })), up = keep(run(market, { factor, shock: 5 })), down = keep(run(market, { factor, shock: -5 })), up2 = keep(run(market, { factor, shock: 10 }))
    const z = zero.stocks.every(i => i.total === 0 && i.low === 0 && i.high === 0) && zero.sectors.every(s => s.total === null || s.total === 0)
    const flips = up.stocks.every(i => { const d = down.stocks.find(x => x.symbol === i.symbol)!; return Math.abs(i.total + d.total) < 1e-9 && Math.abs(i.low + d.high) < 1e-9 }) && up.stocks.length === down.stocks.length
    const scales = up.stocks.every(i => Math.abs(up2.stocks.find(x => x.symbol === i.symbol)!.total - 2 * i.total) < 1e-9)
    check(`invariants ${market} ${factor}: zero shock → zero, opposite shock flips every sign, impact scales with shock`, z && flips && scales, `${up.stocks.length} estimated`)
  }
}

// ── 2. Oil sanity ────────────────────────────────────────────────────────────
{
  const us = keep(run('US', { preset: 'oil-up' })), inn = keep(run('IN', { preset: 'oil-up' }))
  const t = (r: ScenarioResult, s: string) => r.stocks.find(i => i.symbol === s)?.total
  const helped = ['XOM', 'CVX', 'VLO', 'MPC'].every(s => (t(us, s) ?? 0) > 0) && (t(inn, 'ONGC.NS') ?? 0) > 0
  const hurt = ['DAL', 'UAL', 'LUV'].every(s => (t(us, s) ?? 0) < 0) && (t(inn, 'INDIGO.NS') ?? 0) < 0 && (t(inn, 'BPCL.NS') ?? 0) < 0
  const bar = (r: ScenarioResult, id: string) => r.sectors.find(s => s.id === id || s.symbol === id)?.total ?? null
  check('oil +20% (US, WTI): energy/refiners helped, airlines hurt; Energy (XLE) up, airlines (JETS) down', helped && hurt && (bar(us, 'sector:energy') ?? 0) > 0 && (bar(us, 'JETS') ?? 0) < 0,
    `XOM ${t(us, 'XOM')?.toFixed(1)} VLO ${t(us, 'VLO')?.toFixed(1)} DAL ${t(us, 'DAL')?.toFixed(1)} XLE ${bar(us, 'sector:energy')?.toFixed(1)} JETS ${bar(us, 'JETS')?.toFixed(1)}`)
  check('oil +20% (India, Brent): ONGC helped; IndiGo and BPCL hurt; Asian Paints has no reliable link, so no number (never guessed)',
    (t(inn, 'ONGC.NS') ?? 0) > 0 && (t(inn, 'INDIGO.NS') ?? 0) < 0 && (t(inn, 'BPCL.NS') ?? 0) < 0 && t(inn, 'ASIANPAINT.NS') === undefined && inn.notEstimated.some(n => n.symbol === 'ASIANPAINT.NS'),
    `ONGC ${t(inn, 'ONGC.NS')?.toFixed(1)} IndiGo ${t(inn, 'INDIGO.NS')?.toFixed(1)} BPCL ${t(inn, 'BPCL.NS')?.toFixed(1)}`)
}

// ── GATE: the sanity gate a data refresh must pass (monthly workflow) ──────────
{
  const fit = (s: string, f: string) => (data.stocks[s] ?? data.sectors[s])?.factors[f as FactorId]
  const gate: [string, string, 1 | -1][] = [
    ['XOM', 'wti', 1], ['CVX', 'wti', 1], ['VLO', 'wti', 1], ['MPC', 'wti', 1], ['ONGC.NS', 'brent', 1],
    ['DAL', 'wti', -1], ['UAL', 'wti', -1], ['INDIGO.NS', 'brent', -1], ['BPCL.NS', 'brent', -1],
    ['JPM', 'us10y', 1], ['XLE', 'wti', 1], ['JETS', 'wti', -1],
  ]
  const failing = gate.filter(([s, f, sign]) => { const x = fit(s, f); return !x?.reliable || Math.sign(x.b) !== sign }).map(([s, f, sign]) => `${s}/${f} expected ${sign > 0 ? '+' : '−'}: ${fit(s, f) ? `b ${fit(s, f)!.b}, t ${fit(s, f)!.t}, ${fit(s, f)!.reliable ? 'reliable' : 'not reliable'}` : 'missing'}`)
  check('GATE: oil (XOM, CVX, VLO, MPC, ONGC +; DAL, UAL, IndiGo, BPCL −), US 10Y (JPM +), Energy fund + and airline fund − — all reliable', failing.length === 0, failing.join(' | '))
}

// ── 3. Unreliable links never produce numbers ───────────────────────────────
for (const market of ['US', 'IN'] as Market[]) for (const p of PRESETS.filter(p => p.markets.includes(market))) keep(run(market, { preset: p.id }))
{
  const leaks = all.flatMap(r => r.kind !== 'factor' ? [] : [
    ...r.stocks.filter(i => !data.stocks[i.symbol].factors[r.factor!.id]?.reliable).map(i => `${r.market} ${r.title}: ${i.symbol}`),
    ...r.sectors.filter(s => s.basis === 'fund' && s.total !== null && !data.sectors[s.symbol!].factors[r.factor!.id]?.reliable).map(s => `${r.title}: fund ${s.symbol}`),
    ...r.notEstimated.filter(n => r.stocks.some(i => i.symbol === n.symbol)).map(n => `${r.title}: ${n.symbol} both`),
  ])
  check(`reliability: every number comes from a reliable link (${all.length} scenarios checked)`, leaks.length === 0, leaks.slice(0, 5).join(' | '))
  // A constituent-median bar needs ≥ 3 reliable constituents; with fewer there is no bar, but the stocks still show.
  const thin = all.flatMap(r => r.sectors.filter(s => s.basis === 'median' && (s.count?.reliable ?? 0) < MIN_MEDIAN).map(s => `${r.market} ${r.title}: ${s.name} (${s.count?.reliable})`))
  const oilIn = run('IN', { preset: 'oil-up' })
  const energyIn = oilIn.stocks.filter(i => getEntity(i.symbol)?.sector === 'sector:energy')
  check('sector bars: a constituent median needs ≥ 3 reliable constituents (Indian Energy, 2 reliable: no bar, ONGC and BPCL still listed)',
    !thin.length && !oilIn.sectors.some(s => s.id === 'sector:energy') && energyIn.length > 0 && energyIn.length < MIN_MEDIAN && oilIn.sectors.some(s => s.basis === 'fund'),
    thin.slice(0, 3).join(' | ') || energyIn.map(i => i.symbol).join(', '))
  const r = run('IN', { preset: 'inr-weak' })
  check('USD/INR +3% (India): no stock numbers (no reliable weekly link) but the Nifty\'s own reaction is shown', r.stocks.length === 0 && r.marketReaction?.reliable === true && (r.marketReaction.value ?? 0) < 0, r.marketReaction?.text)
  const rates = run('IN', { preset: 'rates-up' })
  check('US 10Y in India mode: only reliable links, with an honest note on Indian rates', rates.stocks.every(i => data.stocks[i.symbol].factors.us10y?.reliable) && rates.notes.some(n => /Indian interest rates are not covered/.test(n)))
}

// ── 4. Beyond historical range ───────────────────────────────────────────────
{
  const factorPresets = PRESETS.filter((p): p is FactorPreset => p.kind === 'factor')
  const defaults = factorPresets.flatMap(p => p.markets.map(m => ({ p, m, r: run(m, { preset: p.id }) })))
  const flagged = defaults.filter(x => x.r.range!.beyond).map(x => `${x.m} ${x.r.title}`)
  check(`range: no default preset is beyond historical range (${defaults.length} preset × market runs)`, flagged.length === 0, flagged.join(', '))
  check('presets: sized at the 95th/5th percentile 20-day move, rounded toward zero; the page\'s preset-sizes.json matches the engine',
    defaults.every(({ p, m, r }) => { const pct = data.factors[presetFactor(p, m)].moves20d[p.side === 'up' ? 'p95' : 'p5'], s = r.factor!.shock
      return Math.sign(s) === Math.sign(pct) && Math.abs(s) <= Math.abs(pct) && Math.abs(s) >= Math.abs(pct) / 2 && presetSizes.sizes[m][p.id].shock === s && presetSize(p, m, data.factors).shock === s && /a large 20-day move historically/.test(r.description) }),
    defaults.map(x => `${x.m} ${x.r.title}`).join(', '))
  const b = run('US', { factor: 'us10y', shock: 100 }), c = run('US', { factor: 'wti', shock: 30 }), d = run('US', { factor: 'wti', shock: 5 })
  check('range: custom shocks can go beyond — US 10Y +100bp and WTI +30% flagged, WTI +5% within',
    b.range!.beyond && c.range!.beyond && !d.range!.beyond && /Beyond historical range — estimate less reliable/.test(b.range!.text), b.range!.text)
  check('validation: WTI rejected for India, shocks above the factor limit rejected, in-range accepted',
    !!validateShock('IN', 'wti', 10) && !!validateShock('US', 'us10y', 400) && !!validateShock('US', 'vix', -41) && validateShock('US', 'us10y', -300) === null && validateShock('IN', 'brent', 60) === null)
}

// ── 5. Event presets: directional only ───────────────────────────────────────
{
  const events = all.filter(r => r.kind === 'event')
  const json = JSON.stringify(events)
  check(`events: ${events.length} event scenarios output no percentages and no estimates`, events.length === 3 && !/%|\d+(\.\d+)?\s?(pct|percent)/i.test(json) && events.every(r => !r.stocks.length && (r.event?.length ?? 0) > 0),
    events.map(r => `${r.title}: ${r.event?.map(e => e.name).join(', ')}`).join(' | '))
  const tw = events.find(r => r.preset === 'taiwan-chips')!
  check('events: Taiwan disruption reaches TSMC, its customers (Nvidia, Apple) and its supplier (ASML) via graph links',
    ['TSM', 'NVDA', 'AAPL', 'ASML'].every(s => tw.event!.some(e => e.symbol === s)), tw.event!.map(e => e.path).join(' | '))
}

// ── 6. Data-file integrity ───────────────────────────────────────────────────
{
  const bad: string[] = []
  const walk = (v: unknown, p: string): void => {
    if (typeof v === 'number' && !Number.isFinite(v)) bad.push(`${p} = ${v}`)
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${p}.${k}`)
  }
  walk(data, 'data')
  const dateOk = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d))
  const windows = [data.meta.window.daily, data.meta.window.weekly, ...Object.values(data.stocks).map(s => s.window), ...Object.values(data.sectors).map(s => s.window), ...Object.values(data.factors).map(f => f.window)]
  const notInGraph = Object.keys(data.stocks).filter(s => getEntity(s)?.type !== 'company')
  // Flags follow the rule for new links and the keep rule for links reliable last refresh (hysteresis).
  const ruleOk = (f: any) => f.change === 'kept' ? f.reliable && decide(f, !!f.path, { reliable: true, b: f.b }).reliable
    : f.change === 'new' ? f.reliable && isReliable(f, !!f.path) : f.change === 'dropped' ? !f.reliable : !f.reliable && !isReliable(f, !!f.path)
  const wrongRule = [...Object.entries(data.stocks), ...Object.entries(data.sectors)].flatMap(([s, e]) => Object.entries(e.factors).filter(([, f]) => !ruleOk(f)).map(([k]) => `${s}/${k}`))
  const missingFactors = Object.entries(data.stocks).filter(([, e]) => MARKET_FACTORS[e.market].some(f => !e.factors[f])).map(([s]) => s)
  check('data: no NaN/Infinity, valid dates, every stock in the graph, every fund configured, reliable flags match the rule',
    !bad.length && windows.every(w => dateOk(w.start) && dateOk(w.end) && w.start < w.end) && !notInGraph.length && Object.keys(data.sectors).every(s => SECTOR_FUNDS.some(f => f.symbol === s)) && !wrongRule.length && FACTOR_IDS.every(f => data.factors[f]),
    [bad.slice(0, 3).join(', '), notInGraph.join(', '), wrongRule.slice(0, 3).join(', ')].filter(Boolean).join(' | '))
  const graphCompanies = allEntities().filter(e => e.type === 'company').map(e => e.id), absent = graphCompanies.filter(id => !data.stocks[id])
  check(`data: all ${graphCompanies.length} graph companies and every market factor have a fit; no download failed`, !missingFactors.length && !absent.length && !((data.meta as any).failed ?? []).length,
    [missingFactors.join(', '), absent.join(', '), ((data.meta as any).failed ?? []).join('; ')].filter(Boolean).join(' | '))
  const ageDays = (Date.now() - Date.parse(data.meta.generatedAt)) / 86400_000
  check(`data: built ${data.meta.generatedAt.slice(0, 10)} (${ageDays.toFixed(0)} days old; /admin/health warns after 45)`, ageDays >= 0 && ageDays < 45)
}

// ── 7. Wording ───────────────────────────────────────────────────────────────
{
  const texts = all.flatMap(r => [r.title, r.description, r.range?.text ?? '', r.marketReaction?.text ?? '', ...r.notes, ...r.stocks.map(i => i.text), ...r.sectors.map(s => s.note), ...r.indirect.map(i => i.text), ...(r.event ?? []).flatMap(e => [e.path, e.reason])]).filter(Boolean)
  const bad = texts.filter(t => SCENARIO_BANNED.test(t))
  let throws = 0
  for (const t of ['Oil will rise', 'We predict a fall', 'The forecast is up', 'Down because of oil', 'Rates caused the drop']) { try { assertScenarioWording(t) } catch { throws++ } }
  const historically = all.flatMap(r => r.stocks).every(i => i.text.startsWith('Historically, when ') && /tended to move/.test(i.text))
  check(`wording: ${texts.length} output texts — no will/predict/forecast/because/caused; every stock line reads "historically … tended to"; guard throws`, !bad.length && throws === 5 && historically, bad.slice(0, 3).join(' | '))
}

// ── 8. Method ────────────────────────────────────────────────────────────────
{
  // India Monday 2026-10-12 sees Friday's US move; a US stock sees the same day's.
  const fDates = ['2026-10-08', '2026-10-09', '2026-10-12'], fMoves = new Map([['2026-10-08', 1], ['2026-10-09', 2], ['2026-10-12', 3]])
  check('alignment: India pairs with the previous US session (Mon → Fri), US with the same day, India Friday → Thursday',
    alignedMove('2026-10-12', fDates, fMoves, 'previous') === 2 && alignedMove('2026-10-12', fDates, fMoves, 'same') === 3 && alignedMove('2026-10-09', fDates, fMoves, 'previous') === 1 && alignedMove('2026-10-08', fDates, fMoves, 'previous') === undefined)
  const w = weekly({ dates: ['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12', '2026-10-16'], closes: [10, 11, 12, 13, 15] })
  check('weekly: one non-overlapping return per ISO week, from the last close of each week', isoWeek('2026-10-12') === '2026-W42' && isoWeek('2026-01-01') === '2026-W01' && isoWeek('2027-01-01') === '2026-W53'
    && w.dates.join() === '2026-W41,2026-W42' && w.closes.join() === '12,15' && Math.abs(dailyMoves(w, 'pct').get('2026-W42')! - 25) < 1e-9, `${w.dates} ${w.closes}`)
  const r = rng(7), m: number[] = [], f: number[] = [], y: number[] = []
  for (let i = 0; i < 2000; i++) { const mi = r() * 4 - 2, fi = r() * 6 - 3; m.push(mi); f.push(fi); y.push(0.2 + 1.1 * mi - 0.4 * fi + (r() - 0.5) * (1 + Math.abs(fi))) }
  const fit = olsHC1(y, m.map((mi, i) => [1, mi, f[i]]))!
  check('regression: joint OLS recovers known coefficients with HC1 errors (heteroskedastic noise)', Math.abs(fit.coefs[1].b - 1.1) < 0.05 && Math.abs(fit.coefs[2].b + 0.4) < 0.03 && fit.coefs[2].se > 0 && fit.coefs[2].t < -20,
    `bMarket ${fit.coefs[1].b.toFixed(3)} b ${fit.coefs[2].b.toFixed(3)} se ${fit.coefs[2].se.toFixed(4)}`)
  check('reliability rule: |t| ≥ 2.5 with stable halves; |t| ≥ 3 without a business link; n ≥ 250',
    isReliable({ n: 300, t: 2.6, b: 1, halves: [0.5, 1.2] }, true) && !isReliable({ n: 300, t: 2.6, b: 1, halves: [0.5, 1.2] }, false) && isReliable({ n: 300, t: 3.1, b: 1, halves: [1, 1] }, false)
      && !isReliable({ n: 300, t: 4, b: 1, halves: [-0.1, 2] }, true) && !isReliable({ n: 249, t: 9, b: 1, halves: [1, 1] }, true))
}

// ── 8b. Hysteresis between monthly refreshes ────────────────────────────────
{
  const f = (t: number, b = 1, halves: [number, number] = [b, b], n = 300) => ({ n, t, b, halves })
  const was = { reliable: true, b: 0.5 }
  const cases: [string, ReturnType<typeof decide>, boolean, string | undefined][] = [
    ['kept at |t| 2.2 (was reliable, same sign)', decide(f(2.2, 0.4), true, was), true, 'kept'],
    ['kept at |t| 2.2 even without a business link', decide(f(2.2, 0.4), false, was), true, 'kept'],
    ['dropped below |t| 2', decide(f(1.9, 0.4), true, was), false, 'dropped'],
    ['dropped when the overall sign flips', decide(f(-3.5, -0.4), true, was), false, 'dropped'],
    ['dropped when the halves disagree', decide(f(3, 0.4, [0.6, -0.1]), true, was), false, 'dropped'],
    ['new needs the full rule: |t| 2.6 with a link', decide(f(2.6), true, null), true, 'new'],
    ['new needs |t| ≥ 3 without a link', decide(f(2.6), false, null), false, undefined],
    ['previously unreliable at |t| 2.3 stays unreliable (no keep bar)', decide(f(2.3), true, { reliable: false, b: 1 }), false, undefined],
  ]
  const bad = cases.filter(([, d, rel, ch]) => d.reliable !== rel || d.change !== ch).map(([n, d]) => `${n}: got ${JSON.stringify(d)}`)
  check('hysteresis: kept at |t| ≥ 2 with stable sign and halves; dropped otherwise; new links need the full rule', !bad.length, bad.join(' | '))
  const changes = [...Object.values(data.stocks), ...Object.values(data.sectors)].flatMap(e => Object.values(e.factors).map(x => (x as any).change)).filter(Boolean)
  check(`hysteresis: the data file records new/kept/dropped (${['new', 'kept', 'dropped'].map(k => `${changes.filter(c => c === k).length} ${k}`).join(', ')})`, changes.every(c => ['new', 'kept', 'dropped'].includes(c)) && changes.length > 0)
}

// ── 8c. Shared price lookup: the request carries only the sorted ticker list ──
{
  const urls = sparkUrls(['xom', 'AAPL', 'XOM', ' ongc.ns ', 'AAPL'])
  const many = sparkUrls(Array.from({ length: 70 }, (_, i) => `T${String(i).padStart(2, '0')}`))
  const syms = (u: string) => decodeURIComponent(new URL(u).searchParams.get('symbols')!).split(',')
  check('prices: one request per ≤ 20 sorted, de-duplicated tickers; at most 50 tickers; nothing but symbols, range and interval in the URL',
    urls.length === 1 && syms(urls[0]).join() === 'AAPL,ONGC.NS,XOM' && [...new URL(urls[0]).searchParams.keys()].join() === 'symbols,range,interval'
      && many.length === 3 && many.flatMap(syms).length === MAX_TICKERS && many.every(u => syms(u).length <= 20) && many.flatMap(syms).join() === [...many.flatMap(syms)].sort().join(),
    urls[0])
  const parsed = parseSpark({ spark: { result: [
    { symbol: 'XOM', response: [{ meta: { regularMarketPrice: 177.1, currency: 'USD' } }] },
    { symbol: 'ONGC.NS', response: [{ meta: { regularMarketPrice: 250.5, currency: 'INR' } }] },
    { symbol: 'BP.L', response: [{ meta: { regularMarketPrice: 480, currency: 'GBp' } }] },
    { symbol: 'NEM', response: [{ meta: { regularMarketPrice: 0, currency: 'USD' } }] },
  ] } })
  check('prices: parsed in the listing currency only (USD for US, INR for .NS); zero or foreign-currency quotes ignored', JSON.stringify(parsed) === JSON.stringify({ XOM: 177.1, 'ONGC.NS': 250.5 }), JSON.stringify(parsed))
}

// ── 9. Portfolio ─────────────────────────────────────────────────────────────
{
  const holdings = [
    { ticker: 'XOM', quantity: 10, buyPrice: 100 }, { ticker: 'dal', quantity: 20, buyPrice: 50 }, { ticker: 'ZZZZ', quantity: 1, buyPrice: 1 },
    { ticker: 'ONGC', quantity: 100, buyPrice: 250 }, { ticker: 'ASIANPAINT.NS', quantity: 10, buyPrice: 2500 }, { ticker: 'XOM', quantity: 5, buyPrice: 100 },
  ]
  const p = portfolioImpact(data, { preset: 'oil-up' }, holdings, { XOM: 120, 'ONGC.NS': 300 })
  const us = p.groups.find(g => g.market === 'US')!, inn = p.groups.find(g => g.market === 'IN')!
  const xom = p.lines.find(l => l.symbol === 'XOM')!, dal = p.lines.find(l => l.symbol === 'DAL')!, ongc = p.lines.find(l => l.symbol === 'ONGC.NS')!
  check('portfolio: weighted by current value where a cached price exists (XOM 15 × 120), else by cost and labelled (DAL 20 × 50)',
    xom.weight === 1800 && xom.weightBasis === 'value' && xom.weightNote === VALUE_NOTE && dal.weight === 1000 && dal.weightBasis === 'cost' && dal.weightNote === COST_NOTE
      && ongc.weight === 30000 && ongc.weightBasis === 'value' && us.weight === 2800 && /USD value, cost where no current price\)/.test(us.text) && /of their INR value, cost where no current price\)/.test(inn.text),
    `${us.text} | ${inn.text}`)
  const expected = (1800 * xom.impact!.total + 1000 * dal.impact!.total) / 2800
  check('portfolio: the US figure is the value-weighted average of its holdings (USD only, never mixed with INR)', Math.abs(us.total! - expected) < 1e-9 && us.currency === 'USD' && inn.currency === 'INR', `${us.total!.toFixed(3)} vs ${expected.toFixed(3)}`)
  const noPrices = portfolioImpact(data, { preset: 'oil-up' }, holdings)
  check('portfolio: with no cached prices every holding is weighted by cost and says so', [...noPrices.lines, ...noPrices.notEstimated].every(l => l.weightBasis === 'cost' && l.weightNote === COST_NOTE) && noPrices.lines.find(l => l.symbol === 'XOM')!.weight === 1500)
  check('portfolio: per-market groups in their own currency; uncovered and unreliable holdings listed as not estimated, never guessed',
    us.currency === 'USD' && inn.currency === 'INR' && p.lines.some(l => l.symbol === 'DAL') && p.lines.some(l => l.symbol === 'ONGC.NS')
      && p.notEstimated.some(l => l.ticker === 'ZZZZ' && /not covered/.test(l.reason!)) && p.notEstimated.some(l => l.symbol === 'ASIANPAINT.NS' && /no reliable/.test(l.reason!)) && !p.notEstimated.some(l => l.impact),
    `${us.text} | ${inn.text}`)
  const ev = portfolioImpact(data, { preset: 'taiwan-chips' }, [{ ticker: 'NVDA', quantity: 1, buyPrice: 100 }, { ticker: 'JPM', quantity: 1, buyPrice: 100 }])
  check('portfolio: an event marks linked holdings with direction only', ev.lines.length === 1 && ev.lines[0].event?.direction === 'hurt' && !ev.lines[0].impact && ev.notEstimated.some(l => l.symbol === 'JPM'))
}

// ── 10. CPU per scenario ─────────────────────────────────────────────────────
{
  const t0 = performance.now(); let n = 0
  for (let k = 0; k < 20; k++) for (const market of ['US', 'IN'] as Market[]) for (const p of PRESETS.filter(p => p.markets.includes(market))) { run(market, { preset: p.id }); n++ }
  const per = (performance.now() - t0) / n
  check(`CPU: ${per.toFixed(2)} ms per scenario computation (uncached; the route memoises per parameter set)`, per < 20)
}

// ── 11. Live API ─────────────────────────────────────────────────────────────
const live: string[] = []
if (!OFFLINE) {
  // The shared lookup gives up after 4 s and the holding falls back to cost (app modules: local runs only).
  await import('./serverModules.ts')
  const { cachedPrices } = await import('../lib/scenario/prices.ts')
  const realFetch = globalThis.fetch
  globalThis.fetch = ((_u: unknown, init?: RequestInit) => new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as typeof fetch
  const alive = setTimeout(() => {}, 10_000) // AbortSignal.timeout's timer is unref'd: keep this script's event loop open meanwhile
  const t0 = performance.now(), p = await cachedPrices(['ZZTEST1', 'ZZTEST2'], () => null), ms = performance.now() - t0
  clearTimeout(alive)
  globalThis.fetch = realFetch
  const fallback = portfolioImpact(data, { preset: 'oil-up' }, [{ ticker: 'XOM', quantity: 1, buyPrice: 100 }], p)
  check('prices: an upstream that hangs is cut off at 4 s and holdings fall back to cost, labelled', Object.keys(p).length === 0 && ms >= 3900 && ms < 6000 && fallback.lines[0].weightNote === COST_NOTE, `${ms.toFixed(0)} ms`)
}
if (!OFFLINE) {
  const session = await signIn()
  if (typeof session === 'string') check('live check', false, `skipped: ${session}`)
  else {
    try {
      for (const [market, qs] of [['us', 'preset=oil-up'], ['in', 'preset=oil-up'], ['us', 'factor=us10y&shock=100'], ['in', 'preset=inr-weak']] as const) {
        const t0 = performance.now(), res = await session.req(`/api/scenario?market=${market}&${qs}`), ms = performance.now() - t0, j = await res.json()
        check(`live GET /api/scenario ${market} ${qs}`, res.status === 200 && !!j.data && /s-maxage=3600/.test(res.headers.get('cache-control') ?? ''), j.error ?? '')
        if (j.data) live.push(`${market.toUpperCase()} ${j.data.title} — ${ms.toFixed(0)} ms — ${j.data.stocks.length} estimated; helped: ${j.data.helped.map((i: any) => `${i.symbol} ${i.total.toFixed(1)}%`).join(', ') || '—'}; hurt: ${j.data.hurt.map((i: any) => `${i.symbol} ${i.total.toFixed(1)}%`).join(', ') || '—'}`)
      }
      const bad = await session.req('/api/scenario?market=us&factor=wti&shock=500')
      check('live: out-of-range custom shock → 400', bad.status === 400, String(bad.status))
      // Two holdings; only XOM's price is put in the app's cache first (the way the Portfolio page or a quote lookup would).
      const ids: number[] = []
      for (const t of ['XOM', 'NEM']) ids.push((await (await session.req('/api/portfolio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticker: t, quantity: 2, buyPrice: 100, buyDate: '2026-01-02' }) })).json()).data?.id)
      const quote = (await (await session.req('/api/stocks?ticker=XOM')).json()).data
      const pr = await session.req('/api/scenario/portfolio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ preset: 'oil-up' }) })
      const pj = await pr.json()
      const xom = pj.data?.lines?.find((l: any) => l.symbol === 'XOM'), all = [...(pj.data?.lines ?? []), ...(pj.data?.notEstimated ?? [])]
      check('live POST /api/scenario/portfolio: own holdings, private no-store; XOM weighted by its cached price, every line labelled by its basis',
        pr.status === 200 && pr.headers.get('cache-control') === 'private, no-store' && xom?.impact?.total > 0 && xom.weightBasis === 'value' && Math.abs(xom.weight / (2 * quote?.regularMarketPrice) - 1) < 0.02 /* another cached list may hold a few-seconds-different price */
          && all.every((l: any) => (l.weightBasis === 'value') === /current value/.test(l.weightNote)),
        `${JSON.stringify(pj.data?.groups?.map((g: any) => g.text))} | ${all.map((l: any) => `${l.ticker}: ${l.weightNote}${l.reason ? ` (${l.reason})` : ''}`).join('; ')}`)
      live.push(`Portfolio: ${all.map((l: any) => `${l.ticker} weight ${l.weight.toFixed(2)} — ${l.weightNote}`).join('; ')} | ${pj.data?.groups?.map((g: any) => g.text).join(' | ')}`)
      for (const id of ids) if (id) await session.req(`/api/portfolio?id=${id}`, { method: 'DELETE' })
    } finally {
      if (CLEANUP) check('live: throwaway account deleted', (await cleanupAccount()) === true)
    }
  }
  if (CLEANUP && typeof session === 'string') await cleanupAccount()
}

for (const r of rows) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.check}${r.detail ? `\n        ${r.detail}` : ''}`)
if (live.length) console.log(`\nLive results:\n${live.join('\n')}`)
const failed = rows.filter(r => !r.pass).length
console.log(`\n${rows.length - failed}/${rows.length} checks passed`)
process.exit(failed ? 1 : 0)
