import { getCache, setCache } from '@/lib/cache'
import { geminiGenerate } from '@/lib/gemini'

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

  // Always fetch live headlines — used for headlinesAnalyzed count even in fallback
  let headlines: string[] = []
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3001'
    const res = await fetch(`${baseUrl}/api/news`, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const j = await res.json()
      headlines = (j.data ?? []).slice(0, 100).map((n: any) => n.title as string)
    }
  } catch {}

  if (headlines.length < 5) {
    headlines = [
      'Federal Reserve signals potential rate cut timeline uncertainty',
      'AI chip demand continues to drive semiconductor sector gains',
      'China economic data disappoints, emerging market concerns rise',
      'Oil prices volatile amid geopolitical tensions',
      'US Treasury yields rise as inflation data remains sticky',
      ...headlines,
    ]
  }

  if (!keyValid) {
    const fallback: NarrativeData = {
      narratives: [
        { title: 'FED POLICY PIVOT', description: 'Markets pricing in rate cuts as inflation cools toward target', sentiment: 'BULLISH', intensity: 'HIGH', relatedTickers: ['TLT', 'QQQ', 'GLD'], headlineCount: 18 },
        { title: 'AI CAPEX SUPERCYCLE', description: 'Mega-cap tech spending on AI infrastructure accelerating', sentiment: 'BULLISH', intensity: 'HIGH', relatedTickers: ['NVDA', 'MSFT', 'GOOGL'], headlineCount: 24 },
        { title: 'CHINA SLOWDOWN', description: 'Property sector stress weighing on global growth outlook', sentiment: 'BEARISH', intensity: 'MEDIUM', relatedTickers: ['FXI', 'EEM', 'CLF'], headlineCount: 11 },
        { title: 'DOLLAR STRENGTH', description: 'DXY rising on resilient US economy vs global peers', sentiment: 'NEUTRAL', intensity: 'MEDIUM', relatedTickers: ['UUP', 'GLD', 'EEM'], headlineCount: 9 },
        { title: 'ENERGY TRANSITION', description: 'Renewables investment outpacing fossil fuel capex globally', sentiment: 'BULLISH', intensity: 'LOW', relatedTickers: ['ICLN', 'ENPH', 'XOM'], headlineCount: 7 },
      ],
      generatedAt: Date.now(),
      headlinesAnalyzed: headlines.length,
      keyConfigured: false,
    }
    await setCache(cacheKey, fallback, 900)
    return fallback
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
