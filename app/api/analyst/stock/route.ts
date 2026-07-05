/* eslint-disable @typescript-eslint/no-explicit-any */
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'
import { buildStockSnapshot, matchNewsForTicker, generateSyntheticOptionsChain, StockSnapshot } from '@/lib/apis/analyst-data'
import { getQuoteSummary } from '@/lib/apis/yahoo'

const KEY_VALID = (k?: string) => !!k && !k.startsWith('your_') && k !== 'demo' && k.length > 20

function simpleScore(s: StockSnapshot): number {
  let score = 0
  if (s.rsi !== null && s.rsi >= 45 && s.rsi <= 65) score += 2
  if (s.sma20 !== null && s.sma50 !== null && s.price > s.sma20 && s.sma20 > s.sma50) score += 2
  if (s.supertrend.trend === 'UP') score += 2
  if (s.supertrend.trend === 'DOWN') score -= 2
  if (s.macd.histogram !== null && s.macd.histogram > 0) score += 1
  if (s.volumeRatio > 1.2) score += 1
  return score
}

function ruleBasedVerdict(s: StockSnapshot, news: { title: string }[]) {
  const score = simpleScore(s)
  const verdict = score >= 3 ? 'BUY' : score <= -2 ? 'SELL' : 'HOLD'
  const confidence = Math.min(95, Math.max(40, 55 + score * 7))
  const newsTxt = news.length ? ` Recent headline: "${news[0].title}".` : ''
  const analysis = `${s.name} (${s.ticker}) trades at ${s.price.toFixed(2)}, ${s.changePct >= 0 ? 'up' : 'down'} ${Math.abs(s.changePct).toFixed(2)}% on the session. Supertrend is ${s.supertrend.trend ?? 'undetermined'}, RSI reads ${s.rsi?.toFixed(1) ?? 'N/A'}, and MACD histogram is ${s.macd.histogram !== null && s.macd.histogram > 0 ? 'positive' : 'negative'}. Price sits ${s.price > (s.sma20 ?? 0) ? 'above' : 'below'} its 20-day average with volume running ${s.volumeRatio.toFixed(1)}x the 20-day norm.${newsTxt} Nearest support at ${s.support[0]?.toFixed(2) ?? 'N/A'}, resistance at ${s.resistance[0]?.toFixed(2) ?? 'N/A'}.`
  return { analysis, verdict, confidence }
}

const SYSTEM_PROMPT = `You are GOD's VISION ANALYST, a senior quantitative analyst. You will receive one stock's full technical snapshot and recent headlines.
Respond with ONLY valid JSON (no markdown fences): { "analysis": string (150-220 words, data-driven, terminal-style prose, no bullet points), "verdict": "BUY"|"SELL"|"HOLD", "confidence": number (0-100) }.`

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')
  const market = (req.nextUrl.searchParams.get('market') || 'IN').toUpperCase() === 'US' ? 'US' : 'IN'
  if (!ticker) return NextResponse.json({ error: 'ticker is required' }, { status: 400 })

  const cacheKey = `analyst_stock_${ticker}`
  const cached = getCache<any>(cacheKey)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })

  try {
    const snapshot = await buildStockSnapshot(ticker, true)
    if (!snapshot) {
      const fallback = getCache<any>(cacheKey)
      if (fallback) return NextResponse.json({ data: fallback.data, source: 'stale' })
      return NextResponse.json({ error: `No data available for ${ticker}` }, { status: 404 })
    }

    let news: { title: string; url: string; source: string; publishedAt: string }[] = []
    if (market === 'IN') {
      const newsCache = getCache<any>('india_news')
      const articles: any[] = newsCache?.data?.articles || []
      news = matchNewsForTicker(articles, ticker, 5)
    }

    const optionsChain = generateSyntheticOptionsChain(snapshot.price, snapshot.atr, ticker)

    let fundamentals: any = null
    try {
      fundamentals = await getQuoteSummary(ticker)
    } catch { /* best-effort only */ }

    const apiKey = process.env.ANTHROPIC_API_KEY
    let ai: { analysis: string; verdict: string; confidence: number }

    if (KEY_VALID(apiKey)) {
      try {
        const client = new Anthropic({ apiKey })
        const { candles, ...snapshotForPrompt } = snapshot
        const userPrompt = `Stock snapshot:\n${JSON.stringify(snapshotForPrompt, null, 1)}\n\nRecent headlines:\n${JSON.stringify(news.map(n => n.title), null, 1)}\n\nProduce the verdict JSON now.`
        const msg = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 800,
          temperature: 0.3,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        })
        const textBlock = msg.content.find((b: any) => b.type === 'text') as any
        const cleaned = (textBlock?.text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
        ai = JSON.parse(cleaned)
      } catch (err) {
        console.error('Stock deep-dive Claude call failed, using rule-based verdict:', err)
        ai = ruleBasedVerdict(snapshot, news)
      }
    } else {
      ai = ruleBasedVerdict(snapshot, news)
    }

    const result = { snapshot, news, optionsChain, fundamentals, ai, generatedAt: Date.now() }
    setCache(cacheKey, result, 300)
    return NextResponse.json({ data: result, source: KEY_VALID(apiKey) ? 'live' : 'mock' })
  } catch (err) {
    const fallback = getCache<any>(cacheKey)
    if (fallback) return NextResponse.json({ data: fallback.data, source: 'stale' })
    return NextResponse.json({ error: String(err) })
  }
}
