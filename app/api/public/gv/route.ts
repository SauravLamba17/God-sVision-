import { NextRequest, NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';
import { getQuotes } from '@/lib/apis/yahoo';
import { isValidSheetsKey } from '@/lib/sheetsKey';
import { z } from 'zod';
import { parseQuery, ticker } from '@/lib/validation';
import { checkLimits, LIMITS, clientIp, tooManyRequests } from '@/lib/rateLimit';
import { track } from '@/lib/feedHealth';

const Query = z.object({
  ticker: z.string({ required_error: 'ticker parameter required' }).pipe(ticker),
  field: z.enum(['price', 'change', 'change_pct', 'volume', 'market_cap', 'pe_ratio', 'eps', 'day_high', 'day_low', 'prev_close', 'open', 'fifty_two_week_high', 'fifty_two_week_low', 'name', 'currency', 'exchange']).default('price'),
});

// Fields the crumb-free query1 chart quote carries. Everything else (P/E, EPS,
// market cap…) still needs yahoo-finance2's query2 quote, which 429s under load.
const CHART_FIELDS = new Set(['price', 'change', 'change_pct', 'volume', 'day_high', 'day_low', 'open', 'fifty_two_week_high', 'fifty_two_week_low', 'currency']);

const cache = new Map<string, { data: any; ts: number }>();
const TTL = 30 * 1000;

export async function GET(req: NextRequest) {
  try {
    // Generous per-IP limit: Apps Script calls come from Google's shared IP pool.
    const ipLimit = await checkLimits([LIMITS.sheetsIp(clientIp(req))]);
    if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfter, 'requests from this network');

    const apiKey = req.nextUrl.searchParams.get('key');
    if (!(await isValidSheetsKey(apiKey))) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
    }
    // Per key only once it's known to be valid, so random keys can't mint counter rows.
    const keyLimit = await checkLimits([LIMITS.sheetsKey(apiKey!)]);
    if (!keyLimit.ok) return tooManyRequests(keyLimit.retryAfter, 'requests for this API key');

    // Validated after the key check, so an unauthenticated caller always gets 401.
    const q = parseQuery(req, Query);
    if (q.error) return q.error;
    const { ticker, field } = q.data;

    const cacheKey = `${ticker}_${field}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL) {
      return NextResponse.json(cached.data);
    }

    const quote: any = (CHART_FIELDS.has(field) && (await getQuotes([ticker]))[0]) || await track('Yahoo Finance (yahoo-finance2)', () => yahooFinance.quote(ticker));

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
