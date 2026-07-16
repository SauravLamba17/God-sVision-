import { NextRequest, NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

const cache = new Map<string, { data: Record<string, number>; ts: number }>();
const TTL = 4 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const symbolsParam = url.searchParams.get('symbols') ?? '';
    const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);
    if (symbols.length === 0) return NextResponse.json({});

    const cacheKey = [...symbols].sort().join(',');
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL) return NextResponse.json(cached.data);

    const results: Record<string, number> = {};
    await Promise.allSettled(
      symbols.map(async (symbol) => {
        try {
          const quote = await yahooFinance.quote(symbol);
          if (quote?.regularMarketPreviousClose) {
            results[symbol] = quote.regularMarketPreviousClose;
          }
        } catch { /* silent per-symbol */ }
      })
    );

    cache.set(cacheKey, { data: results, ts: Date.now() });
    return NextResponse.json(results, {
      headers: { 'Cache-Control': 's-maxage=14400' }
    });
  } catch {
    return NextResponse.json({});
  }
}
