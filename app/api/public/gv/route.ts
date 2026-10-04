import { NextRequest, NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';
import { getQuotes } from '@/lib/apis/yahoo';
import { isValidSheetsKey } from '@/lib/sheetsKey';

// Fields the crumb-free query1 chart quote carries. Everything else (P/E, EPS,
// market cap…) still needs yahoo-finance2's query2 quote, which 429s under load.
const CHART_FIELDS = new Set(['price', 'change', 'change_pct', 'volume', 'day_high', 'day_low', 'open', 'fifty_two_week_high', 'fifty_two_week_low', 'currency']);

const cache = new Map<string, { data: any; ts: number }>();
const TTL = 30 * 1000;

export async function GET(req: NextRequest) {
  try {
    const apiKey = req.nextUrl.searchParams.get('key');
    if (!(await isValidSheetsKey(apiKey))) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
    }

    const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase();
    const field = req.nextUrl.searchParams.get('field') ?? 'price';

    if (!ticker) {
      return NextResponse.json({ error: 'ticker parameter required' }, { status: 400 });
    }

    const cacheKey = `${ticker}_${field}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL) {
      return NextResponse.json(cached.data);
    }

    const quote: any = (CHART_FIELDS.has(field) && (await getQuotes([ticker]))[0]) || await yahooFinance.quote(ticker);

    const fieldMap: Record<string, any> = {
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange,
      change_pct: quote.regularMarketChangePercent,
      volume: quote.regularMarketVolume,
      market_cap: quote.marketCap,
      pe_ratio: quote.trailingPE,
      eps: quote.epsTrailingTwelveMonths,
      day_high: quote.regularMarketDayHigh,
      day_low: quote.regularMarketDayLow,
      prev_close: quote.regularMarketPreviousClose,
      open: quote.regularMarketOpen,
      fifty_two_week_high: quote.fiftyTwoWeekHigh,
      fifty_two_week_low: quote.fiftyTwoWeekLow,
      name: quote.longName ?? quote.shortName,
      currency: quote.currency,
      exchange: quote.fullExchangeName,
    };

    const value = fieldMap[field] ?? null;

    if (value === null || value === undefined) {
      return NextResponse.json({ error: `Field '${field}' not found for ${ticker}` }, { status: 404 });
    }

    const result = { ticker, field, value, timestamp: new Date().toISOString() };
    cache.set(cacheKey, { data: result, ts: Date.now() });

    return NextResponse.json(result, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
