import { NextRequest, NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

const VALID_KEYS = new Set([process.env.GV_SHEETS_API_KEY ?? 'godsvision-demo-key']);

export async function GET(req: NextRequest) {
  try {
    const apiKey = req.nextUrl.searchParams.get('key');
    if (!apiKey || !VALID_KEYS.has(apiKey)) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase();
    const field = req.nextUrl.searchParams.get('field') ?? 'close';
    const startDate = req.nextUrl.searchParams.get('start') ?? '2024-01-01';
    const endDate = req.nextUrl.searchParams.get('end') ?? new Date().toISOString().split('T')[0];

    if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

    const chart = await yahooFinance.chart(ticker, {
      period1: new Date(startDate),
      period2: new Date(endDate),
      interval: '1d',
    });

    const rows = (chart.quotes ?? []).map((q: any) => ({
      date: new Date(q.date).toISOString().split('T')[0],
      value: q[field] ?? q.close,
    }));

    return NextResponse.json({ ticker, field, rows }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
