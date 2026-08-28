import { NextRequest, NextResponse } from 'next/server';
import { geminiGenerate } from '@/lib/gemini';

// Up to 10 Gemini calls in parallel.
export const maxDuration = 30

const cache = new Map<string, string>();

export async function POST(req: NextRequest) {
  try {
    const { headlines } = await req.json();
    if (!headlines || !Array.isArray(headlines)) {
      return NextResponse.json({ results: [] });
    }

    const results = await Promise.all(
      headlines.slice(0, 10).map(async (headline: string) => {
        const cacheKey = headline.slice(0, 50);
        if (cache.has(cacheKey)) {
          return { headline, sentiment: cache.get(cacheKey) };
        }

        if (!process.env.GEMINI_API_KEY) {
          return { headline, sentiment: 'NEUTRAL' };
        }

        try {
          const result = await geminiGenerate(
            `Rate this financial news headline's market sentiment. Reply with ONLY one word: BULLISH, BEARISH, or NEUTRAL.\n\nHeadline: "${headline}"`
          );
          const sentiment = result.trim().toUpperCase();
          const valid = ['BULLISH', 'BEARISH', 'NEUTRAL'].includes(sentiment)
            ? sentiment : 'NEUTRAL';
          cache.set(cacheKey, valid);
          return { headline, sentiment: valid };
        } catch {
          return { headline, sentiment: 'NEUTRAL' };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ results: [], error: e.message });
  }
}
