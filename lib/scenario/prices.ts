import 'server-only'
// Current prices for weighting a portfolio stress test — read ONLY from caches the app
// already fills (no upstream call, ever): the Portfolio page's own batch quote (same key
// /api/stocks builds from the user's tickers in the same order), single-ticker quotes,
// the default watch list, Nifty 50 quotes and the day's movers. Prices are in each
// listing's own currency (USD for US, INR for .NS).
import { getCache } from '@/lib/cache'
import { DEFAULT_TICKERS } from '@/lib/apis/yahoo'

type Q = { symbol?: string; regularMarketPrice?: number; price?: number }

export async function cachedPrices(tickersInOrder: string[], symbols: string[]): Promise<Record<string, number>> {
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
  const missing = [...new Set([...symbols, ...tickersInOrder.map(t => t.trim().toUpperCase())])].filter(s => !(s in out))
  const singles = await Promise.all(missing.flatMap(s => [read<Q>(`quote_${s}`), read<Q[]>(`quotes_${s}`)]))
  for (const c of singles) take(Array.isArray(c) ? c[0] : c)
  return out
}
