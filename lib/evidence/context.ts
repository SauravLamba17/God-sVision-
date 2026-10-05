import 'server-only'
// Builds the Evidence Engine's inputs from data the app ALREADY fetches, through
// the same shared, cached loaders the dashboard routes use (same cache keys and
// TTLs). Normally every input is a cache hit; on a cold instance a loader runs
// exactly the request its own route would have made. No new upstream APIs.
//
// Inputs used (reliable):            US                           India
//   benchmark / index moves          overview (^GSPC ^IXIC …)     india indices (^NSEI ^BSESN ^NSEBANK)
//   sector moves                     SPDR sector ETFs (overview)  average of Nifty 50 names per graph sector
//   peers                            quotes the app holds         all Nifty 50 quotes
//   news                             aggregated news feed         India RSS feeds + aggregated feed
//   linked events                    USGS earthquakes, WHO outbreak reports (both markets)
//   commodities                      overview futures (gold, silver, crude, nat gas, copper)
//   currency                         —                            USD/INR (india forex)
//   scheduled                        Nasdaq earnings, macro cal.  macro calendar (INR)
//   volume vs average                screener avg volume          5-day average from the same chart response
// Excluded (not reliable enough to attribute moves): weather (no per-company
// mapping), flight data (no disruption signal), FII/DII (one-day lag), social.
import type { Headline, LinkedEventInput, MarketContext, Market, Quote } from './types.ts'
import { matchEntitiesInText, resolveEntity } from '@/lib/graph'
import { scoreHeadlines } from '@/lib/apis/newsSentiment'
import { getDashboardOverview } from '@/lib/apis/overview'
import { DEFAULT_TICKERS } from '@/lib/apis/yahoo'
import { getAllNewsCached } from '@/lib/apis/news'
import { getIndiaNewsCached } from '@/lib/apis/indiaNews'
import { getNifty50QuotesCached, getIndiaIndicesCached, getIndiaForexCached, getMarketMoversCached } from '@/lib/apis/cachedLoaders'
import { getEarthquakesCached } from '@/lib/apis/usgs'
import { fetchOutbreaks } from '@/lib/apis/whoOutbreaks'
import { getUpcoming } from '@/lib/apis/earnings'
import { fetchCalendarEvents } from '@/lib/apis/calendar'
import { getCache } from '@/lib/cache'

