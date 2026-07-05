import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'
import { INDIA_NEWS_FEEDS } from '@/lib/apis/india'

interface NewsItem {
  title: string
  url: string
  source: string
  publishedAt: string
  summary?: string
}

async function fetchFeed(feed: { name: string; url: string }): Promise<NewsItem[]> {
  try {
    const res = await fetch(feed.url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GODsVision/1.0; +https://finance.yahoo.com)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    })
    if (!res.ok) return []
    const text = await res.text()

    const items: NewsItem[] = []
    const itemRe = /<item>([\s\S]*?)<\/item>/g
    let m: RegExpExecArray | null
    while ((m = itemRe.exec(text)) !== null && items.length < 15) {
      const block = m[1]
      const rawTitle = (/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/.exec(block)?.[1] ||
                       /<title>([\s\S]*?)<\/title>/.exec(block)?.[1] || '').trim()
      const title = rawTitle.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/<[^>]+>/g, '').trim()
      const link  = (/<link>(.*?)<\/link>/.exec(block)?.[1] ||
                     /<guid>(.*?)<\/guid>/.exec(block)?.[1] || '').trim()
      const pubDate = (/<pubDate>(.*?)<\/pubDate>/.exec(block)?.[1] || '').trim()
      const cdataDesc = /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/.exec(block)?.[1] || ''
      const plainDesc = /<description>([\s\S]*?)<\/description>/.exec(block)?.[1] || ''
      const desc  = (cdataDesc || plainDesc).replace(/<[^>]+>/g, '').trim()
      if (title && link) {
        items.push({
          title,
          url: link,
          source: feed.name,
          publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          summary: desc.slice(0, 200),
        })
      }
    }
    return items
  } catch {
    return []
  }
}

export async function GET() {
  const key    = 'india_news'
  const cached = getCache(key)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })

  try {
    const batches = await Promise.allSettled(INDIA_NEWS_FEEDS.map(fetchFeed))
    const all: NewsItem[] = []
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
    const articles = all.slice(0, 40)

    const result = { articles, total: articles.length, fetchedAt: Date.now() }
    setCache(key, result, 300)
    return NextResponse.json({ data: result, source: 'live' })
  } catch (err) {
    const fallback = getCache(key)
    if (fallback) return NextResponse.json({ data: fallback.data, source: 'stale' })
    return NextResponse.json({ error: String(err), data: { articles: [], total: 0, fetchedAt: Date.now() }, source: 'empty' })
  }
}
