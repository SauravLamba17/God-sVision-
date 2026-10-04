import { NextRequest, NextResponse } from 'next/server';
import { geminiGenerate } from '@/lib/gemini';
import { getQuotes } from '@/lib/apis/yahoo';
import { cachedAI } from '@/lib/aiCache';

// One brief per mode per day, cached globally in Postgres (lib/aiCache) —
// 2 Gemini calls/day total. The old 1h in-process Map re-spent quota on every
// cold instance and every hour.
export const maxDuration = 30
const TTL_SECONDS = 24 * 3600

// The brief is grounded in these live quotes. Without them the model invents
// index levels (it once wrote "S&P holding 4,500" with SPY at 769), so no
// quotes means no brief.
const TICKERS: Record<string, [string, string][]> = {
  USA: [['^GSPC', 'S&P 500'], ['^IXIC', 'NASDAQ Composite'], ['^DJI', 'Dow Jones'], ['^VIX', 'VIX'],
        ['^TNX', 'US 10Y yield (%)'], ['CL=F', 'WTI crude'], ['GC=F', 'Gold'], ['BTC-USD', 'Bitcoin']],
  INDIA: [['^NSEI', 'Nifty 50'], ['^BSESN', 'Sensex'], ['^NSEBANK', 'Bank Nifty'], ['^INDIAVIX', 'India VIX'],
          ['INR=X', 'USD/INR'], ['CL=F', 'WTI crude'], ['GC=F', 'Gold']],
};

export async function GET(req: NextRequest) {
  try {
    const mode = req.nextUrl.searchParams.get('mode') === 'INDIA' ? 'INDIA' : 'USA';

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        brief: 'AI brief requires GEMINI_API_KEY. Add it to .env.local to enable daily market briefs.',
        cached: false,
      });
    }

    const result = await cachedAI(`ai:brief:${mode}`, TTL_SECONDS, async () => {
      const labels = new Map(TICKERS[mode]);
      const quotes = (await getQuotes([...labels.keys()]))
        .filter(q => typeof q?.regularMarketPrice === 'number');
      if (quotes.length === 0) {
        throw new Error('Live quotes unavailable — brief not generated rather than guessing levels.');
      }
      const snapshot = quotes.map(q =>
        `${labels.get(q.symbol) ?? q.symbol}: ${q.regularMarketPrice.toFixed(2)} (${q.regularMarketChangePercent >= 0 ? '+' : ''}${q.regularMarketChangePercent.toFixed(2)}% vs previous close)`
      ).join('\n');

      const isIndia = mode === 'INDIA';
      const prompt = `You are a senior market analyst. Write a concise market brief for ${new Date().toDateString()}.

${isIndia ? 'Focus on Indian markets.' : 'Focus on US markets.'}

Latest quotes (the ONLY market data you have):
${snapshot}

Rules: quote levels and percentages ONLY from the data above, never from memory. Do not claim specific news, earnings, data releases or events — you have none. Plain text, no markdown.

Cover:
1. Overall sentiment implied by the moves above
2. Top 3 things to watch
3. Key risk factors
4. One opportunity to research

Keep it under 150 words.`;

      return geminiGenerate(prompt, undefined, 'scheduled');
    });
    if (!result) {
      return NextResponse.json({ error: 'Market brief temporarily unavailable. Check back shortly.' });
    }
    // stale: quota spent / upstream down — the last good brief, with its own timestamp.
    return NextResponse.json({ brief: result.data, generatedAt: result.generatedAt, stale: result.stale });
  } catch (e: any) {
    return NextResponse.json({
      error: 'Market brief temporarily unavailable. Check back shortly.',
    }, { status: 200 });
  }
}
