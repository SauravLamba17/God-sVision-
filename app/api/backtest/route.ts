import { NextRequest, NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

interface OHLCV {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Trade {
  type: 'BUY' | 'SELL';
  date: string;
  price: number;
  shares: number;
  value: number;
  reason: string;
}

interface BacktestResult {
  ticker: string;
  strategy: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  totalReturnPct: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  trades: Trade[];
  equityCurve: { date: string; value: number }[];
  buyHoldReturn: number;
}

function calculateSMA(prices: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) { sma.push(NaN); continue; }
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma.push(sum / period);
  }
  return sma;
}

function calculateRSI(prices: number[], period: number = 14): number[] {
  const rsi: number[] = new Array(period).fill(NaN);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi.push(100 - 100 / (1 + avgGain / (avgLoss || 0.001)));
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    rsi.push(100 - 100 / (1 + avgGain / (avgLoss || 0.001)));
  }
  return rsi;
}

function runBacktest(
  data: OHLCV[],
  strategy: string,
  initialCapital: number,
  params: any
): BacktestResult {
  const closes = data.map(d => d.close);
  const dates = data.map(d => d.date.toISOString().split('T')[0]);

  let signals: ('BUY' | 'SELL' | null)[] = new Array(data.length).fill(null);

  if (strategy === 'sma_crossover') {
    const shortPeriod = params.shortPeriod ?? 20;
    const longPeriod = params.longPeriod ?? 50;
    const smaShort = calculateSMA(closes, shortPeriod);
    const smaLong = calculateSMA(closes, longPeriod);
    for (let i = 1; i < data.length; i++) {
      if (isNaN(smaShort[i]) || isNaN(smaLong[i])) continue;
      if (smaShort[i] > smaLong[i] && smaShort[i-1] <= smaLong[i-1]) signals[i] = 'BUY';
      if (smaShort[i] < smaLong[i] && smaShort[i-1] >= smaLong[i-1]) signals[i] = 'SELL';
    }
  }

  if (strategy === 'rsi') {
    const oversold = params.oversold ?? 30;
    const overbought = params.overbought ?? 70;
    const rsi = calculateRSI(closes, params.period ?? 14);
    for (let i = 1; i < data.length; i++) {
      if (isNaN(rsi[i])) continue;
      if (rsi[i] < oversold && rsi[i-1] >= oversold) signals[i] = 'BUY';
      if (rsi[i] > overbought && rsi[i-1] <= overbought) signals[i] = 'SELL';
    }
  }

  if (strategy === 'buy_hold') {
    signals[0] = 'BUY';
    signals[signals.length - 1] = 'SELL';
  }

  // Simulate trades
  let capital = initialCapital;
  let shares = 0;
  let inPosition = false;
  const trades: Trade[] = [];
  const equityCurve: { date: string; value: number }[] = [];
  const tradeReturns: number[] = [];
  let peakValue = initialCapital;
  let maxDrawdown = 0;
  let entryPrice = 0;

  for (let i = 0; i < data.length; i++) {
    const price = closes[i];
    const currentValue = capital + shares * price;

    if (currentValue > peakValue) peakValue = currentValue;
    const drawdown = (peakValue - currentValue) / peakValue * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;

    if (signals[i] === 'BUY' && !inPosition && capital > 0) {
      shares = Math.floor(capital / price);
      const cost = shares * price;
      capital -= cost;
      inPosition = true;
      entryPrice = price;
      trades.push({
        type: 'BUY', date: dates[i], price, shares,
        value: cost, reason: strategy.toUpperCase(),
      });
    }

    if (signals[i] === 'SELL' && inPosition && shares > 0) {
      const proceeds = shares * price;
      capital += proceeds;
      inPosition = false;
      const tradeReturn = (price - entryPrice) / entryPrice * 100;
      tradeReturns.push(tradeReturn);
      trades.push({
        type: 'SELL', date: dates[i], price, shares,
        value: proceeds, reason: strategy.toUpperCase(),
      });
      shares = 0;
    }

    equityCurve.push({ date: dates[i], value: Math.round(capital + shares * price) });
  }

  // Close open position at end
  if (inPosition && shares > 0) {
    const finalPrice = closes[closes.length - 1];
    capital += shares * finalPrice;
    const tradeReturn = (finalPrice - entryPrice) / entryPrice * 100;
    tradeReturns.push(tradeReturn);
  }

  const finalCapital = capital;
  const totalReturn = finalCapital - initialCapital;
  const totalReturnPct = (totalReturn / initialCapital) * 100;
  const winningTrades = tradeReturns.filter(r => r > 0).length;
  const winRate = tradeReturns.length > 0 ? (winningTrades / tradeReturns.length) * 100 : 0;

  // Sharpe ratio approximation
  const avgReturn = tradeReturns.length > 0
    ? tradeReturns.reduce((a, b) => a + b, 0) / tradeReturns.length : 0;
  const stdReturn = tradeReturns.length > 1
    ? Math.sqrt(tradeReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (tradeReturns.length - 1))
    : 1;
  const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  // Buy and hold return
  const buyHoldReturn = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100;

  return {
    ticker: '',
    strategy,
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    initialCapital,
    finalCapital: Math.round(finalCapital),
    totalReturn: Math.round(totalReturn),
    totalReturnPct: parseFloat(totalReturnPct.toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
    winRate: parseFloat(winRate.toFixed(1)),
    totalTrades: trades.filter(t => t.type === 'BUY').length,
    winningTrades,
    losingTrades: tradeReturns.length - winningTrades,
    trades: trades.slice(0, 50),
    equityCurve: equityCurve.filter((_, i) => i % 5 === 0),
    buyHoldReturn: parseFloat(buyHoldReturn.toFixed(2)),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      ticker = 'SPY',
      strategy = 'sma_crossover',
      startDate = '2022-01-01',
      endDate = new Date().toISOString().split('T')[0],
      initialCapital = 10000,
      params = {},
    } = body;

    const chart = await yahooFinance.chart(ticker, {
      period1: new Date(startDate),
      period2: new Date(endDate),
      interval: '1d',
    });

    const data: OHLCV[] = (chart.quotes ?? [])
      .filter((q: any) => q.close && q.open && q.high && q.low)
      .map((q: any) => ({
        date: new Date(q.date),
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume ?? 0,
      }));

    if (data.length < 50) {
      return NextResponse.json({ error: 'Not enough data for backtest' }, { status: 400 });
    }

    const result = runBacktest(data, strategy, initialCapital, params);
    result.ticker = ticker.toUpperCase();

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
