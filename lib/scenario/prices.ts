import 'server-only'
// Current prices for weighting a portfolio stress test.
//  1. Caches the app already fills (no upstream call): the Portfolio page's own batch
//     quote (same key /api/stocks builds from the user's tickers in the same order),
//     single-ticker quotes, the default watch list, Nifty 50 quotes and the day's movers.
//  2. If any holding is still unpriced: Yahoo's spark endpoint for ALL the user's tickers,
//     through Next's fetch Data Cache (revalidate 300 s) — shared by every Vercel
//     instance, so repeat requests within 5 minutes make no upstream call. The request
//     (and so the cache key) holds only the sorted ticker list — public data, never a
//     user id or quantity. Yahoo accepts ≤ 20 symbols per spark request, so up to
//     50 tickers go out as ≤ 3 parallel requests; a 4 s timeout or any failure leaves
//     those holdings unpriced (weighted by cost, labelled).
// Prices are in each listing's own currency (USD for US, INR for .NS); a quote in any
// other currency is ignored rather than mixed in.
import { getCache } from '@/lib/cache'
import { DEFAULT_TICKERS } from '@/lib/apis/yahoo'
import { recordFeed } from '@/lib/feedHealth'
import { parseSparkQuotes, sparkUrls, type SparkQuote } from './spark'

type Q = { symbol?: string; regularMarketPrice?: number; price?: number }
const SHARED_TTL = 300
const TIMEOUT_MS = 4000

/** One shared, cached spark lookup per ≤ 20 tickers: price, day change and last-trade time. Failures → no quotes (never throws). */
export async function sharedQuotes(tickers: string[]): Promise<Record<string, SparkQuote>> {
  const results = await Promise.all(sparkUrls(tickers).map(async url => {
    const t0 = performance.now()
    try {
      const res = await fetch(url, {
        next: { revalidate: SHARED_TTL }, signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', Accept: 'application/json' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const prices = parseSparkQuotes(await res.json())
      recordFeed('Yahoo spark (portfolio prices)', true, performance.now() - t0, undefined, res.status, Object.keys(prices).length)
      return prices
    } catch (e) {
      recordFeed('Yahoo spark (portfolio prices)', false, performance.now() - t0, (e as Error).message)
      return {}
    }
  }))
  return Object.assign({}, ...results)
}

/** Prices by symbol for these holdings; `resolve` maps a stored ticker to its data-file symbol (ONGC → ONGC.NS), null if uncovered. */
export async function cachedPrices(tickersInOrder: string[], resolve: (ticker: string) => string | null): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  const take = (q: Q | null | undefined) => {
    const sym = q?.symbol?.toUpperCase(), p = q?.regularMarketPrice ?? q?.price
    if (sym && typeof p === 'number' && Number.isFinite(p) && p > 0 && !(sym in out)) out[sym] = p
  }
  const read = <T>(key: string) => getCache<T>(key).then(c => c?.data ?? null, () => null)
  const portfolioKey = `quotes_${[...new Set(tickersInOrder.map(t => t.trim().toUpperCase()))].join(',')}`
  const [mine, defaults, nifty, movers] = await Promise.all([
    read<Q[]>(portfolioKey), read<Q[]>(`quotes_${DEFAULT_TICKERS.join(',')}`),
    read<{ quotes: Q[] }>('nifty50_quotes'), read<{ gainers: Q[]; losers: Q[] }>('market_movers'),
  ])
  for (const q of [...(mine ?? []), ...(defaults ?? []), ...(nifty?.quotes ?? []), ...(movers?.gainers ?? []), ...(movers?.losers ?? [])]) take(q)
  // One symbol per holding: its data-file symbol where it has one (ONGC → ONGC.NS), else its own ticker.
  const wanted = [...new Set(tickersInOrder.map(t => resolve(t) ?? t.trim().toUpperCase()))]
  const singles = await Promise.all(wanted.filter(s => !(s in out)).flatMap(s => [read<Q>(`quote_${s}`), read<Q[]>(`quotes_${s}`)]))
  for (const c of singles) take(Array.isArray(c) ? c[0] : c)
  // Still missing a price → the shared spark lookup for the whole list (stable key per portfolio).
  if (wanted.some(s => !(s in out))) for (const [s, q] of Object.entries(await sharedQuotes(wanted))) if (!(s in out)) out[s] = q.price
  return out
}
