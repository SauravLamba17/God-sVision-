import { getCache, setCache } from '@/lib/cache'
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
}

export async function detectNarratives(): Promise<NarrativeData> {
  const cacheKey = 'ai_narratives'
  const cached = await getCache(cacheKey)
  if (cached && !cached.stale) return cached.data as NarrativeData

  const keyValid = !!process.env.GEMINI_API_KEY

  // Live headlines only. This used to HTTP-fetch our own /api/news, which the
  // auth middleware redirects to the sign-in page (no session cookie on a
  // server-to-server call); the JSON parse then failed and five hardcoded
  // "headlines" were substituted, so the panel showed AI analysis of invented
  // news. Read the news cache, or the feeds directly, instead.
  const newsCache = await getCache<{ items: { title: string }[] }>('news_all')
  const items = newsCache?.data?.items ?? await fetchRSSFeeds().catch(() => [])
  const headlines = items.slice(0, 100).map(n => n.title).filter(Boolean)

  if (!keyValid || headlines.length < 5) {
    // Honest empty state — never invented narratives or headlines.
    return { narratives: [], generatedAt: Date.now(), headlinesAnalyzed: headlines.length, keyConfigured: keyValid }
  }

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

  try {
    const text = await geminiGenerate(prompt)
    const jsonMatch = /\[[\s\S]*\]/.exec(text)
    if (jsonMatch) {
      const narratives = JSON.parse(jsonMatch[0]) as Narrative[]
      const result: NarrativeData = { narratives: narratives.slice(0, 5), generatedAt: Date.now(), headlinesAnalyzed: headlines.length, keyConfigured: true }
      await setCache(cacheKey, result, 900)
      return result
    }
  } catch (err) {
    console.error('Narrative detection error:', err)
  }

  const empty: NarrativeData = { narratives: [], generatedAt: Date.now(), headlinesAnalyzed: headlines.length, keyConfigured: true }
  await setCache(cacheKey, empty, 300)
  return empty
}
