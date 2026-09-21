import { getCache, setCache } from '@/lib/cache'

export interface RedditPost {
  title: string
  selftext: string
  score: number
  num_comments: number
  created_utc: number
  url: string
  subreddit: string
  upvote_ratio: number
}

export interface TickerMention {
  ticker: string
  mentions: number
  avgScore: number
  sentiment: 'BULLISH' | 'BEARISH' | 'MIXED'
  topPost: RedditPost
  posts: RedditPost[]
  subreddits: string[]
}

const TICKER_REGEX = /\$([A-Z]{1,5})\b/g
const KNOWN_TICKERS = new Set([
  'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','JPM','V','MA',
  'BRK','BAC','WFC','GS','AMD','INTC','QCOM','ORCL','CRM','ADBE',
  'NFLX','UBER','LYFT','SNAP','PINS','RBLX','COIN','HOOD','PLTR',
  'SNOW','NET','CRWD','PANW','DDOG','ZS','OKTA','MDB','TWLO',
  'SHOP','SQ','PYPL','SOFI','AFRM','UPST',
  'SPY','QQQ','IWM','DIA','GLD','SLV','USO','TLT','VXX',
  'BTC','ETH','SOL','DOGE','XRP','ADA','MATIC',
  'GME','AMC','BB','BBBY','KOSS',
  'F','GM','RIVN','LCID','NIO',
  'DIS','PARA','WBD','NFLX',
  'XOM','CVX','COP','BP','OXY',
  'PFE','MRNA','JNJ','ABT','LLY',
  'JPM','C','BAC','WFC','GS','MS',
])

// MOCK_MENTIONS lived here: ten fabricated TickerMention rows with invented
// quotes ("NVDA calls printing — Jensen is a god", "GME squeezing again — DFV
// was right") and invented mention counts. getTickerMentions() returned them
// whenever the live fetch yielded nothing, and Reddit now answers 403 to
// unauthenticated clients, so that branch was the one actually serving
// production. Callers get an empty array instead and say so in the UI.
//
// To restore real data: Reddit requires an OAuth script app
// (client id + secret -> https://oauth.reddit.com), which no env var here
// currently provides.

const BULLISH_WORDS = ['buy','bought','calls','moon','bull','bullish','long','gains','pump','breakout','squeeze','rocket','🚀','💎','🙌','ath']
const BEARISH_WORDS = ['sell','sold','puts','bear','bearish','short','dump','crash','collapse','rekt','bag','falling','correction']

function computeSentiment(posts: RedditPost[]): 'BULLISH' | 'BEARISH' | 'MIXED' {
  let bullCount = 0, bearCount = 0
  for (const p of posts) {
    const text = (p.title + ' ' + p.selftext).toLowerCase()
    const bulls = BULLISH_WORDS.filter(w => text.includes(w)).length
    const bears = BEARISH_WORDS.filter(w => text.includes(w)).length
    if (bulls > bears) bullCount++
    else if (bears > bulls) bearCount++
  }
  if (bullCount > bearCount * 1.5) return 'BULLISH'
  if (bearCount > bullCount * 1.5) return 'BEARISH'
  return 'MIXED'
}

function extractTickers(text: string): string[] {
  const found: string[] = []
  const matches = text.matchAll(TICKER_REGEX)
  for (const m of matches) {
    if (KNOWN_TICKERS.has(m[1])) found.push(m[1])
  }
  // Also scan for bare known tickers (no $)
  for (const ticker of KNOWN_TICKERS) {
    const re = new RegExp(`\\b${ticker}\\b`, 'g')
    if (re.test(text)) found.push(ticker)
  }
  return [...new Set(found)]
}

async function fetchSubreddit(sub: string, limit: number): Promise<RedditPost[]> {
  try {
    const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=${limit}`, {
      headers: { 'User-Agent': 'GodVision/1.0 financial-terminal' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const j = await res.json()
    return (j?.data?.children || []).map((c: any) => ({
      title: c.data.title,
      selftext: c.data.selftext?.slice(0, 500) || '',
      score: c.data.score,
      num_comments: c.data.num_comments,
      created_utc: c.data.created_utc,
      url: `https://reddit.com${c.data.permalink}`,
      subreddit: c.data.subreddit,
      upvote_ratio: c.data.upvote_ratio,
    }))
  } catch {
    return []
  }
}

export async function fetchRedditPosts(): Promise<RedditPost[]> {
  const cacheKey = 'reddit_posts_all'
  const cached = await getCache(cacheKey)
  if (cached && !cached.stale) return cached.data as RedditPost[]

  const results = await Promise.allSettled([
    fetchSubreddit('wallstreetbets', 100),
    fetchSubreddit('investing', 50),
    fetchSubreddit('stocks', 50),
    fetchSubreddit('CryptoCurrency', 50),
    fetchSubreddit('Economics', 25),
  ])

  const allPosts: RedditPost[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') allPosts.push(...r.value)
  }

  if (allPosts.length === 0) {
    await setCache(cacheKey, [], 300) // short cache so we retry soon
    return []
  }

  await setCache(cacheKey, allPosts, 900) // 15 min cache
  return allPosts
}

export async function getTickerMentions(): Promise<TickerMention[]> {
  const cacheKey = 'reddit_ticker_mentions'
  const cached = await getCache(cacheKey)
  if (cached && !cached.stale) return cached.data as TickerMention[]

  const posts = await fetchRedditPosts()
  const tickerMap: Map<string, RedditPost[]> = new Map()

  for (const post of posts) {
    const tickers = extractTickers(post.title + ' ' + post.selftext)
    for (const t of tickers) {
      if (!tickerMap.has(t)) tickerMap.set(t, [])
      tickerMap.get(t)!.push(post)
    }
  }

  const mentions: TickerMention[] = []
  for (const [ticker, tickerPosts] of tickerMap) {
    if (tickerPosts.length < 2) continue
    const avgScore = tickerPosts.reduce((s, p) => s + p.score, 0) / tickerPosts.length
    const topPost = tickerPosts.sort((a, b) => b.score - a.score)[0]
    mentions.push({
      ticker,
      mentions: tickerPosts.length,
      avgScore: Math.round(avgScore),
      sentiment: computeSentiment(tickerPosts),
      topPost,
      posts: tickerPosts.slice(0, 5),
      subreddits: [...new Set(tickerPosts.map(p => p.subreddit))],
    })
  }

  if (mentions.length === 0) {
    // Short cache so a recovered upstream is picked up quickly.
    await setCache(cacheKey, [], 300)
    return []
  }

  const result = mentions.sort((a, b) => b.mentions - a.mentions).slice(0, 30)
  await setCache(cacheKey, result, 900)
  return result
}

export async function getTickerSentiment(ticker: string): Promise<TickerMention | null> {
  const all = await getTickerMentions()
  return all.find(m => m.ticker === ticker.toUpperCase()) || null
}
