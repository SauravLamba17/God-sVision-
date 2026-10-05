import 'server-only'
import { readThrough } from '@/lib/cache'
import { trackedFetch as fetch } from '@/lib/feedHealth' // records feed health; same fetch semantics

// Per-ticker headlines from Google News RSS search (free, keyless), for the
// evidence engine only. Fetched just for the movers being explained and for
// on-demand symbols — never for a whole universe — and cached per ticker for
// 10 minutes, shared by all users on the instance.
//
// Checked Oct 2026 from a server: Google News RSS search works for US and India;
// Yahoo's per-ticker RSS (feeds.finance.yahoo.com/rss/2.0/headline) works for US
// tickers only (0 items for .NS) and carries mostly analysis pieces, so it isn't used.

export interface TickerNewsItem { title: string; url: string; source: string; publishedAt: string }

const LOCALE = { US: 'hl=en-US&gl=US&ceid=US:en', IN: 'hl=en-IN&gl=IN&ceid=IN:en' } as const
const TTL_SECONDS = 600
const MAX_ITEMS = 30 // in Google's relevance order
// Auto-generated price tickers / fund-holdings filings seen in results — never a reason for a move.
const SKIP_SOURCES = /^(MarketBeat|ad-hoc-news\.de|AD HOC NEWS|Pluang)$/i

const decode = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()

const day = (t: number) => new Date(t).toISOString().slice(0, 10)

async function fetchTickerNews(name: string, market: 'US' | 'IN', after: string, before: string): Promise<TickerNewsItem[]> {
  const q = encodeURIComponent(`"${name}" after:${after} before:${before}`)
  const res = await fetch(`https://news.google.com/rss/search?q=${q}&${LOCALE[market]}`, {
    signal: AbortSignal.timeout(8000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GODsVision/1.0)', Accept: 'application/rss+xml, application/xml' },
  })
  if (!res.ok) throw new Error(`Google News ${res.status}`)
  const xml = await res.text()
  const out: TickerNewsItem[] = []
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1]
    const source = decode(/<source[^>]*>([\s\S]*?)<\/source>/.exec(b)?.[1] ?? '')
    let title = decode(/<title>([\s\S]*?)<\/title>/.exec(b)?.[1] ?? '')
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3)) // "Headline - Reuters"
    const url = decode(/<link>([\s\S]*?)<\/link>/.exec(b)?.[1] ?? '')
    const published = new Date(decode(/<pubDate>([\s\S]*?)<\/pubDate>/.exec(b)?.[1] ?? ''))
    // No valid publish time → skip (it can't be placed in a session window).
    if (title && url && !isNaN(published.getTime()) && !SKIP_SOURCES.test(source)) out.push({ title, url, source: source || 'Google News', publishedAt: published.toISOString() })
    if (out.length >= MAX_ITEMS) break
  }
  return out
}

/**
 * Headlines naming one company (`name` is searched for) around one session
 * window. Google's date operators are day-granular, so the query is padded a
 * day each side; the engine applies the exact window.
 */
export async function getTickerNewsCached(symbol: string, name: string, market: 'US' | 'IN', window: { start: number; end: number }) {
  const after = day(window.start - 86400_000), before = day(window.end + 86400_000)
  return readThrough(`ticker_news_${market}_${symbol}_${after}_${before}`, TTL_SECONDS, () => fetchTickerNews(name, market, after, before), 600)
}
