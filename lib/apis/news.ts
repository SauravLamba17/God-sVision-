import axios from 'axios'
import Parser from 'rss-parser'

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
})

interface Feed {
  name: string
  url: string
  category: string
  ttl: number  // per-feed cache TTL in seconds
  limit?: number
}

const RSS_FEEDS: Feed[] = [
  // ── GOOGLE NEWS — aggregates hundreds of sources, updates every ~1 min ──
  { name: 'Google News', url: 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en', category: 'All', ttl: 60, limit: 25 },
  { name: 'Google Business', url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en', category: 'Business', ttl: 60, limit: 20 },
  { name: 'Google Technology', url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-US&gl=US&ceid=US:en', category: 'Tech', ttl: 60, limit: 20 },
  { name: 'Google World', url: 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en', category: 'World', ttl: 60, limit: 20 },
  { name: 'Google Science', url: 'https://news.google.com/rss/headlines/section/topic/SCIENCE?hl=en-US&gl=US&ceid=US:en', category: 'Science', ttl: 90, limit: 15 },
  { name: 'Google Health', url: 'https://news.google.com/rss/headlines/section/topic/HEALTH?hl=en-US&gl=US&ceid=US:en', category: 'Health', ttl: 90, limit: 15 },
  { name: 'Google Sports', url: 'https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en-US&gl=US&ceid=US:en', category: 'Sports', ttl: 90, limit: 15 },
  { name: 'Google India', url: 'https://news.google.com/rss/headlines/section/geo/India?hl=en-IN&gl=IN&ceid=IN:en', category: 'India', ttl: 60, limit: 20 },
  { name: 'Google Politics', url: 'https://news.google.com/rss/headlines/section/topic/NATION?hl=en-US&gl=US&ceid=US:en', category: 'Politics', ttl: 60, limit: 15 },

  // ── BBC ──
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'World', ttl: 120, limit: 15 },
  { name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', category: 'Business', ttl: 120, limit: 12 },
  { name: 'BBC Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', category: 'Tech', ttl: 120, limit: 12 },
  { name: 'BBC Health', url: 'https://feeds.bbci.co.uk/news/health/rss.xml', category: 'Health', ttl: 180, limit: 10 },
  { name: 'BBC Science', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', category: 'Science', ttl: 180, limit: 10 },
  { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml', category: 'Sports', ttl: 120, limit: 10 },

  // ── GLOBAL NETWORKS ──
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'World', ttl: 120, limit: 15 },
  { name: 'The Guardian World', url: 'https://www.theguardian.com/world/rss', category: 'World', ttl: 120, limit: 12 },
  { name: 'The Guardian Business', url: 'https://www.theguardian.com/business/rss', category: 'Business', ttl: 120, limit: 10 },
  { name: 'The Guardian Tech', url: 'https://www.theguardian.com/technology/rss', category: 'Tech', ttl: 120, limit: 10 },
  { name: 'The Guardian Science', url: 'https://www.theguardian.com/science/rss', category: 'Science', ttl: 180, limit: 8 },
  { name: 'The Guardian Politics', url: 'https://www.theguardian.com/politics/rss', category: 'Politics', ttl: 120, limit: 10 },
  { name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml', category: 'World', ttl: 120, limit: 10 },
  { name: 'NPR Politics', url: 'https://feeds.npr.org/1014/rss.xml', category: 'Politics', ttl: 90, limit: 10 },
  { name: 'DW World', url: 'https://rss.dw.com/rdf/rss-en-world', category: 'World', ttl: 150, limit: 10 },
  { name: 'France 24', url: 'https://www.france24.com/en/rss', category: 'World', ttl: 150, limit: 10 },

  // ── FINANCIAL ──
  { name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', category: 'Business', ttl: 90, limit: 15 },
  { name: 'MarketWatch', url: 'https://feeds.marketwatch.com/marketwatch/topstories/', category: 'Business', ttl: 90, limit: 12 },
  { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex', category: 'Business', ttl: 90, limit: 15 },
  { name: 'Seeking Alpha', url: 'https://seekingalpha.com/market_currents.xml', category: 'Business', ttl: 120, limit: 10 },
  // Removed: Reuters Business/Energy (feeds.reuters.com no longer resolves),
  // Forbes + Investopedia + Medical News Today (all HTTP 404).

  // ── ENERGY ──
  { name: 'OilPrice.com', url: 'https://oilprice.com/rss/main', category: 'Energy', ttl: 120, limit: 12 },

  // ── TECH ──
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'Tech', ttl: 90, limit: 15 },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'Tech', ttl: 90, limit: 15 },
  { name: 'Wired', url: 'https://www.wired.com/feed/rss', category: 'Tech', ttl: 120, limit: 12 },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'Tech', ttl: 90, limit: 12 },
  { name: 'VentureBeat', url: 'https://venturebeat.com/feed/', category: 'Tech', ttl: 120, limit: 10 },

  // ── SCIENCE ──
  { name: 'NASA', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', category: 'Science', ttl: 300, limit: 8 },
  { name: 'ScienceDaily', url: 'https://www.sciencedaily.com/rss/all.xml', category: 'Science', ttl: 300, limit: 10 },
  { name: 'PhysOrg', url: 'https://phys.org/rss-feed/', category: 'Science', ttl: 300, limit: 10 },

  // ── HEALTH ──
  // WHO publishes rarely (last item was ~6 months old at time of writing) but the
  // feed is live — the recency filter drops its stale items automatically, so it
  // stays here to catch genuine WHO announcements when they happen.
  { name: 'WHO', url: 'https://www.who.int/rss-feeds/news-english.xml', category: 'Health', ttl: 300, limit: 8 },

  // ── POLITICS ──
  // Removed: Engadget + Politico — both return HTTP 403 to this User-Agent, so
  // they contributed nothing. Recoverable by changing the parser's User-Agent.
  { name: 'The Hill', url: 'https://thehill.com/rss/syndicator/19110', category: 'Politics', ttl: 90, limit: 12 },

  // ── INDIA ──
  { name: 'NDTV', url: 'https://feeds.feedburner.com/NDTV-LatestNews', category: 'India', ttl: 90, limit: 15 },
  { name: 'Times of India', url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms', category: 'India', ttl: 90, limit: 15 },
  { name: 'The Hindu', url: 'https://www.thehindu.com/news/feeder/default.rss', category: 'India', ttl: 90, limit: 12 },
  { name: 'Economic Times', url: 'https://economictimes.indiatimes.com/rssfeedstopstories.cms', category: 'India', ttl: 90, limit: 12 },
  { name: 'LiveMint', url: 'https://www.livemint.com/rss/news', category: 'India', ttl: 120, limit: 10 },
  { name: 'HindustanTimes', url: 'https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml', category: 'India', ttl: 120, limit: 10 },
]

export interface NewsItem {
  id: string
  title: string
  description: string
  url: string
  source: string
  category: string
  publishedAt: string
  sentiment: 'positive' | 'negative' | 'neutral'
}

// ── Per-feed in-memory cache ──────────────────────────────────
const feedCache = new Map<string, { data: NewsItem[]; expiresAt: number }>()

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseGoogleTitle(raw: string): { title: string; source: string | null } {
  // Google News titles: "Article Title - Publisher Name"
  const lastDash = raw.lastIndexOf(' - ')
  if (lastDash > 20) {
    return { title: raw.slice(0, lastDash).trim(), source: raw.slice(lastDash + 3).trim() }
  }
  return { title: raw, source: null }
}

function detectSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lower = text.toLowerCase()
  const pos = ['surge', 'gain', 'rise', 'rally', 'soar', 'jump', 'record', 'growth', 'profit', 'beat', 'strong', 'bullish', 'boom', 'advance', 'recovery', 'breakthrough', 'achieve', 'launch', 'win', 'success', 'milestone', 'positive', 'upgrade', 'expand']
  const neg = ['fall', 'drop', 'crash', 'plunge', 'decline', 'loss', 'risk', 'warn', 'miss', 'weak', 'bearish', 'recession', 'inflation', 'default', 'bankrupt', 'crisis', 'war', 'attack', 'sanction', 'terror', 'threat', 'cut', 'layoff', 'downgrade', 'collapse', 'fail', 'death', 'dead', 'disaster', 'catastrophe', 'flood', 'earthquake', 'fire', 'explosion']
  const posScore = pos.filter(w => lower.includes(w)).length
  const negScore = neg.filter(w => lower.includes(w)).length
  if (posScore > negScore) return 'positive'
  if (negScore > posScore) return 'negative'
  return 'neutral'
}

async function fetchFeedCached(feed: Feed): Promise<NewsItem[]> {
  const cached = feedCache.get(feed.url)
  if (cached && Date.now() < cached.expiresAt) return cached.data

  try {
    const isGoogle = feed.name.startsWith('Google')
    const parsed = await parser.parseURL(feed.url)
    const items: NewsItem[] = (parsed.items || [])
      .slice(0, feed.limit || 15)
      .map(item => {
      const rawTitle = item.title || ''
      let title = rawTitle
      let source = feed.name

      if (isGoogle) {
        const parsed = parseGoogleTitle(rawTitle)
        title = parsed.title
        if (parsed.source) source = parsed.source
      }

      const raw = item.contentSnippet || item.content || item.summary || ''
      const description = stripHtml(raw).slice(0, 300)

      // Prefer rss-parser's normalised isoDate; fall back to the raw pubDate.
      // Never substitute "now" for a missing date — that fabricates freshness
      // and floats undated items to the top of the newest-first sort.
      const rawDate = item.isoDate || item.pubDate || ''
      const parsedDate = rawDate ? new Date(rawDate) : null
      const publishedAt = parsedDate && !isNaN(parsedDate.getTime())
        ? parsedDate.toISOString()
        : ''

      return {
        id: item.guid || item.link || (title + rawDate),
        title: title || 'Untitled',
        description,
        url: item.link || '',
        source,
        category: feed.category,
        publishedAt,
        sentiment: detectSentiment(title + ' ' + description),
      }
    })
      // Drop items we can't date — they can't be ordered or aged honestly.
      .filter(item => item.publishedAt !== '')

    feedCache.set(feed.url, { data: items, expiresAt: Date.now() + feed.ttl * 1000 })
    return items
  } catch {
    return cached?.data || []
  }
}

export async function fetchRSSFeeds(): Promise<NewsItem[]> {
  const results = await Promise.allSettled(RSS_FEEDS.map(fetchFeedCached))
  const items: NewsItem[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') items.push(...r.value)
  }
  return items
}

export async function fetchHackerNews(): Promise<NewsItem[]> {
  try {
    const { data: ids } = await axios.get('https://hacker-news.firebaseio.com/v0/topstories.json', { timeout: 6000 })
    const top = ids.slice(0, 25)
    const stories = await Promise.allSettled(
      top.map((id: number) => axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { timeout: 5000 }))
    )
    return stories
      .filter((r): r is PromiseFulfilledResult<{ data: { id: number; title: string; url: string; score: number; time: number } }> => r.status === 'fulfilled')
      .map(r => ({
        id: String(r.value.data.id),
        title: r.value.data.title || '',
        description: `Score: ${r.value.data.score} — HN Discussion`,
        url: r.value.data.url || `https://news.ycombinator.com/item?id=${r.value.data.id}`,
        source: 'HackerNews',
        category: 'Tech',
        publishedAt: new Date(r.value.data.time * 1000).toISOString(),
        sentiment: detectSentiment(r.value.data.title || ''),
      }))
  } catch {
    return []
  }
}

export async function fetchRedditPosts(): Promise<NewsItem[]> {
  const subs = [
    { name: 'worldnews', category: 'World' },
    { name: 'news', category: 'World' },
    { name: 'technology', category: 'Tech' },
    { name: 'stocks', category: 'Business' },
    { name: 'investing', category: 'Business' },
    { name: 'india', category: 'India' },
    { name: 'science', category: 'Science' },
    { name: 'politics', category: 'Politics' },
  ]
  const results = await Promise.allSettled(
    subs.map(sub => axios.get(`https://www.reddit.com/r/${sub.name}.json?limit=8`, {
      headers: { 'User-Agent': 'GodVision/2.0 news aggregator' },
      timeout: 8000,
    }))
  )

  const items: NewsItem[] = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      const posts = r.value.data?.data?.children || []
      posts.forEach((p: { data: { id: string; title: string; selftext: string; url: string; created_utc: number; score: number } }) => {
        const d = p.data
        if (!d.title) return
        items.push({
          id: `reddit_${d.id}`,
          title: d.title,
          description: d.selftext?.slice(0, 200) || `Score: ${d.score}`,
          url: d.url,
          source: `Reddit/r/${subs[i].name}`,
          category: subs[i].category,
          publishedAt: new Date(d.created_utc * 1000).toISOString(),
          sentiment: detectSentiment(d.title),
        })
      })
    }
  })
  return items
}

export async function fetchNewsAPI(category = 'business'): Promise<NewsItem[]> {
  const key = process.env.NEWS_API_KEY
  if (!key || key === 'your_newsapi_key_here') return []
  try {
    const { data } = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: { category, language: 'en', pageSize: 20, apiKey: key },
      timeout: 8000,
    })
    return (data.articles || []).map((a: { title: string; description: string; url: string; source: { name: string }; publishedAt: string }) => ({
      id: a.url,
      title: a.title || '',
      description: a.description || '',
      url: a.url,
      source: a.source?.name || 'NewsAPI',
      category: category.charAt(0).toUpperCase() + category.slice(1),
      publishedAt: a.publishedAt,
      sentiment: detectSentiment((a.title || '') + ' ' + (a.description || '')),
    }))
  } catch {
    return []
  }
}

export function getRSSFeedNames(): string[] {
  return [...new Set(RSS_FEEDS.map(f => f.name))]
}
