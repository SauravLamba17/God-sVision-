import { getCache, setCache } from '@/lib/cache'

/**
 * FII/DII cash-market flows from NSE's own endpoint.
 *
 * This replaces a hardcoded FII_DII_DATA constant that was rendered under a
 * "NSE Data · <date>" label — the date was a string literal, so the panel
 * implied a live NSE feed while showing numbers that never changed.
 *
 * NSE serves this without a key, but it is protective of non-browser clients
 * and blocks datacenter ranges more often than residential ones. Every failure
 * path here returns null so the panel can say so, rather than substituting
 * invented numbers.
 */
const NSE_FII_DII = 'https://www.nseindia.com/api/fiidiiTradeReact'

const NSE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.nseindia.com/reports/fii-dii',
}

export interface FiiDiiFlow {
  fiiNetEquity: number
  fiiBuy: number
  fiiSell: number
  diiNetEquity: number
  diiBuy: number
  diiSell: number
  /** NSE's own trade date for these figures, e.g. "18-Sep-2026". */
  lastUpdated: string
}

// NSE publishes once per trading day after the session, so an hour is plenty.
const TTL_SECONDS = 3600

const toNum = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v.replace(/,/g, '')) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : null
}

export async function fetchFiiDii(): Promise<FiiDiiFlow | null> {
  const cacheKey = 'india_fii_dii_v1'
  const cached = await getCache<FiiDiiFlow>(cacheKey)
  if (cached && !cached.stale) return cached.data

  try {
    const res = await fetch(NSE_FII_DII, { headers: NSE_HEADERS, signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error(`NSE responded ${res.status}`)

    const rows: any[] = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('NSE returned no rows')

    // Categories come back as "FII/FPI" and "DII".
    const fii = rows.find(r => String(r?.category ?? '').toUpperCase().startsWith('FII'))
    const dii = rows.find(r => String(r?.category ?? '').toUpperCase().startsWith('DII'))

    const fiiNet = toNum(fii?.netValue)
    const diiNet = toNum(dii?.netValue)
    const date = String(fii?.date ?? dii?.date ?? '').trim()

    // Without both net figures and a date there is nothing honest to show.
    if (fiiNet === null || diiNet === null || !date) throw new Error('NSE payload missing expected fields')

    const flow: FiiDiiFlow = {
      fiiNetEquity: fiiNet,
      fiiBuy: toNum(fii?.buyValue) ?? 0,
      fiiSell: toNum(fii?.sellValue) ?? 0,
      diiNetEquity: diiNet,
      diiBuy: toNum(dii?.buyValue) ?? 0,
      diiSell: toNum(dii?.sellValue) ?? 0,
      lastUpdated: date,
    }

    await setCache(cacheKey, flow, TTL_SECONDS)
    return flow
  } catch {
    // Serve the last good figures if we have them — they carry their own NSE
    // date, so a stale-but-real number is still labelled truthfully.
    if (cached) return cached.data
    return null
  }
}
