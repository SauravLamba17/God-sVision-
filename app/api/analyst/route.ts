/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'
import {
  buildUniverseSnapshots, ANALYST_UNIVERSE_IN, ANALYST_UNIVERSE_US, StockSnapshot, matchNewsForTicker,
} from '@/lib/apis/analyst-data'
import { getIndianMarketStatus } from '@/lib/apis/india'
import { z } from 'zod'
import { parseQuery } from '@/lib/validation'

const MarketQuery = z.object({ market: z.string().trim().toUpperCase().pipe(z.enum(['US', 'IN'])).default('IN') })

// Builds the full universe snapshot; cold path can run tens of seconds.
export const maxDuration = 60

const SECTOR_MAP_IN: Record<string, string> = {
  'TCS.NS': 'IT', 'INFY.NS': 'IT',
  'HDFCBANK.NS': 'BANKING', 'ICICIBANK.NS': 'BANKING', 'SBIN.NS': 'BANKING', 'KOTAKBANK.NS': 'BANKING', 'AXISBANK.NS': 'BANKING', 'BAJFINANCE.NS': 'BANKING',
  'RELIANCE.NS': 'ENERGY',
  'BHARTIARTL.NS': 'TELECOM', 'ITC.NS': 'FMCG', 'LT.NS': 'INFRA',
  'MARUTI.NS': 'AUTO', 'TATAMOTORS.NS': 'AUTO', 'SUNPHARMA.NS': 'PHARMA',
}
const SECTOR_MAP_US: Record<string, string> = {
  'AAPL': 'TECH', 'MSFT': 'TECH', 'NVDA': 'TECH', 'GOOGL': 'TECH', 'META': 'TECH', 'AVGO': 'TECH',
  'AMZN': 'CONSUMER', 'WMT': 'CONSUMER', 'TSLA': 'CONSUMER',
  'JPM': 'FINANCIALS', 'V': 'FINANCIALS',
  'UNH': 'HEALTHCARE', 'JNJ': 'HEALTHCARE', 'LLY': 'HEALTHCARE',
  'XOM': 'ENERGY',
}

function getUSMarketStatus(): 'OPEN' | 'CLOSED' | 'PRE-OPEN' | 'AFTER-HOURS' {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'long', hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(now)
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? ''
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10)
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10)
  const t = hour * 100 + minute
  if (['Saturday', 'Sunday'].includes(weekday)) return 'CLOSED'
  if (t >= 400 && t < 930) return 'PRE-OPEN'
  if (t >= 930 && t < 1600) return 'OPEN'
  if (t >= 1600 && t < 2000) return 'AFTER-HOURS'
  return 'CLOSED'
}

interface TopPick {
  ticker: string; name: string; action: 'BUY' | 'SELL' | 'WATCH'; conviction: 'HIGH' | 'MEDIUM' | 'LOW'
  entry: number; target1: number; target2: number; stopLoss: number
  technicalSummary: string; newsCatalyst: string; optionsStrategy: string
}

function scoreSnapshot(s: StockSnapshot): number {
  let score = 0
  if (s.rsi !== null) {
    if (s.rsi >= 45 && s.rsi <= 65) score += 2
    else if (s.rsi > 35 && s.rsi < 45) score += 1
    else if (s.rsi > 70) score -= 2
    else if (s.rsi < 30) score -= 1
  }
  if (s.sma20 !== null && s.sma50 !== null && s.price > s.sma20 && s.sma20 > s.sma50) score += 2
  if (s.supertrend.trend === 'UP') score += 2
  if (s.supertrend.trend === 'DOWN') score -= 2
  if (s.macd.histogram !== null && s.macd.histogram > 0) score += 1
  if (s.macd.histogram !== null && s.macd.histogram < 0) score -= 1
  if (s.volumeRatio > 1.2) score += 1
  if (s.patterns.some(p => ['BULLISH_ENGULFING', 'HAMMER', 'MORNING_STAR', 'THREE_WHITE_SOLDIERS'].includes(p))) score += 1
  if (s.patterns.some(p => ['BEARISH_ENGULFING', 'SHOOTING_STAR', 'EVENING_STAR', 'THREE_BLACK_CROWS'].includes(p))) score -= 1
  return score
}

