import { readThrough } from '@/lib/cache'
import { INDIA_NEWS_FEEDS } from '@/lib/apis/india'
import { trackedFetch as fetch } from '@/lib/feedHealth' // records feed health; same fetch semantics

// India RSS headlines, cached (shared by /api/india/news and the evidence engine).

export interface IndiaNewsItem {
  title: string
  url: string
  source: string
  publishedAt: string
  summary?: string
}

async function fetchFeed(feed: { name: string; url: string }): Promise<IndiaNewsItem[]> {
  try {
    const res = await fetch(feed.url, {
      next: { revalidate: 300 }, signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GODsVision/1.0; +https://finance.yahoo.com)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    })
    if (!res.ok) return []
    const text = await res.text()

    const items: IndiaNewsItem[] = []
    const itemRe = /<item>([\s\S]*?)<\/item>/g
    let m: RegExpExecArray | null
    const unwrap = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, '').trim()
    while ((m = itemRe.exec(text)) !== null && items.length < 50) {
      const block = m[1]
      const rawTitle = (/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/.exec(block)?.[1] ||
                       /<title>([\s\S]*?)<\/title>/.exec(block)?.[1] || '').trim()
      const title = rawTitle.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/<[^>]+>/g, '').trim()
      const link  = unwrap(/<link>(.*?)<\/link>/.exec(block)?.[1] ||
                     /<guid>(.*?)<\/guid>/.exec(block)?.[1] || '')
      // Livemint, NDTV Profit and The Hindu wrap pubDate in CDATA; unparsed, it
      // threw in toISOString() and the whole feed was dropped.
      const published = new Date(unwrap(/<pubDate>(.*?)<\/pubDate>/.exec(block)?.[1] || ''))
      const cdataDesc = /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/.exec(block)?.[1] || ''
      const plainDesc = /<description>([\s\S]*?)<\/description>/.exec(block)?.[1] || ''
      const desc  = (cdataDesc || plainDesc).replace(/<[^>]+>/g, '').trim()
      // No valid publish time → skip (stamping "now" would invent one).
      if (title && link && !isNaN(published.getTime())) {
        items.push({
          title,
          url: link,
          source: feed.name,
          publishedAt: published.toISOString(),
          summary: desc.slice(0, 200),
        })
      }
    }
    return items
  } catch {
    return []
  }
}

export async function getIndiaNewsCached() {
  return readThrough('india_news', 300, async () => {
    const batches = await Promise.allSettled(INDIA_NEWS_FEEDS.map(fetchFeed))
    const all: IndiaNewsItem[] = []
    const seen = new Set<string>()

    for (const batch of batches) {
      if (batch.status === 'fulfilled') {
        for (const item of batch.value) {
          const key = item.title.slice(0, 60).toLowerCase()
          if (!seen.has(key)) { seen.add(key); all.push(item) }
        }
      }
    }

    all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    // Last 48h (like the global feed), not just the newest 40: the evidence
    // engine needs the whole session's stories. The route still serves 40.
    const cutoff = Date.now() - 48 * 3600_000
    const articles = all.filter(a => new Date(a.publishedAt).getTime() >= cutoff).slice(0, 200)
    return { articles, total: articles.length, fetchedAt: Date.now() }
  }, 60)
}
