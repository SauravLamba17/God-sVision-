/**
 * Scenario Engine checks.   npm run test:scenario
 *  1. Engine invariants (zero, sign flip, scaling)   2. Oil sanity (both markets)
 *  3. Reliability: unreliable links never produce numbers   4. Beyond-range flags
 *  5. Event presets: no percentages   6. Data-file integrity   7. Wording
 *  8. Method: alignment, weekly returns, HC1 regression   9. Portfolio   10. CPU
 *  11. Live: the API through a LOCAL server (shared throwaway account, see
 *      liveAccount.ts; `npm run test:scenario -- --cleanup` deletes it).
 */
import fs from 'node:fs'
import { assertScenarioWording, portfolioImpact, runScenario, SCENARIO_BANNED, validateShock, type ScenarioResult, type SensitivityData } from '../lib/scenario/engine.ts'
import { FACTOR_IDS, FACTORS, MARKET_FACTORS, SECTOR_FUNDS, type Market } from '../lib/scenario/factors.ts'
import { PRESETS } from '../lib/scenario/presets.ts'
import { alignedMove, dailyMoves, isoWeek, isReliable, olsHC1, rng, weekly } from '../lib/scenario/stats.ts'
import { getEntity } from '../lib/graph/index.ts'
import { signIn, cleanupAccount, CLEANUP } from './liveAccount.ts'

const rows: { check: string; pass: boolean; detail: string }[] = []
const check = (name: string, pass: boolean, detail = '') => rows.push({ check: name, pass, detail })
const data: SensitivityData = JSON.parse(fs.readFileSync(new URL('../data/scenario/sensitivities.json', import.meta.url), 'utf8'))
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

// ── 3. Unreliable links never produce numbers ───────────────────────────────
for (const market of ['US', 'IN'] as Market[]) for (const p of PRESETS.filter(p => p.markets.includes(market))) keep(run(market, { preset: p.id }))
{
  const leaks = all.flatMap(r => r.kind !== 'factor' ? [] : [
    ...r.stocks.filter(i => !data.stocks[i.symbol].factors[r.factor!.id]?.reliable).map(i => `${r.market} ${r.title}: ${i.symbol}`),
    ...r.sectors.filter(s => s.basis === 'fund' && s.total !== null && !data.sectors[s.symbol!].factors[r.factor!.id]?.reliable).map(s => `${r.title}: fund ${s.symbol}`),
    ...r.notEstimated.filter(n => r.stocks.some(i => i.symbol === n.symbol)).map(n => `${r.title}: ${n.symbol} both`),
  ])
  check(`reliability: every number comes from a reliable link (${all.length} scenarios checked)`, leaks.length === 0, leaks.slice(0, 5).join(' | '))
  const r = run('IN', { preset: 'inr-weak' })
  check('USD/INR +3% (India): no stock numbers (no reliable weekly link) but the Nifty\'s own reaction is shown', r.stocks.length === 0 && r.marketReaction?.reliable === true && (r.marketReaction.value ?? 0) < 0, r.marketReaction?.text)
  const rates = run('IN', { preset: 'rates-up' })
  check('US 10Y in India mode: only reliable links, with an honest note on Indian rates', rates.stocks.every(i => data.stocks[i.symbol].factors.us10y?.reliable) && rates.notes.some(n => /Indian interest rates are not covered/.test(n)))
}

// ── 4. Beyond historical range ───────────────────────────────────────────────
{
  const a = run('US', { preset: 'oil-up' }), b = run('US', { preset: 'rates-up' }), c = run('US', { factor: 'wti', shock: 30 }), d = run('US', { factor: 'wti', shock: 5 })
  check('range: oil +20% within, rates +100bp and WTI +30% flagged beyond the 5th–95th percentile, WTI +5% within',
    !a.range!.beyond && b.range!.beyond && c.range!.beyond && !d.range!.beyond && /Beyond historical range — estimate less reliable/.test(b.range!.text), b.range!.text)
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
  const wrongRule = Object.entries(data.stocks).flatMap(([s, e]) => Object.entries(e.factors).filter(([, f]) => f!.reliable !== isReliable(f!, !!f!.path)).map(([k]) => `${s}/${k}`))
  const missingFactors = Object.entries(data.stocks).filter(([, e]) => MARKET_FACTORS[e.market].some(f => !e.factors[f])).map(([s]) => s)
  check('data: no NaN/Infinity, valid dates, every stock in the graph, every fund configured, reliable flags match the rule',
    !bad.length && windows.every(w => dateOk(w.start) && dateOk(w.end) && w.start < w.end) && !notInGraph.length && Object.keys(data.sectors).every(s => SECTOR_FUNDS.some(f => f.symbol === s)) && !wrongRule.length && FACTOR_IDS.every(f => data.factors[f]),
    [bad.slice(0, 3).join(', '), notInGraph.join(', '), wrongRule.slice(0, 3).join(', ')].filter(Boolean).join(' | '))
  check('data: every graph company and every market factor has a fit (or is reported missing)', !missingFactors.length, missingFactors.join(', '))
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

// ── 9. Portfolio ─────────────────────────────────────────────────────────────
{
  const p = portfolioImpact(data, { preset: 'oil-up' }, [
    { ticker: 'XOM', quantity: 10, buyPrice: 100 }, { ticker: 'dal', quantity: 20, buyPrice: 50 }, { ticker: 'ZZZZ', quantity: 1, buyPrice: 1 },
    { ticker: 'ONGC', quantity: 100, buyPrice: 250 }, { ticker: 'ASIANPAINT.NS', quantity: 10, buyPrice: 2500 }, { ticker: 'XOM', quantity: 5, buyPrice: 100 },
  ])
  const us = p.groups.find(g => g.market === 'US')!, inn = p.groups.find(g => g.market === 'IN')!
  const xom = p.lines.find(l => l.symbol === 'XOM')!
  check('portfolio: per-market groups in their own currency; uncovered and unreliable holdings listed as not estimated, never guessed',
    us.currency === 'USD' && inn.currency === 'INR' && xom.costBasis === 1500 && p.lines.some(l => l.symbol === 'DAL') && p.lines.some(l => l.symbol === 'ONGC.NS')
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
{
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
      const anyHolding = await session.req('/api/portfolio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticker: 'XOM', quantity: 2, buyPrice: 100, buyDate: '2026-01-02' }) })
      const hid = (await anyHolding.json()).data?.id
      const pr = await session.req('/api/scenario/portfolio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ preset: 'oil-up' }) })
      const pj = await pr.json()
      check('live POST /api/scenario/portfolio: own holding estimated, private no-store', pr.status === 200 && pr.headers.get('cache-control') === 'private, no-store' && pj.data?.lines?.some((l: any) => l.symbol === 'XOM' && l.impact?.total > 0), JSON.stringify(pj.data?.groups))
      if (hid) await session.req(`/api/portfolio?id=${hid}`, { method: 'DELETE' })
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
