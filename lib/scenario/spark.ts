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

export interface SparkQuote { price: number; changePct: number | null; at: number | null }

/** Spark response → price, day change and last-trade time by symbol (listing currency only). */
export function parseSparkQuotes(json: unknown): Record<string, SparkQuote> {
  const out: Record<string, SparkQuote> = {}
  for (const r of (json as { spark?: { result?: { symbol?: string; response?: { meta?: { regularMarketPrice?: number; currency?: string; regularMarketChangePercent?: number; regularMarketTime?: number } }[] }[] } })?.spark?.result ?? []) {
    const m = r.response?.[0]?.meta, sym = r.symbol?.toUpperCase(), p = m?.regularMarketPrice
    if (!sym || typeof p !== 'number' || !Number.isFinite(p) || p <= 0 || !currencyOk(sym, m?.currency)) continue
    const c = m?.regularMarketChangePercent, t = m?.regularMarketTime
    out[sym] = { price: p, changePct: typeof c === 'number' && Number.isFinite(c) ? c : null, at: typeof t === 'number' ? t * 1000 : null }
  }
  return out
}

/** Spark response → price by symbol (listing currency only). */
export function parseSpark(json: unknown): Record<string, number> {
  return Object.fromEntries(Object.entries(parseSparkQuotes(json)).map(([s, q]) => [s, q.price]))
}
