import { getCache } from '@/lib/cache'
import { cachedAI } from '@/lib/aiCache'
import { geminiGenerate } from '@/lib/gemini'
import { fetchRSSFeeds } from '@/lib/apis/news'

export interface Narrative {
  title: string
  description: string
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  intensity: 'HIGH' | 'MEDIUM' | 'LOW'
  relatedTickers: string[]
  headlineCount: number
}

export interface NarrativeData {
  narratives: Narrative[]
  generatedAt: number
  headlinesAnalyzed: number
  keyConfigured: boolean
  stale?: boolean // last good result served because Gemini is unavailable / out of quota
}

// Narratives are global, cached in Postgres for 8h → 3 Gemini calls/day.
const TTL_SECONDS = 8 * 3600

export async function detectNarratives(): Promise<NarrativeData> {
  if (!process.env.GEMINI_API_KEY) {
    return { narratives: [], generatedAt: Date.now(), headlinesAnalyzed: 0, keyConfigured: false }
  }

  let headlinesAnalyzed = 0
  const result = await cachedAI<{ narratives: Narrative[]; headlinesAnalyzed: number }>('ai:narratives', TTL_SECONDS, async () => {
    // Live headlines only. This used to HTTP-fetch our own /api/news, which the
    // auth middleware rejected (no session on a server-to-server call), and
    // five hardcoded "headlines" were substituted. Read the news cache, or the
    // feeds directly, instead.
    const newsCache = await getCache<{ items: { title: string }[] }>('news_all')
    const items = newsCache?.data?.items ?? await fetchRSSFeeds().catch(() => [])
    const headlines = items.slice(0, 100).map(n => n.title).filter(Boolean)
    headlinesAnalyzed = headlines.length
    // Never invent narratives or headlines.
    if (headlines.length < 5) throw new Error(`only ${headlines.length} live headlines`)

    const prompt = `You are a macro market analyst. Analyze these ${headlines.length} financial news headlines and identify the TOP 5 dominant market narratives driving investor attention.

Headlines:
${headlines.slice(0, 80).map((h, i) => `${i + 1}. ${h}`).join('\n')}

Return a JSON array of exactly 5 narratives:
[
  {
    "title": "SHORT CAPS NAME (2-4 words)",
    "description": "One sentence explaining the narrative and market implication",
    "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
    "intensity": "HIGH" | "MEDIUM" | "LOW",
    "relatedTickers": ["TICK1", "TICK2", "TICK3"],
    "headlineCount": <number of headlines related>
  }
]

Order by importance/prevalence. Use ALL CAPS for titles. Respond ONLY with valid JSON array.`

    const text = await geminiGenerate(prompt, undefined, 'scheduled')
    const jsonMatch = /\[[\s\S]*\]/.exec(text)
    if (!jsonMatch) throw new Error('Gemini returned no JSON array')
    return { narratives: (JSON.parse(jsonMatch[0]) as Narrative[]).slice(0, 5), headlinesAnalyzed: headlines.length }
  })

  if (!result) return { narratives: [], generatedAt: Date.now(), headlinesAnalyzed, keyConfigured: true }
  return { ...result.data, generatedAt: result.generatedAt, keyConfigured: true, stale: result.stale }
}
