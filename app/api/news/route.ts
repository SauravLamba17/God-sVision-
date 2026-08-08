import { NextResponse } from 'next/server'
import { fetchRSSFeeds, fetchHackerNews, fetchRedditPosts, fetchNewsAPI, getRSSFeedNames } from '@/lib/apis/news'
import { setCache, getCache } from '@/lib/cache'

const CACHE_KEY = 'news_all'
const CACHE_TTL = 90  // seconds — down from 300s so news refreshes every 1.5 min

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

    const sorted = all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
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

    await setCache(CACHE_KEY, { items: unique, meta }, CACHE_TTL)
    return NextResponse.json({ data: unique, source: 'live', meta })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    if (cached) return NextResponse.json({ data: cached.data.items, source: 'cached', meta: cached.data.meta, error: msg })
    return NextResponse.json({ error: msg, data: [], source: 'empty', meta: { total: 0, sources: 0, lastUpdated: new Date().toISOString(), feedNames: [] } })
  }
}
