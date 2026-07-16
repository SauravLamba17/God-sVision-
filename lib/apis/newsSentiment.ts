import { createHash } from 'crypto'
import { geminiGenerate } from '@/lib/gemini'

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

export async function scoreHeadlines(headlines: string[]): Promise<HeadlineSentiment[]> {
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()

  const results: HeadlineSentiment[] = []
  const toScore: string[] = []
  const hashMap: Map<string, string> = new Map()

  // Check DB cache first
  for (const h of headlines) {
    const hash = sha256(h)
    hashMap.set(h, hash)
    try {
      const cached = await prisma.headlineSentiment.findUnique({ where: { hash } })
      if (cached) {
        results.push({ hash, headline: h, sentiment: cached.sentiment as SentimentLabel, confidence: cached.confidence, reason: cached.reason })
      } else {
        toScore.push(h)
      }
    } catch { toScore.push(h) }
  }

  // Score uncached headlines in batches via Gemini
  if (toScore.length > 0 && process.env.GEMINI_API_KEY) {
    try {
      const BATCH_SIZE = 20
      for (let i = 0; i < toScore.length; i += BATCH_SIZE) {
        const batch = toScore.slice(i, i + BATCH_SIZE)
        const prompt = `You are a financial news sentiment analyzer. For each headline below, output a JSON array with objects: {"headline": "...", "sentiment": "BULLISH"|"BEARISH"|"NEUTRAL", "confidence": 0.0-1.0, "reason": "one short phrase"}.

Analyze ONLY the financial/market implication. "Rate cut" = BULLISH. "Layoffs" = can be BEARISH for that company. "Record earnings" = BULLISH. "Recession fears" = BEARISH.

Headlines:
${batch.map((h, j) => `${j + 1}. ${h}`).join('\n')}

Respond ONLY with a valid JSON array. No markdown, no explanation.`

        const content = await geminiGenerate(prompt)
        const jsonMatch = /\[[\s\S]*\]/.exec(content)
        if (jsonMatch) {
          const scored = JSON.parse(jsonMatch[0]) as Array<{ headline: string; sentiment: string; confidence: number; reason: string }>
          for (const s of scored) {
            const hash = sha256(s.headline)
            const record: HeadlineSentiment = {
              hash,
              headline: s.headline,
              sentiment: s.sentiment as SentimentLabel,
              confidence: s.confidence ?? 0.7,
              reason: s.reason ?? '',
            }
            results.push(record)
            try {
              await prisma.headlineSentiment.upsert({
                where: { hash },
                update: { sentiment: record.sentiment, confidence: record.confidence, reason: record.reason },
                create: { hash, headline: s.headline, sentiment: record.sentiment, confidence: record.confidence, reason: record.reason },
              })
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error('Gemini batch scoring error:', err)
    }
  }

  // Fallback: simple keyword scoring for uncached
  const scored = results.map(r => r.headline)
  for (const h of toScore) {
    if (!scored.includes(h)) {
      results.push(fallbackScore(h, hashMap.get(h) ?? sha256(h)))
    }
  }

  await prisma.$disconnect()
  return results
}

function fallbackScore(headline: string, hash: string): HeadlineSentiment {
  const lower = headline.toLowerCase()
  const bullishTerms = ['surge','rally','gain','rise','record','beat','profit','growth','bullish','upgrade','buy','strong','recovery']
  const bearishTerms = ['fall','drop','crash','loss','miss','decline','fear','recession','inflation','downgrade','sell','weak','layoff']
  const bulls = bullishTerms.filter(t => lower.includes(t)).length
  const bears = bearishTerms.filter(t => lower.includes(t)).length
  const sentiment: SentimentLabel = bulls > bears ? 'BULLISH' : bears > bulls ? 'BEARISH' : 'NEUTRAL'
  return { hash, headline, sentiment, confidence: 0.5, reason: 'keyword scoring' }
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
