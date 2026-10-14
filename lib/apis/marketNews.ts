import 'server-only'
import Parser from 'rss-parser'
import { getCache, readThrough } from '@/lib/cache'
import { recordFeed } from '@/lib/feedHealth'
import { sessionWindow } from '@/lib/evidence/engine'
import { SKIP_SOURCES } from '@/lib/apis/tickerNews'

// US market news for the Evidence Engine and Market Brain only (the /api/news
// panel is unchanged). Audited Oct 2026 from a residential IP; kept only feeds
// that answered with dated, current market news:
//   kept      CNBC Economy / Earnings / Finance; Google News searches "stock market",
//             "Federal Reserve", "oil prices", earnings; Federal Reserve press
//             releases; Investing.com stock market news
//   rejected  MarketWatch top stories (301 → 400) and Market Pulse (frozen, newest
//             item mid-2025); Yahoo Finance rssindex (404); CNBC Market Insider and
//             Investing (≤1 item a day); Google News "Wall Street" (matches the
//             publisher name — mostly WSJ general news); EIA Today in Energy and
//             press releases (≤1 retrospective piece a day); Reuters (feeds.reuters.com
//             no longer resolves, reuters.com and reutersagency.com feeds 404 / time out)
//
// Each feed is fetched in parallel with its own timeout, parsed once, cached per
// feed for its TTL (one entry per instance, shared by every request), and recorded
// on /admin/health as "News: <name>" with status, item count and last success.
// A blocked or broken feed (403 from a datacenter IP, timeout, HTML instead of
// XML, zero items) adds nothing and never affects the others: it keeps its last
// good items (each still dated, so session windows apply) and is retried after its TTL.

export interface MarketFeed {
  id: string
  /** Shown on /admin/health as "News: <name>". */
  name: string
  /** A direct RSS URL, or a Google News search (`query`). */
  url?: string
  query?: string
  /** Publisher shown as the source; feeds of one publisher share it, so they count
   *  as one outlet (outletKey). null = Google News: each item's own publisher. */
  outlet: string | null
  region: 'US'
  timeoutMs: number
  ttl: number     // seconds
  limit: number   // items kept, in feed order
}

