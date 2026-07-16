import { NextRequest, NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

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
      const yields = await Promise.allSettled(
        TREASURY_TICKERS.map(async (t) => {
          try {
            const q = await yahooFinance.quote(t.symbol);
            return {
              symbol: t.symbol,
              label: t.label,
              maturity: t.maturity,
              yield: q.regularMarketPrice ?? 0,
              change: q.regularMarketChange ?? 0,
              changePct: q.regularMarketChangePercent ?? 0,
            };
          } catch {
            return { symbol: t.symbol, label: t.label, maturity: t.maturity, yield: 0, change: 0, changePct: 0 };
          }
        })
      );
      const data = yields
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value);
      cache.set(cacheKey, { data, ts: Date.now() });
      return NextResponse.json(data);
    }

    if (type === 'etfs') {
      const etfs = await Promise.allSettled(
        BOND_ETFS.map(async (e) => {
          try {
            const q = await yahooFinance.quote(e.symbol);
            return {
              symbol: e.symbol,
              label: e.label,
              price: q.regularMarketPrice ?? 0,
              change: q.regularMarketChange ?? 0,
              changePct: q.regularMarketChangePercent ?? 0,
              volume: q.regularMarketVolume ?? 0,
              yield: (q as any).trailingAnnualDividendYield
                ? ((q as any).trailingAnnualDividendYield * 100).toFixed(2)
                : null,
            };
          } catch {
            return { symbol: e.symbol, label: e.label, price: 0, change: 0, changePct: 0, volume: 0, yield: null };
          }
        })
      );
      const data = etfs
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value);
      cache.set(cacheKey, { data, ts: Date.now() });
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
      // Fall back to static estimates if the key is missing OR every live FRED call failed
      // (e.g. an invalid/placeholder key — FRED requires a 32-char alphanumeric key)
      if (Object.keys(spreads).length === 0) {
        spreads['BAMLC0A0CM'] = { label: 'Investment Grade Spread', value: 0.98, date: 'N/A' };
        spreads['BAMLH0A0HYM2'] = { label: 'High Yield Spread', value: 3.21, date: 'N/A' };
        spreads['T10Y2Y'] = { label: '10Y-2Y Spread', value: 0.18, date: 'N/A' };
        spreads['T10Y3M'] = { label: '10Y-3M Spread', value: -0.42, date: 'N/A' };
      }
      cache.set(cacheKey, { data: spreads, ts: Date.now() });
      return NextResponse.json(spreads);
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
