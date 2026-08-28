import { NextRequest, NextResponse } from 'next/server';
import { geminiFlash } from '@/lib/gemini';

// Streams Gemini output; cap a hung stream well under the 300s platform default.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    if (!geminiFlash) {
      return NextResponse.json(
        { error: 'AI not configured. Add GEMINI_API_KEY to .env.local' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { ticker, context, mode, data } = body;

    const systemPrompt = `You are GOD's Vision Analyst — a senior quantitative analyst with 20 years of experience at top hedge funds. You specialize in ${mode === 'INDIA' ? 'Indian equity markets (NSE/BSE), Nifty options, RBI policy' : 'US equity markets, Fed policy, S&P 500'}.

Give specific, actionable analysis. Always include:
- Current price assessment (cheap/fair/expensive)
- Key support and resistance levels
- Short-term bias (bullish/bearish/neutral) with reasoning
- Risk factors to watch
- One specific trade idea with entry, target, and stop loss

Be direct and specific. No vague statements. Use ${mode === 'INDIA' ? 'INR (₹)' : 'USD ($)'} for all prices.`;

    const userPrompt = `Analyze ${ticker} and provide a complete trading assessment.
${data ? `Current data: ${JSON.stringify(data)}` : ''}
${context ? `Additional context: ${context}` : ''}

Format your response in clear sections:
ASSESSMENT | LEVELS | BIAS | TRADE IDEA | RISKS`;

    const flash = geminiFlash;
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
          const result = await flash.generateContentStream(fullPrompt);
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (e: any) {
          controller.enqueue(encoder.encode(`\n\nError: ${e.message}`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
