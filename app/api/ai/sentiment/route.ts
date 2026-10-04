import { NextRequest, NextResponse } from 'next/server';
import { geminiGenerate } from '@/lib/gemini';
import { z } from 'zod';
import { parseBody, shortText } from '@/lib/validation';
import { limiterId } from '@/lib/rateLimit';

const Body = z.object({ headlines: z.array(shortText(500)).min(1, 'headlines array required').max(50) });

// Up to 10 Gemini calls in parallel.
export const maxDuration = 30

const cache = new Map<string, string>();

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseBody(req, Body);
    if (parsed.error) return parsed.error;
    const { headlines } = parsed.data;
    const uid = await limiterId(req);

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
            `Rate this financial news headline's market sentiment. Reply with ONLY one word: BULLISH, BEARISH, or NEUTRAL.\n\nHeadline: "${headline}"`,
            undefined, 'ondemand', uid
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
