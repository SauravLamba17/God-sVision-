import { NextRequest, NextResponse } from 'next/server';
import { geminiGenerate } from '@/lib/gemini';

// Single Gemini generate behind a 1h in-process cache.
export const maxDuration = 30

const cache = new Map<string, { data: string; ts: number }>();
const TTL = 60 * 60 * 1000; // 1 hour

export async function GET(req: NextRequest) {
  try {
    const mode = req.nextUrl.searchParams.get('mode') ?? 'USA';
    const cacheKey = `brief_${mode}_${new Date().toDateString()}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL) {
      return NextResponse.json({ brief: cached.data, cached: true });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        brief: 'AI brief requires GEMINI_API_KEY. Add it to .env.local to enable daily market briefs.',
        cached: false,
      });
    }

    const isIndia = mode === 'INDIA';
    const prompt = `You are a senior market analyst. Write a concise morning market brief for ${new Date().toDateString()}.

${isIndia ? 'Focus on Indian markets: Nifty 50, Sensex, RBI policy, Indian economy, FII/DII flows, major Nifty stocks.' : 'Focus on US markets: S&P 500, NASDAQ, Fed policy, major US stocks, economic data.'}

Cover:
1. Overall market sentiment and key overnight developments
2. Top 3 things to watch today
3. Key risk factors
4. One specific opportunity

Keep it under 150 words. Be specific with levels and percentages. Write in present tense.`;

    const brief = await geminiGenerate(prompt);
    cache.set(cacheKey, { data: brief, ts: Date.now() });
    return NextResponse.json({ brief, cached: false });
  } catch (e: any) {
    return NextResponse.json({
      brief: 'Market brief temporarily unavailable. Check back shortly.',
      error: e.message,
    }, { status: 200 });
  }
}
