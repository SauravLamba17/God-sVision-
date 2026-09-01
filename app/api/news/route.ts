import { NextResponse } from 'next/server'
import { fetchRSSFeeds, fetchHackerNews, fetchRedditPosts, fetchNewsAPI, getRSSFeedNames } from '@/lib/apis/news'
import { setCache, getCache } from '@/lib/cache'

const CACHE_KEY = 'news_all'
const CACHE_TTL = 90  // seconds — down from 300s so news refreshes every 1.5 min
// News is the one payload where serving a long-expired fallback is worse than
// serving nothing: a stale entry may only outlive its TTL by a minute, just
// enough to absorb a burst of concurrent requests during a refetch. The global
// 24h default exists for rate-limited feeds (flights, webcams), not for this.
const CACHE_STALE_GRACE = 60
// Feeds publish at wildly different cadences, and a few (e.g. WHO) can sit
// months behind. Without this, every stale item stays in the payload forever
// and surfaces as "4-day-old news" once a category is filtered or scrolled.
const MAX_ARTICLE_AGE_MS = 48 * 60 * 60 * 1000

interface NewsPayload {
  items: unknown[]
  meta: { total: number; sources: number; lastUpdated: string; feedNames: string[] }
}

export async function GET() {
  const cached = await getCache<NewsPayload>(CACHE_KEY)
  if (cached && !cached.stale) {
    return NextResponse.json({ data: cached.data.items, source: 'cache', meta: cached.data.meta })
  }

  try {
    const [rss, hn, reddit, newsapi] = await Promise.allSettled([
      fetchRSSFeeds(),
      fetchHackerNews(),
      fetchRedditPosts(),
      fetchNewsAPI('general'),
    ])

    const all = [
      ...(rss.status === 'fulfilled' ? rss.value : []),
      ...(hn.status === 'fulfilled' ? hn.value : []),
      ...(reddit.status === 'fulfilled' ? reddit.value : []),
      ...(newsapi.status === 'fulfilled' ? newsapi.value : []),
    ]

    const cutoff = Date.now() - MAX_ARTICLE_AGE_MS
    const recent = all.filter(item => {
      const t = new Date(item.publishedAt).getTime()
      return !isNaN(t) && t >= cutoff
    })

    const sorted = recent.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    // Deduplicate on first 60 chars of title
    const unique = sorted.filter((item, idx, self) =>
      idx === self.findIndex(t => t.title.slice(0, 60) === item.title.slice(0, 60))
    )

    const sources = new Set(unique.map(u => u.source))
    const meta = {
      total: unique.length,
      sources: sources.size,
      lastUpdated: new Date().toISOString(),
      feedNames: getRSSFeedNames(),
    }

    await setCache(CACHE_KEY, { items: unique, meta }, CACHE_TTL, CACHE_STALE_GRACE)
    return NextResponse.json({ data: unique, source: 'live', meta })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    if (cached) return NextResponse.json({ data: cached.data.items, source: 'cached', meta: cached.data.meta, error: msg })
    return NextResponse.json({ error: msg, data: [], source: 'empty', meta: { total: 0, sources: 0, lastUpdated: new Date().toISOString(), feedNames: [] } })
  }
}
