import { NextRequest, NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

const cache = new Map<string, { data: Record<string, number>; ts: number }>();
const TTL = 4 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const symbols = req.nextUrl.searchParams.get('symbols')?.split(',').filter(Boolean) ?? [];
    if (symbols.length === 0) return NextResponse.json({});

    const cacheKey = [...symbols].sort().join(',');
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL) return NextResponse.json(cached.data);

    const results: Record<string, number> = {};
    const quotes = await Promise.allSettled(
      symbols.map(s => yahooFinance.quote(s, { fields: ['regularMarketPreviousClose'] }))
    );
    quotes.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value?.regularMarketPreviousClose) {
        results[symbols[i]] = result.value.regularMarketPreviousClose;
      }
    });

    cache.set(cacheKey, { data: results, ts: Date.now() });
    return NextResponse.json(results);
  } catch {
    return NextResponse.json({});
  }
}
