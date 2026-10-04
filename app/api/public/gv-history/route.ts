import { NextRequest, NextResponse } from 'next/server';
import { getChartRange } from '@/lib/apis/yahoo';
import { isValidSheetsKey } from '@/lib/sheetsKey';
import { z } from 'zod';
import { parseQuery, ticker, isoDate } from '@/lib/validation';
import { checkLimits, LIMITS, clientIp, tooManyRequests } from '@/lib/rateLimit';

const Query = z.object({
  ticker: z.string({ required_error: 'ticker required' }).pipe(ticker),
  field: z.enum(['open', 'high', 'low', 'close', 'volume', 'adjclose']).default('close'),
  start: isoDate.default('2024-01-01'),
  end: isoDate.default(() => new Date().toISOString().split('T')[0]),
}).refine(q => q.start <= q.end, { message: 'start must be on or before end' });

// Per-instance upstream cache (checked after the key, so revocation is instant).
// Replaces the CDN caching this route used to rely on.
const cache = new Map<string, { data: any; ts: number }>();
const TTL = 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    // Generous per-IP limit: Apps Script calls come from Google's shared IP pool.
    const ipLimit = await checkLimits([LIMITS.sheetsIp(clientIp(req))]);
    if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfter, 'requests from this network');

    const apiKey = req.nextUrl.searchParams.get('key');
    if (!(await isValidSheetsKey(apiKey))) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }
    // Per key only once it's known to be valid, so random keys can't mint counter rows.
    const keyLimit = await checkLimits([LIMITS.sheetsKey(apiKey!)]);
    if (!keyLimit.ok) return tooManyRequests(keyLimit.retryAfter, 'requests for this API key');

    // Validated after the key check, so an unauthenticated caller always gets 401.
    const q = parseQuery(req, Query);
    if (q.error) return q.error;
    const { ticker, field, start: startDate, end: endDate } = q.data;

    const cacheKey = `${ticker}|${field}|${startDate}|${endDate}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL) {
      return NextResponse.json(cached.data, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const chart = await getChartRange(ticker, new Date(startDate), new Date(endDate), '1d');

    const rows = (chart.quotes ?? []).map((q: any) => ({
      date: new Date(q.date).toISOString().split('T')[0],
      value: q[field] ?? q.close,
    }));

    const result = { ticker, field, rows };
    cache.set(cacheKey, { data: result, ts: Date.now() });

    return NextResponse.json(result, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