function technicalSummaryFor(s: StockSnapshot): string {
  const trendTxt = s.supertrend.trend === 'UP' ? 'in a confirmed Supertrend uptrend' : s.supertrend.trend === 'DOWN' ? 'in a Supertrend downtrend' : 'range-bound'
  const rsiTxt = s.rsi !== null ? `RSI at ${s.rsi.toFixed(1)}` : 'RSI unavailable'
  const maTxt = s.sma20 !== null && s.sma50 !== null
    ? (s.price > s.sma20 && s.sma20 > s.sma50 ? 'trading above both the 20D and 50D averages' : s.price < s.sma20 ? 'trading below its 20D average' : 'consolidating near its moving averages')
    : ''
  const volTxt = s.volumeRatio > 1.3 ? `volume running ${s.volumeRatio.toFixed(1)}x average — conviction move` : 'volume in line with average'
  return `${s.name} is ${trendTxt}, ${maTxt}. ${rsiTxt}, MACD histogram ${s.macd.histogram !== null && s.macd.histogram > 0 ? 'positive' : 'negative'}. ${volTxt}.`
}

function buildRuleBasedSynthesis(snapshots: StockSnapshot[], market: 'IN' | 'US', news: Record<string, string>) {
  const ranked = [...snapshots].sort((a, b) => scoreSnapshot(b) - scoreSnapshot(a))
  const top5 = ranked.slice(0, 5)
  const worst = ranked.slice(-3).filter(s => scoreSnapshot(s) < 0)
  const sectorMap = market === 'IN' ? SECTOR_MAP_IN : SECTOR_MAP_US

  const topPicks: TopPick[] = top5.map(s => {
    const score = scoreSnapshot(s)
    const conviction: TopPick['conviction'] = score >= 5 ? 'HIGH' : score >= 2 ? 'MEDIUM' : 'LOW'
    const a = s.atr || s.price * 0.015
    const action: TopPick['action'] = score >= 1 ? 'BUY' : score <= -1 ? 'SELL' : 'WATCH'
    const dir = action === 'SELL' ? -1 : 1
    return {
      ticker: s.ticker, name: s.name, action, conviction,
      entry: +s.price.toFixed(2),
      target1: +(s.price + dir * 1.5 * a).toFixed(2),
      target2: +(s.price + dir * 3 * a).toFixed(2),
      stopLoss: +(s.price - dir * 1.5 * a).toFixed(2),
      technicalSummary: technicalSummaryFor(s),
      newsCatalyst: news[s.ticker] || 'No major company-specific headline in the latest news cycle.',
      optionsStrategy: conviction === 'HIGH'
        ? (action === 'BUY' ? 'Long Call / Bull Call Spread near ATM' : 'Long Put / Bear Put Spread near ATM')
        : 'Wait for confirmation — avoid directional options until trend strengthens',
    }
  })

  const avoidList = worst.map(s => ({
    ticker: s.ticker, name: s.name,
    reason: `${s.supertrend.trend === 'DOWN' ? 'Downtrend confirmed by Supertrend' : 'Weak momentum'}${s.rsi !== null && s.rsi > 70 ? `, RSI overbought at ${s.rsi.toFixed(1)}` : ''}${s.macd.histogram !== null && s.macd.histogram < 0 ? ', negative MACD histogram' : ''}.`,
  }))

  const sectorAgg: Record<string, number[]> = {}
  for (const s of snapshots) {
    const sec = sectorMap[s.ticker] || 'OTHERS'
    if (!sectorAgg[sec]) sectorAgg[sec] = []
    sectorAgg[sec].push(s.changePct)
  }
  const sectorRotation = Object.entries(sectorAgg).map(([sector, changes]) => {
    const avg = changes.reduce((a, b) => a + b, 0) / changes.length
    return { sector, trend: (avg > 0.4 ? 'INFLOW' : avg < -0.4 ? 'OUTFLOW' : 'NEUTRAL') as 'INFLOW' | 'OUTFLOW' | 'NEUTRAL', avgChangePct: +avg.toFixed(2) }
  }).sort((a, b) => b.avgChangePct - a.avgChangePct)

  const avgVol = snapshots.reduce((a, s) => a + (s.atr ? s.atr / s.price : 0), 0) / snapshots.length * 100
  const bullCount = snapshots.filter(s => s.supertrend.trend === 'UP').length
  const bias = bullCount > snapshots.length * 0.6 ? 'BULLISH' : bullCount < snapshots.length * 0.4 ? 'BEARISH' : 'NEUTRAL'

  return {
    marketOutlook: {
      bias,
      summary: `${bullCount}/${snapshots.length} tracked names in confirmed uptrends. Realized volatility running near ${avgVol.toFixed(1)}% of price (ATR-based). ${bias === 'BULLISH' ? 'Breadth favors continuation — buy dips into support.' : bias === 'BEARISH' ? 'Breadth deteriorating — favor defensive positioning and tighter stops.' : 'Mixed breadth — selective stock-picking over index-level conviction.'}`,
      keyLevel: top5[0] ? `${top5[0].name} pivot near ${top5[0].supertrend.value?.toFixed(2) ?? top5[0].sma20?.toFixed(2)}` : 'N/A',
    },
    topPicks,
    avoidList,
    sectorRotation,
    optionsMarketView: `Implied volatility proxies (ATR-derived) average ${avgVol.toFixed(1)}% — ${avgVol > 2.5 ? 'elevated, favor spreads over naked premium buying' : 'subdued, premium selling strategies carry better risk/reward'}. ${bias === 'BULLISH' ? 'Call writers should stay cautious near resistance; put sellers favored on quality dips.' : 'Hedge long equity exposure with protective puts on index-correlated names.'}`,
    dayTradingSetups: top5.slice(0, 2).map(s => ({
      ticker: s.ticker, name: s.name,
      setup: `${s.supertrend.trend === 'UP' ? 'Buy on dip toward' : 'Sell on rally toward'} VWAP (${s.vwap?.toFixed(2) ?? 'N/A'}) with Supertrend confirmation`,
      trigger: `Above ${s.resistance[0]?.toFixed(2) ?? s.sma20?.toFixed(2) ?? '—'} on volume ${s.volumeRatio.toFixed(1)}x average`,
    })),
    riskWarnings: [
      market === 'IN'
        ? 'Monitor India VIX and FII flows for sudden risk-off reversals.'
        : 'Monitor VIX and Fed commentary for sudden risk-off reversals.',
      'Technical levels are model-derived from daily OHLCV — confirm with live order-flow before execution.',
      'Options strategies referenced are indicative only and not exchange-verified pricing.',
    ],
  }
}