type Status = 'ok' | 'stale' | 'unavailable'
async function load<T>(inputs: Record<string, Status>, name: string, fn: () => Promise<{ data: T; source?: string } | T>): Promise<T | null> {
  try {
    const r: any = await fn()
    const wrapped = r && typeof r === 'object' && 'data' in r && 'source' in r
    inputs[name] = wrapped && r.source === 'stale' ? 'stale' : 'ok'
    return wrapped ? r.data : r
  } catch {
    inputs[name] = 'unavailable'
    return null
  }
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
// regularMarketTime arrives as unix seconds (chart API), a Date (yahoo-finance2)
// or an ISO string (a Date that went through the JSON cache).
export function toMs(v: unknown): number | null {
  if (v instanceof Date) return v.getTime()
  if (typeof v === 'string') return Date.parse(v) || null
  const n = num(v)
  return n == null ? null : n < 1e12 ? n * 1000 : n
}

function yahooToQuote(q: any, at: number): Quote | null {
  const changePct = num(q.regularMarketChangePercent) ?? num(q.changePct)
  if (!q?.symbol || changePct == null) return null
  return {
    symbol: q.symbol, name: q.longName ?? q.shortName ?? q.label ?? q.symbol,
    price: num(q.regularMarketPrice) ?? num(q.price), changePct,
    volume: num(q.regularMarketVolume) ?? num(q.volume), avgVolume: num(q.averageDailyVolume3Month) ?? num(q.averageDailyVolume10Day) ?? num(q.avgVolume),
    at, marketTime: toMs(q.regularMarketTime ?? q.marketTime),
  }
}

// Same story from two feeds counts once; a headline without a publish time is
// dropped (it can't be placed inside or outside a session window).
function headlinesFrom(raw: { title: string; url?: string; link?: string; source?: string; publishedAt?: string }[], startId: number): Headline[] {
  const seen = new Set<string>()
  const items = raw.filter(i => {
    const key = i.title.trim().toLowerCase().replace(/\s+/g, ' ')
    if (!Date.parse(i.publishedAt ?? '') || seen.has(key)) return false
    seen.add(key)
    return true
  })
  const sentiments = scoreHeadlines(items.map(i => i.title))
  return items.map((i, k) => ({
    id: startId + k, title: i.title.trim(), url: i.url ?? i.link, source: i.source ?? 'News',
    publishedAt: Date.parse(i.publishedAt!),
    entities: matchEntitiesInText(i.title).map(m => m.entity.id),
    sentiment: sentiments[k].sentiment,
  }))
}

function eventCountries(text: string): string[] {
  return matchEntitiesInText(text).filter(m => m.entity.type === 'country').map(m => m.entity.id)
}

export async function buildContext(market: Market): Promise<MarketContext> {
  const now = Date.now()
  const inputs: Record<string, Status> = {}
  const ctx: MarketContext = {
    market, builtAt: now, indices: {}, sectorEtfs: {}, quotes: {}, commodities: {}, currencies: {},
    headlines: [], events: [], earnings: [], macro: [], globalIndices: {}, inputs,
  }

  const [overview, quakes, outbreaks, calendar] = await Promise.all([
    load<any>(inputs, 'overview', getDashboardOverview),
    load<any[]>(inputs, 'earthquakes', () => getEarthquakesCached('recent', 2.5)),
    load<any[]>(inputs, 'outbreaks', () => fetchOutbreaks(10)),
    load<any[]>(inputs, 'macro calendar', () => fetchCalendarEvents('this')),
  ])
  const ovAt = overview?.fetchedAt ?? now

  for (const c of overview?.commodities ?? []) {
    const e = resolveEntity(c.symbol), q = yahooToQuote(c, ovAt)
    if (e?.type === 'commodity' && q && !ctx.commodities[e.id]) ctx.commodities[e.id] = { ...q, name: e.name }
  }
  for (const q of quakes ?? []) {
    ctx.events.push({ kind: 'earthquake', title: `M${q.magnitude} earthquake — ${q.place}`, url: q.url, at: q.time, magnitude: q.magnitude, countries: eventCountries(q.place ?? '') })
  }
  for (const o of outbreaks ?? []) {
    ctx.events.push({ kind: 'outbreak', title: o.title, url: o.link, at: Date.parse(o.date) || now, countries: eventCountries(o.title) } as LinkedEventInput)
  }
  ctx.macro = (calendar ?? []).map(e => ({ title: e.event, currency: e.currency, date: e.date, time: e.time, impact: e.impact }))

  if (market === 'US') {
    const [movers, news, earnings] = await Promise.all([
      load<any>(inputs, 'movers', getMarketMoversCached),
      load<any>(inputs, 'news', getAllNewsCached),
      load<any[]>(inputs, 'earnings calendar', getUpcoming),
    ])
    for (const i of overview?.indices ?? []) { const q = yahooToQuote(i, ovAt); if (q) ctx.indices[q.symbol] = { ...q, name: i.label ?? q.name } }
    for (const s of overview?.sectors ?? []) {
      const e = resolveEntity(s.symbol), q = yahooToQuote(s, ovAt)
      if (e?.type === 'sector' && q) ctx.sectorEtfs[e.id] = { ...q, name: e.name, etf: s.symbol }
    }
    for (const g of overview?.globalMarkets ?? []) { const q = yahooToQuote(g, ovAt); if (q) ctx.globalIndices[q.symbol] = { ...q, name: g.label ?? q.name } }
    // Quotes the app holds: today's movers, plus the default watch list if this instance has it cached (no fetch).
    for (const q of [...(movers?.gainers ?? []), ...(movers?.losers ?? [])]) { const x = yahooToQuote(q, now); if (x) ctx.quotes[x.symbol] = x }
    const defaults = await getCache<any[]>(`quotes_${DEFAULT_TICKERS.join(',')}`).catch(() => null)
    for (const q of defaults?.data ?? []) { const x = yahooToQuote(q, now); if (x && !ctx.quotes[x.symbol]) ctx.quotes[x.symbol] = x }
    ctx.headlines = headlinesFrom(news?.items ?? [], 0)
    ctx.earnings = (earnings ?? []).map(e => ({ symbol: e.ticker, date: e.date, timing: e.timing }))
  } else {
    const [nifty, idx, fx, inNews, news] = await Promise.all([
      load<any>(inputs, 'nifty 50 quotes', getNifty50QuotesCached),
      load<any>(inputs, 'india indices', getIndiaIndicesCached),
      load<any>(inputs, 'usd/inr', getIndiaForexCached),
      load<any>(inputs, 'india news', getIndiaNewsCached),
      load<any>(inputs, 'news', getAllNewsCached),
    ])
    const at = nifty?.fetchedAt ?? now
    for (const q of nifty?.quotes ?? []) { const x = yahooToQuote(q, at); if (x) ctx.quotes[x.symbol] = x }
    for (const i of idx?.indices ?? []) { const x = yahooToQuote({ ...i, symbol: i.ticker }, idx.fetchedAt ?? now); if (x) ctx.indices[x.symbol] = { ...x, name: i.name } }
    const usdinr = (fx?.pairs ?? []).find((p: any) => p.ticker === 'USDINR=X')
    if (usdinr && num(usdinr.changePct) != null) ctx.currencies['currency:usd'] = { symbol: 'USDINR=X', name: 'USD/INR', price: usdinr.price, changePct: usdinr.changePct, at: fx.fetchedAt ?? now }
    for (const g of overview?.globalMarkets ?? []) { const q = yahooToQuote(g, ovAt); if (q && q.symbol !== '^BSESN') ctx.globalIndices[q.symbol] = { ...q, name: g.label ?? q.name } }
    for (const i of overview?.indices ?? []) { const q = yahooToQuote(i, ovAt); if (q && ['^GSPC', '^IXIC'].includes(q.symbol)) ctx.globalIndices[q.symbol] = { ...q, name: `${i.label ?? q.name} (last session)` } }
    // India feeds first; headlinesFrom drops the global copies of the same stories.
    ctx.headlines = headlinesFrom([...(inNews?.articles ?? []), ...(news?.items ?? [])], 0)
  }
  return ctx
}
