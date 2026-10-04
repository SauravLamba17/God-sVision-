import { NextRequest, NextResponse } from 'next/server';
import { getChartRange } from '@/lib/apis/yahoo';
import { isValidSheetsKey } from '@/lib/sheetsKey';

// Per-instance upstream cache (checked after the key, so revocation is instant).
// Replaces the CDN caching this route used to rely on.
const cache = new Map<string, { data: any; ts: number }>();
const TTL = 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const apiKey = req.nextUrl.searchParams.get('key');
    if (!(await isValidSheetsKey(apiKey))) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase();
    const field = req.nextUrl.searchParams.get('field') ?? 'close';
    const startDate = req.nextUrl.searchParams.get('start') ?? '2024-01-01';
    const endDate = req.nextUrl.searchParams.get('end') ?? new Date().toISOString().split('T')[0];

    if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

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