export async function GET(req: NextRequest) {
  const q = parseQuery(req, MarketQuery)
  if (q.error) return q.error
  const { market } = q.data
  const cacheKey = `analyst_${market}`
  const cached = await getCache<any>(cacheKey)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'estimate' })

  try {
    const universe = market === 'IN' ? ANALYST_UNIVERSE_IN : ANALYST_UNIVERSE_US
    const snapshots = await buildUniverseSnapshots(universe)

    if (snapshots.length === 0) {
      const fallback = await getCache<any>(cacheKey)
      if (fallback) return NextResponse.json({ data: fallback.data, source: 'stale' })
      return NextResponse.json({ error: 'No market data available', data: null, source: 'unavailable' })
    }

    let newsMap: Record<string, string> = {}
    if (market === 'IN') {
      try {
        const newsCache = await getCache<any>('india_news')
        const articles: any[] = newsCache?.data?.articles || []
        for (const t of universe) {
          const matched = matchNewsForTicker(articles, t, 1)
          if (matched[0]) newsMap[t] = matched[0].title
        }
      } catch { /* news optional */ }
    }

    // Rule-based synthesis of the live snapshots, labelled 'estimate'. The
    // Gemini briefing that used to run here never succeeded (its large JSON
    // reply was cut off at the output-token limit, so every attempt failed and
    // retried every 30 min, draining the shared daily AI budget).
    const result: any = buildRuleBasedSynthesis(snapshots, market, newsMap)
    result.market = market
    result.marketStatus = market === 'IN' ? getIndianMarketStatus() : getUSMarketStatus()
    result.generatedAt = Date.now()
    result.nextRefresh = Date.now() + 15 * 60 * 1000
    result.universeSize = snapshots.length

    await setCache(cacheKey, result, 900)
    return NextResponse.json({ data: result, source: 'estimate' })
  } catch (err) {
    const fallback = await getCache<any>(cacheKey)
    if (fallback) return NextResponse.json({ data: fallback.data, source: 'stale' })
    return NextResponse.json({ error: String(err), data: null, source: 'unavailable' })
  }
}
