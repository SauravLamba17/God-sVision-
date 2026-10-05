import { createHash } from 'crypto'

export type SentimentLabel = 'BULLISH' | 'BEARISH' | 'NEUTRAL'

export interface HeadlineSentiment {
  hash: string
  headline: string
  sentiment: SentimentLabel
  confidence: number
  reason: string
}

export interface MarketMood {
  bullish: number
  bearish: number
  neutral: number
  dominantSentiment: SentimentLabel
  score: number // -100 to +100
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 32)
}

// Keyword method — an ESTIMATE (callers label it so). Gemini scoring used to
// run here on every 5-minute news poll and could use up the shared daily AI
// quota before anyone clicked an AI button; this is free, instant and makes no
// DB or network calls. Whole-word matching, so "again" isn't "gain" and
// "enterprise" isn't "rise". Known limit: no negation handling ("not a rally").
const BULLISH_RE = /\b(surge|rally|rallie|gain|rise|rose|rising|record high|beat|profit|growth|bullish|upgrade|strong|recovery|rebound|jump|soar)(s|d|ed|es|ing)?\b/gi
const BEARISH_RE = /\b(fall|fell|drop|crash|loss|losse|miss|decline|fear|recession|inflation|downgrade|weak|layoff|slump|plunge|tumble|selloff|sell-off|record low)(s|d|ed|es|ing)?\b/gi

export function scoreHeadlines(headlines: string[]): HeadlineSentiment[] {
  return headlines.map(h => keywordScore(h))
}

function keywordScore(headline: string): HeadlineSentiment {
  const bulls = headline.match(BULLISH_RE)?.length ?? 0
  const bears = headline.match(BEARISH_RE)?.length ?? 0
  const sentiment: SentimentLabel = bulls > bears ? 'BULLISH' : bears > bulls ? 'BEARISH' : 'NEUTRAL'
  return { hash: sha256(headline), headline, sentiment, confidence: 0.5, reason: 'keyword estimate' }
}

export function computeMarketMood(sentiments: HeadlineSentiment[]): MarketMood {
  const bullish = sentiments.filter(s => s.sentiment === 'BULLISH').length
  const bearish = sentiments.filter(s => s.sentiment === 'BEARISH').length
  const neutral = sentiments.filter(s => s.sentiment === 'NEUTRAL').length
  const total = sentiments.length || 1
  const score = Math.round(((bullish - bearish) / total) * 100)
  const dominantSentiment: SentimentLabel = score > 10 ? 'BULLISH' : score < -10 ? 'BEARISH' : 'NEUTRAL'
  return {
    bullish: Math.round((bullish / total) * 100),
    bearish: Math.round((bearish / total) * 100),
    neutral: Math.round((neutral / total) * 100),
    dominantSentiment,
    score,
  }
}