const MIN = 60
export const MARKET_FEEDS: MarketFeed[] = [
  { id: 'cnbc-economy', name: 'CNBC Economy', url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html', outlet: 'CNBC', region: 'US', timeoutMs: 8000, ttl: 5 * MIN, limit: 30 },
  { id: 'cnbc-earnings', name: 'CNBC Earnings', url: 'https://www.cnbc.com/id/15839135/device/rss/rss.html', outlet: 'CNBC', region: 'US', timeoutMs: 8000, ttl: 5 * MIN, limit: 30 },
  { id: 'cnbc-finance', name: 'CNBC Finance', url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html', outlet: 'CNBC', region: 'US', timeoutMs: 8000, ttl: 5 * MIN, limit: 30 },
  { id: 'gn-stock-market', name: 'Google News: stock market', query: '"stock market"', outlet: null, region: 'US', timeoutMs: 8000, ttl: 10 * MIN, limit: 100 },
  { id: 'gn-fed', name: 'Google News: Federal Reserve', query: '"Federal Reserve"', outlet: null, region: 'US', timeoutMs: 8000, ttl: 10 * MIN, limit: 100 },
  { id: 'gn-oil', name: 'Google News: oil prices', query: '"oil prices"', outlet: null, region: 'US', timeoutMs: 8000, ttl: 10 * MIN, limit: 100 },
  { id: 'gn-earnings', name: 'Google News: earnings', query: 'earnings', outlet: null, region: 'US', timeoutMs: 8000, ttl: 10 * MIN, limit: 100 },
  { id: 'fed-press', name: 'Federal Reserve press releases', url: 'https://www.federalreserve.gov/feeds/press_all.xml', outlet: 'Federal Reserve', region: 'US', timeoutMs: 8000, ttl: 10 * MIN, limit: 20 },
  { id: 'investing-stocks', name: 'Investing.com stock market news', url: 'https://www.investing.com/rss/news_25.rss', outlet: 'Investing.com', region: 'US', timeoutMs: 8000, ttl: 10 * MIN, limit: 30 },
]
export const healthName = (f: MarketFeed) => `News: ${f.name}`

export interface MarketNewsItem { title: string; url: string; source: string; publishedAt: string; feed: string }

const H = 3600_000
const MAX_AGE = 48 * H
const UA = 'Mozilla/5.0 (compatible; GODsVision/1.0)'
const parser = new Parser({ customFields: { item: ['source'] } })

/**
 * Google News search URL covering the session windows in use: since the previous
 * US close, plus two days on weekends (Friday's move still shows then).
 * ponytail: weekday arithmetic, no holiday calendar — after a holiday the search
 * starts a day late; the engine's own window check is unaffected.
 */
export function feedUrl(f: MarketFeed, now: number): string {
  if (f.url) return f.url
  const wd = new Date(now).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' })
  const hours = Math.ceil((now - sessionWindow({ marketTime: null }, 'US', now).start) / H) + (wd === 'Sat' || wd === 'Sun' ? 48 : 1)
  return `https://news.google.com/rss/search?q=${encodeURIComponent(`${f.query} when:${hours}h`)}&hl=en-US&gl=US&ceid=US:en`
}

const decode = (s: string) => s.replace(/<[^>]+>/g, '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim()

/** Feed XML → items. Undated, unlinked and publisher-less (Google) items are dropped. Exported for tests. */
export async function parseFeed(xml: string, f: MarketFeed): Promise<MarketNewsItem[]> {
  const out: MarketNewsItem[] = []
  for (const it of (await parser.parseString(xml)).items ?? []) {
    let title = decode(it.title ?? '')
    const published = Date.parse(it.isoDate ?? it.pubDate ?? '')
    if (!title || !it.link || !Number.isFinite(published)) continue
    let source = f.outlet
    if (source === null) {
      // Google News: <source url="…">Reuters</source>; the title ends " - Reuters".
      const src = (it as any).source
      const publisher = decode(typeof src === 'string' ? src : src?._ ?? '')
      if (!publisher || SKIP_SOURCES.test(publisher)) continue
      if (title.endsWith(` - ${publisher}`)) title = title.slice(0, -(publisher.length + 3))
      source = `${publisher} (Google News)`
    }
    out.push({ title, url: it.link, source, publishedAt: new Date(published).toISOString(), feed: f.id })
    if (out.length >= f.limit) break
  }
  return out
}

async function fetchFeed(f: MarketFeed, now: number): Promise<MarketNewsItem[]> {
  const t0 = performance.now()
  let status: number | undefined
  try {
    const res = await fetch(feedUrl(f, now), {
      cache: 'no-store', signal: AbortSignal.timeout(f.timeoutMs),
      headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
    })
    status = res.status
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const items = await parseFeed(await res.text(), f)
    if (!items.length) throw new Error('no items parsed')
    recordFeed(healthName(f), true, performance.now() - t0, undefined, status, items.length)
    return items
  } catch (e) {
    recordFeed(healthName(f), false, performance.now() - t0, (e as Error).message, status, 0)
    throw e
  }
}

const inflight = new Map<string, Promise<MarketNewsItem[]>>()
/** One feed, cached for its TTL; on failure its last good items (dated) or nothing. */
async function loadFeed(f: MarketFeed, now: number): Promise<MarketNewsItem[]> {
  const key = `market_news_${f.id}`
  const run = inflight.get(key) ?? readThrough(key, f.ttl, async () => {
    try { return await fetchFeed(f, now) } catch { return (await getCache<MarketNewsItem[]>(key))?.data ?? [] }
  }).then(r => r.data, () => [])
  inflight.set(key, run)
  try { return (await run).filter(i => now - Date.parse(i.publishedAt) <= MAX_AGE) } finally { inflight.delete(key) }
}

/** Items from these feeds, fetched in parallel; each feed fails on its own. Exported for tests. */
export async function loadFeeds(feeds: MarketFeed[], now = Date.now()): Promise<MarketNewsItem[][]> {
  return Promise.all(feeds.map(f => loadFeed(f, now)))
}

/** The region's market news (feed config order). Throws only if every feed came back empty. */
export async function getMarketNewsCached(region: MarketFeed['region']): Promise<MarketNewsItem[]> {
  const per = await loadFeeds(MARKET_FEEDS.filter(f => f.region === region))
  if (per.every(p => !p.length)) throw new Error('no market news feed returned items')
  return per.flat()
}
