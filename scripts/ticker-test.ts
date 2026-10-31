// Landing ticker checks.   npm run test:ticker [-- --cleanup]
//  1. tickerStatus: live / delayed / closed / hidden for each market session.
//  2. If a local server is running: /api/public/ticker's cache headers, and every
//     row compared with the dashboard's own API and with Yahoo's chart API at the
//     same moment (signs in as the throwaway account from liveAccount.ts).
import { tickerStatus, toMs, marketState } from '../lib/tickerStatus.ts'
import { BASE, CLEANUP, signIn, cleanupAccount } from './liveAccount.ts'

let failed = 0, total = 0
const check = (ok: boolean, label: string) => { total++; if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`) }
const at = (iso: string) => Date.parse(iso)
const MIN = 60_000

// ── 1. Status rules ──────────────────────────────────────────────────────────
const wedOpenUS = at('2026-10-28T18:00:00Z')          // Wed 14:00 EDT
const satUS = at('2026-10-31T16:00:00Z')              // Sat 12:00 EDT
const friCloseUS = at('2026-10-30T20:00:00Z')         // Fri 16:00 EDT
const monPreUS = at('2026-11-02T13:00:00Z')           // Mon 08:00 EST (DST ended Nov 1)
const wedOpenIN = at('2026-10-28T05:30:00Z')          // Wed 11:00 IST
const cases: [string, ReturnType<typeof tickerStatus>, ReturnType<typeof tickerStatus>][] = [
  ['crypto 1 min old', tickerStatus('crypto', satUS - MIN, satUS), 'live'],
  ['crypto 10 min old', tickerStatus('crypto', satUS - 10 * MIN, satUS), 'delayed'],
  ['crypto 30 min old → hidden', tickerStatus('crypto', satUS - 30 * MIN, satUS), null],
  ['US open, 2 min old', tickerStatus('us', wedOpenUS - 2 * MIN, wedOpenUS), 'live'],
  ['US open, 45 min old → hidden', tickerStatus('us', wedOpenUS - 45 * MIN, wedOpenUS), null],
  ['US Saturday, Friday close', tickerStatus('us', friCloseUS, satUS), 'closed'],
  ['US Saturday, Thursday close → hidden', tickerStatus('us', friCloseUS - 86_400_000, satUS), null],
  ['US Monday pre-open, Friday close', tickerStatus('us', friCloseUS, monPreUS), 'closed'],
  ['NSE open, 2 min old', tickerStatus('in', wedOpenIN - 2 * MIN, wedOpenIN), 'live'],
  ['NSE open, 30 min old → hidden', tickerStatus('in', wedOpenIN - 30 * MIN, wedOpenIN), null],
  ['FX Saturday, Friday 16:59 ET', tickerStatus('fx', friCloseUS + 59 * MIN, satUS), 'closed'],
  ['FX Wednesday, 3 min old', tickerStatus('fx', wedOpenUS - 3 * MIN, wedOpenUS), 'live'],
  ['futures daily break, 16:59 print', tickerStatus('fut', at('2026-10-28T20:59:00Z'), at('2026-10-28T21:30:00Z')), 'closed'],
  ['trade time in the future → hidden', tickerStatus('crypto', satUS + 10 * MIN, satUS), null],
  ['no trade time → hidden', tickerStatus('us', null, wedOpenUS), null],
]
for (const [label, got, want] of cases) check(got === want, `${label}: ${got}${got === want ? '' : `  (want ${want})`}`)
const ms = (s: 'us' | 'in', t: number) => JSON.stringify(marketState(s, t))
check(ms('us', wedOpenUS) === '{"open":true,"minutes":120}', `market state: US Wed 14:00 ET → open, closes in 120 min (${ms('us', wedOpenUS)})`)
check(ms('in', wedOpenIN) === '{"open":true,"minutes":270}', `market state: NSE Wed 11:00 IST → open, closes in 270 min (${ms('in', wedOpenIN)})`)
check(ms('us', monPreUS) === '{"open":false,"minutes":90}', `market state: US Mon 08:00 ET → closed, opens in 90 min (${ms('us', monPreUS)})`)
check(ms('in', satUS) === `{"open":false,"minutes":${2 * 1440 + 555 - (21 * 60 + 30)}}`, `market state: NSE Sat 21:30 IST → opens Mon 09:15 (${ms('in', satUS)})`)
// Sat 03:18 EDT → Mon 09:30 EST: clocks go back in between, so 2 d 7 h 12 m (3312 min), not 2 d 6 h 12 m.
check(ms('us', at('2026-10-31T07:18:00Z')) === '{"open":false,"minutes":3312}', `market state across DST: Sat 03:18 EDT → Mon 09:30 EST (${ms('us', at('2026-10-31T07:18:00Z'))})`)
check(toMs(1_700_000_000) === 1_700_000_000_000 && toMs(1_700_000_000_000) === 1_700_000_000_000
  && toMs('2026-10-31T00:00:00Z') === at('2026-10-31T00:00:00Z') && toMs(new Date(5)) === 5 && toMs('x') === null, 'toMs: s, ms, ISO, Date, junk')

// ── 2. Live: headers + accuracy ─────────────────────────────────────────────
let server = false
try { await fetch(BASE + '/auth/signin'); server = true } catch { console.log(`\n(no server at ${BASE} — live checks skipped)`) }
if (server) {
  const t0 = performance.now()
  const res = await fetch(BASE + '/api/public/ticker')
  const ms = Math.round(performance.now() - t0)
  const rows: any[] = await res.json()
  const cc = res.headers.get('cache-control') ?? ''
  console.log(`\n/api/public/ticker  ${res.status}  ${ms} ms  cache-control: ${cc}  x-nextjs-cache: ${res.headers.get('x-nextjs-cache')}`)
  check(res.ok && Array.isArray(rows), 'ticker answers with an array')
  check(/s-maxage=60\b/.test(cc), 'CDN-cached for 60 s (s-maxage=60)')
  check(!res.headers.get('set-cookie'), 'no cookies on the public feed')
  check(rows.every(r => r.price > 0 && Number.isFinite(r.changePercent) && r.time > 0 && ['live', 'delayed', 'closed'].includes(r.status)), 'every row has price, change, time, status')
  check(rows.every(r => tickerStatus(sessionOf(r.symbol), r.time) !== null), 'no row is stale for its session right now')

  const auth = await signIn()
  if (typeof auth === 'string') { console.log(`(dashboard comparison skipped: ${auth})`); failed++ }
  else {
    const { req } = auth
    const j = async (p: string) => (await (await req(p)).json()).data
    const [stocks, crypto, indices, inrFx, overview, forex, nifty] = await Promise.all([
      j('/api/stocks'), j('/api/crypto?type=top100'), j('/api/india/indices'), j('/api/india/forex'),
      j('/api/dashboard/overview'), j('/api/forex'), j('/api/india/stocks'),
    ])
    const sym = (l: any[] | undefined, k: string, v: string) => (l ?? []).find((x: any) => x?.[k] === v)
    const dash: Record<string, [number | undefined, string]> = {
      AAPL: [sym(stocks, 'symbol', 'AAPL')?.regularMarketPrice, '/api/stocks'],
      NVDA: [sym(stocks, 'symbol', 'NVDA')?.regularMarketPrice, '/api/stocks'],
      TSLA: [sym(stocks, 'symbol', 'TSLA')?.regularMarketPrice, '/api/stocks'],
      BTC: [sym(crypto, 'symbol', 'btc')?.current_price, '/api/crypto'],
      ETH: [sym(crypto, 'symbol', 'eth')?.current_price, '/api/crypto'],
      SOL: [sym(crypto, 'symbol', 'sol')?.current_price, '/api/crypto'],
      NIFTY: [sym(indices?.indices, 'name', 'NIFTY 50')?.price, '/api/india/indices'],
      SENSEX: [sym(indices?.indices, 'name', 'SENSEX')?.price, '/api/india/indices'],
      USDINR: [sym(inrFx?.pairs, 'ticker', 'USDINR=X')?.price, '/api/india/forex'],
      SPX: [sym(overview?.indices, 'symbol', '^GSPC')?.price, '/api/dashboard/overview'],
      GOLD: [sym(overview?.commodities, 'symbol', 'GC=F')?.price, '/api/dashboard/overview'],
      WTI: [sym(overview?.commodities, 'symbol', 'CL=F')?.price, '/api/dashboard/overview'],
      RELIANCE: [sym(nifty?.quotes, 'symbol', 'RELIANCE.NS')?.price, '/api/india/stocks'],
      EURUSD: [forex?.rates?.EUR ? 1 / forex.rates.EUR : undefined, '/api/forex (daily ref. rate)'],
      JPY: [forex?.rates?.JPY, '/api/forex (daily ref. rate)'],
    }
    const YAHOO: Record<string, string> = {
      AAPL: 'AAPL', NVDA: 'NVDA', TSLA: 'TSLA', BTC: 'BTC-USD', ETH: 'ETH-USD', SOL: 'SOL-USD', NIFTY: '^NSEI',
      SENSEX: '^BSESN', USDINR: 'USDINR=X', SPX: '^GSPC', GOLD: 'GC=F', WTI: 'CL=F', RELIANCE: 'RELIANCE.NS',
      EURUSD: 'EURUSD=X', JPY: 'JPY=X',
    }
    const yahoo = Object.fromEntries(await Promise.all(Object.entries(YAHOO).map(async ([s, y]) => {
      try {
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?range=1d&interval=1d`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        const m = (await r.json()).chart?.result?.[0]?.meta
        return [s, m ? { price: m.regularMarketPrice as number, time: (m.regularMarketTime as number) * 1000 } : null]
      } catch { return [s, null] }
    })))
    const diff = (a?: number, b?: number) => (a && b ? ((a - b) / b) * 100 : NaN)
    const fmt = (n: number) => (Number.isNaN(n) ? '   n/a' : `${n >= 0 ? '+' : ''}${n.toFixed(3)}%`)
    console.log(`\n${'SYMBOL'.padEnd(9)}${'STATUS'.padEnd(9)}${'LAST TRADE (UTC)'.padEnd(18)}${'TICKER'.padStart(13)}${'DASHBOARD'.padStart(13)}${'Δ dash'.padStart(10)}${'YAHOO'.padStart(13)}${'Δ yahoo'.padStart(10)}  dashboard source`)
    for (const s of Object.keys(YAHOO)) {
      const r = rows.find(x => x.symbol === s)
      const [d, src] = dash[s]
      const y = yahoo[s]
      const dd = diff(r?.price, d), dy = diff(r?.price, y?.price)
      console.log(`${s.padEnd(9)}${(r?.status ?? 'hidden').padEnd(9)}${(r ? new Date(r.time).toISOString().slice(5, 16).replace('T', ' ') : '').padEnd(18)}${(r?.price?.toPrecision(7) ?? '—').padStart(13)}${(d?.toPrecision(7) ?? '—').padStart(13)}${fmt(dd).padStart(10)}${(y?.price?.toPrecision(7) ?? '—').padStart(13)}${fmt(dy).padStart(10)}  ${src}`)
      if (!r) continue
      // Same cache → same number. The daily reference FX rate is a different feed (reported only).
      // Live crypto: the ticker is up to ~2 min old (60 s route + CDN), the dashboard 15 s, so allow 0.5%.
      const dashTol = r.status === 'closed' ? 0.001 : ['BTC', 'ETH', 'SOL'].includes(s) ? 0.5 : 0.05
      if (!src.includes('daily')) check(Math.abs(dd) <= dashTol, `${s} ticker = dashboard (${fmt(dd)}, tolerance ${dashTol}%)`)
      // Yahoo itself: exact for a close, within 0.25% for a moving market; crypto is CoinGecko vs Yahoo (1%).
      const tol = ['BTC', 'ETH', 'SOL'].includes(s) ? 1 : r.status === 'closed' ? 0.001 : 0.25
      check(Number.isFinite(dy) && Math.abs(dy) <= tol, `${s} ticker vs Yahoo chart (${fmt(dy)}, tolerance ${tol}%)`)
    }
  }
  if (CLEANUP) console.log(`\ncleanup: ${await cleanupAccount()}`)
}

function sessionOf(s: string) {
  return (['BTC', 'ETH', 'SOL'].includes(s) ? 'crypto' : ['NIFTY', 'SENSEX', 'RELIANCE'].includes(s) ? 'in'
    : ['USDINR', 'EURUSD', 'JPY'].includes(s) ? 'fx' : ['GOLD', 'WTI'].includes(s) ? 'fut' : 'us') as Parameters<typeof tickerStatus>[0]
}

console.log(`\n${total - failed}/${total} checks passed`)
process.exit(failed ? 1 : 0)
