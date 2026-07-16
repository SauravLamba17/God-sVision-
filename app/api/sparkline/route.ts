import { NextRequest, NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

// Cache: much longer TTL to avoid re-triggering Yahoo's rate limit
const cache = new Map<string, { data: number[]; ts: number; source: string }>();
const YAHOO_TTL = 5 * 60 * 1000;      // 5 minutes for Yahoo-sourced symbols
const ALPACA_TTL = 60 * 1000;         // 1 minute for Alpaca (higher limit, can refresh more)
const COINGECKO_TTL = 60 * 1000;      // 1 minute for crypto

// Map dashboard symbols to their best available data source + proxy ticker
const SOURCE_MAP: Record<string, { source: 'alpaca' | 'coingecko' | 'yahoo'; proxySymbol: string }> = {
  '^GSPC': { source: 'alpaca', proxySymbol: 'SPY' },      // S&P 500 via SPY ETF
  '^IXIC': { source: 'alpaca', proxySymbol: 'QQQ' },      // NASDAQ via QQQ ETF
  'BTC-USD': { source: 'coingecko', proxySymbol: 'bitcoin' },
  'GC=F': { source: 'yahoo', proxySymbol: 'GC=F' },       // Gold - no good alternative
  'DX-Y.NYB': { source: 'yahoo', proxySymbol: 'DX-Y.NYB' }, // USD Index - no alternative
  '^NSEI': { source: 'yahoo', proxySymbol: '^NSEI' },     // Nifty - no alternative
  '^BSESN': { source: 'yahoo', proxySymbol: '^BSESN' },   // Sensex - no alternative
  '^NSEBANK': { source: 'yahoo', proxySymbol: '^NSEBANK' }, // Bank Nifty - no alternative
  '^INDIAVIX': { source: 'yahoo', proxySymbol: '^INDIAVIX' }, // India VIX - no alternative
};

async function fetchFromAlpaca(symbol: string): Promise<number[]> {
  const apiKey = process.env.ALPACA_API_KEY;
  const secretKey = process.env.ALPACA_SECRET_KEY;
  if (!apiKey || !secretKey) return [];

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const url = `https://data.alpaca.markets/v2/stocks/${symbol}/bars?` +
    `start=${start.toISOString()}&end=${now.toISOString()}&timeframe=5Min&limit=100&feed=iex`;

  const res = await fetch(url, {
    headers: {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': secretKey,
    },
    signal: AbortSignal.timeout(6000),
  });

  if (!res.ok) return [];
  const data = await res.json();
  const bars = data.bars ?? [];
  return bars.map((b: any) => b.c).filter((c: number) => typeof c === 'number' && c > 0);
}

async function fetchFromCoinGecko(coinId: string): Promise<number[]> {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=1`,
    { signal: AbortSignal.timeout(6000) }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const prices = (data.prices ?? []).map((p: [number, number]) => p[1]);
  // Downsample if too many points
  if (prices.length > 60) {
    const step = Math.ceil(prices.length / 60);
    return prices.filter((_: number, i: number) => i % step === 0);
  }
  return prices;
}

async function fetchIntradaySeriesYahoo(symbol: string): Promise<number[]> {
  const now = new Date();
  const marketOpen = new Date(now);
  marketOpen.setHours(0, 0, 0, 0);

  const attempts = [
    { period1: marketOpen, period2: now, interval: '5m' as const },
    { period1: marketOpen, period2: now, interval: '15m' as const },
    { period1: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), period2: now, interval: '30m' as const },
    { period1: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), period2: now, interval: '1d' as const },
  ];

  for (const attempt of attempts) {
    try {
      const result = await yahooFinance.chart(symbol, attempt);
      const closes = (result.quotes ?? [])
        .map((q: any) => q.close)
        .filter((c: any) => typeof c === 'number' && !isNaN(c) && c > 0);
      if (closes.length >= 2) return closes;
    } catch {
      continue;
    }
  }
  return [];
}

export async function GET(req: NextRequest) {
  try {
    const symbol = req.nextUrl.searchParams.get('symbol');
    if (!symbol) {
      return NextResponse.json({ prices: [], error: 'symbol required' }, { status: 400 });
    }

    const mapping = SOURCE_MAP[symbol] ?? { source: 'yahoo' as const, proxySymbol: symbol };
    const cacheKey = symbol;
    const cached = cache.get(cacheKey);

    const ttl = mapping.source === 'yahoo' ? YAHOO_TTL
      : mapping.source === 'alpaca' ? ALPACA_TTL
      : COINGECKO_TTL;

    if (cached && Date.now() - cached.ts < ttl) {
      return NextResponse.json({ prices: cached.data, cached: true, source: cached.source });
    }

    let prices: number[] = [];

    if (mapping.source === 'alpaca') {
      prices = await fetchFromAlpaca(mapping.proxySymbol);
      // If Alpaca fails for any reason, fall back to Yahoo as safety net
      if (prices.length < 2) {
        prices = await fetchIntradaySeriesYahoo(mapping.proxySymbol);
      }
    } else if (mapping.source === 'coingecko') {
      prices = await fetchFromCoinGecko(mapping.proxySymbol);
    } else {
      prices = await fetchIntradaySeriesYahoo(mapping.proxySymbol);
    }

    if (prices.length < 2) {
      // Return honest empty state — do NOT fabricate data
      // Still cache the empty result briefly to avoid hammering
      // the failing source repeatedly within a short window
      cache.set(cacheKey, { data: [], ts: Date.now(), source: mapping.source });
      return NextResponse.json({ prices: [], source: mapping.source, error: 'no data available' });
    }

    // Downsample to max 60 points
    if (prices.length > 60) {
      const step = Math.ceil(prices.length / 60);
      prices = prices.filter((_, i) => i % step === 0);
    }

    cache.set(cacheKey, { data: prices, ts: Date.now(), source: mapping.source });
    return NextResponse.json({ prices, cached: false, source: mapping.source });
  } catch (e: any) {
    return NextResponse.json({ prices: [], error: e.message }, { status: 200 });
  }
}
