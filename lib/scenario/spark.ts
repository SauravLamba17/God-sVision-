// Pure helpers for the shared portfolio-price lookup (lib/scenario/prices.ts): the request
// URLs — and so the shared Data Cache key — carry only the sorted ticker list.
export const MAX_TICKERS = 50
const PER_REQUEST = 20 // Yahoo: "Number of symbols needs to be less than or equal to 20"
const SPARK = 'https://query1.finance.yahoo.com/v7/finance/spark'

/** Request URLs for these tickers: upper-cased, de-duplicated, sorted, ≤ 50, ≤ 20 per URL — and nothing else. */
export function sparkUrls(tickers: string[]): string[] {
  const list = [...new Set(tickers.map(t => t.trim().toUpperCase()).filter(Boolean))].sort().slice(0, MAX_TICKERS)
  const urls: string[] = []
  for (let i = 0; i < list.length; i += PER_REQUEST) urls.push(`${SPARK}?symbols=${list.slice(i, i + PER_REQUEST).map(encodeURIComponent).join(',')}&range=1d&interval=1d`)
  return urls
}

const currencyOk = (symbol: string, currency: unknown) => currency === (symbol.endsWith('.NS') ? 'INR' : 'USD')

/** Spark response → price by symbol (listing currency only). */
export function parseSpark(json: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of (json as { spark?: { result?: { symbol?: string; response?: { meta?: { regularMarketPrice?: number; currency?: string } }[] }[] } })?.spark?.result ?? []) {
    const m = r.response?.[0]?.meta, sym = r.symbol?.toUpperCase(), p = m?.regularMarketPrice
    if (sym && typeof p === 'number' && Number.isFinite(p) && p > 0 && currencyOk(sym, m?.currency)) out[sym] = p
  }
  return out
}

