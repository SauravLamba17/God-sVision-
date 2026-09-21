import { NextRequest, NextResponse } from 'next/server';
import { getQuotes } from '@/lib/apis/yahoo';

// Values are null when the upstream did not return them. They were previously
// `?? 0` with a `catch { yield: 0 }` per ticker, so a rate-limited Yahoo call
// rendered as a real-looking 0.00% yield / $0.00 price. yahooFinance.quote()
// hits query2 /v7/finance/quote, which answers "Too Many Requests"; getQuotes()
// goes to query1 /v8/finance/chart first, which is a separate rate-limit pool
// and is what the dashboard's own treasury display already uses.
const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

const cache = new Map<string, { data: any; ts: number }>();
const TTL = 5 * 60 * 1000;

const TREASURY_TICKERS = [
  { symbol: '^IRX', label: '3M T-Bill', maturity: '3M' },
  { symbol: '^FVX', label: '5Y Treasury', maturity: '5Y' },
  { symbol: '^TNX', label: '10Y Treasury', maturity: '10Y' },
  { symbol: '^TYX', label: '30Y Treasury', maturity: '30Y' },
];

const BOND_ETFS = [
  { symbol: 'TLT', label: 'iShares 20+ Year Treasury ETF' },
  { symbol: 'IEF', label: 'iShares 7-10 Year Treasury ETF' },
  { symbol: 'SHY', label: 'iShares 1-3 Year Treasury ETF' },
  { symbol: 'LQD', label: 'iShares Investment Grade Corp Bond' },
  { symbol: 'HYG', label: 'iShares High Yield Corp Bond' },
  { symbol: 'MUB', label: 'iShares National Muni Bond ETF' },
  { symbol: 'EMB', label: 'iShares JPM USD Emerging Markets Bond' },
  { symbol: 'BND', label: 'Vanguard Total Bond Market ETF' },
];

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get('type') ?? 'overview';
    const cacheKey = `bonds_${type}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL) {
      return NextResponse.json(cached.data);
    }

    if (type === 'yields') {
      const quotes = await getQuotes(TREASURY_TICKERS.map(t => t.symbol));
      const bySymbol = new Map(quotes.map((q: any) => [q.symbol, q]));
      const data = TREASURY_TICKERS.map(t => {
        const q = bySymbol.get(t.symbol);
        return {
          symbol: t.symbol,
          label: t.label,
          maturity: t.maturity,
          yield: num(q?.regularMarketPrice),
          change: num(q?.regularMarketChange),
          changePct: num(q?.regularMarketChangePercent),
        };
      });
      // Only cache a result that actually carries data, so a bad minute upstream
      // is retried on the next request instead of being pinned for the full TTL.
      if (data.some(d => d.yield !== null)) cache.set(cacheKey, { data, ts: Date.now() });
      return NextResponse.json(data);
    }

    if (type === 'etfs') {
      const quotes = await getQuotes(BOND_ETFS.map(e => e.symbol));
      const bySymbol = new Map(quotes.map((q: any) => [q.symbol, q]));
      const data = BOND_ETFS.map(e => {
        const q: any = bySymbol.get(e.symbol);
        const divYield = num(q?.trailingAnnualDividendYield);
        return {
          symbol: e.symbol,
          label: e.label,
          price: num(q?.regularMarketPrice),
          change: num(q?.regularMarketChange),
          changePct: num(q?.regularMarketChangePercent),
          volume: num(q?.regularMarketVolume),
          // The v8 chart meta does not carry dividend yield, so this is null on
          // that path rather than 0 — the UI already renders null as an em dash.
          yield: divYield === null ? null : (divYield * 100).toFixed(2),
        };
      });
      if (data.some(d => d.price !== null)) cache.set(cacheKey, { data, ts: Date.now() });
      return NextResponse.json(data);
    }

    if (type === 'spread') {
      // Credit spreads from FRED (fallback to static if no key)
      const FRED_KEY = process.env.FRED_API_KEY;
      const spreads: any = {};
      if (FRED_KEY) {
        const series = [
          { id: 'BAMLC0A0CM', label: 'Investment Grade Spread' },
          { id: 'BAMLH0A0HYM2', label: 'High Yield Spread' },
          { id: 'T10Y2Y', label: '10Y-2Y Spread' },
          { id: 'T10Y3M', label: '10Y-3M Spread' },
        ];
        await Promise.allSettled(
          series.map(async (s) => {
            try {
              const r = await fetch(
                `https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}&api_key=${FRED_KEY}&limit=1&sort_order=desc&file_type=json`
              );
              const d = await r.json();
              const latest = d.observations?.[0];
              if (latest) {
                spreads[s.id] = {
                  label: s.label,
                  value: parseFloat(latest.value),
                  date: latest.date,
                };
              }
            } catch { /* silent per-series */ }
          })
        );
      }
      // No live FRED data -> report each series as unavailable. This previously
      // substituted four hardcoded numbers (0.98 / 3.21 / 0.18 / -0.42) carrying
      // date:'N/A', which the page rendered as real percentages. FRED_API_KEY is
      // a placeholder in this environment, so that fabricated branch was the one
      // always taken.
      if (Object.keys(spreads).length === 0) {
        for (const s of [
          { id: 'BAMLC0A0CM', label: 'Investment Grade Spread' },
          { id: 'BAMLH0A0HYM2', label: 'High Yield Spread' },
          { id: 'T10Y2Y', label: '10Y-2Y Spread' },
          { id: 'T10Y3M', label: '10Y-3M Spread' },
        ]) {
          spreads[s.id] = { label: s.label, value: null, date: null, unavailable: true };
        }
        // Not cached: a key added later should take effect on the next request.
        return NextResponse.json(spreads);
      }
      cache.set(cacheKey, { data: spreads, ts: Date.now() });
      return NextResponse.json(spreads);
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
