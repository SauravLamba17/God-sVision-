import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'
import { getQuotes } from '@/lib/apis/yahoo'

// Representative universe of liquid stocks for screener
const SCREENER_UNIVERSE = [
  // Mega cap
  'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','JPM','AVGO','LLY',
  'V','UNH','XOM','MA','JNJ','HD','COST','PG','ABBV','MRK',
  // Large cap tech
  'CRM','ORCL','AMD','QCOM','INTC','CSCO','ADBE','TXN','AMAT','LRCX',
  // Large cap non-tech
  'BAC','WFC','GS','MS','BLK','AXP','BRK-B','WMT','TGT','LOW',
  // Growth
  'NFLX','PLTR','SNOW','CRWD','PANW','DDOG','NET','MDB','ZS','SMCI',
  // Other sectors
  'GE','CAT','RTX','HON','UNP','BA','LMT','MMM','UPS','ETN',
  'NEE','SO','D','DUK','AEP','EXC','NEM','FCX','LIN','APD',
  'PLD','AMT','EQIX','O','SPG','MCD','SBUX','NKE','BKNG','CMG',
]

const SCREENER_IDS = [
  'day_gainers','day_losers','most_actives',
  'undervalued_growth_stocks','growth_technology_stocks',
  'aggressive_small_caps','small_cap_gainers',
  'high_yield_bond','portfolio_anchors',
]

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const scrId   = searchParams.get('scrId')   || 'day_gainers'
  const count   = parseInt(searchParams.get('count') || '25')
  const sector  = searchParams.get('sector')  || ''
  const minPE   = parseFloat(searchParams.get('minPE') || '0')
  const maxPE   = parseFloat(searchParams.get('maxPE') || '999')
  const minMCap = parseFloat(searchParams.get('minMCap') || '0')

  const cacheKey = `screener_v2_${scrId}_${count}_${sector}`
  const cached = getCache(cacheKey)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached', screeners: SCREENER_IDS })

  try {
    const quotes = await getQuotes(SCREENER_UNIVERSE)
    if (quotes.length === 0) throw new Error('No quote data')

    const mapped = quotes.map((q: any) => ({
      symbol:           q.symbol,
      shortName:        q.shortName || q.symbol,
      price:            q.regularMarketPrice || 0,
      change:           q.regularMarketChange || 0,
      changePct:        q.regularMarketChangePercent || 0,
      volume:           q.regularMarketVolume || 0,
      marketCap:        q.marketCap || 0,
      fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
      fiftyTwoWeekLow:  q.fiftyTwoWeekLow,
    }))

    // Sort based on screener type
    let sorted = [...mapped]
    if (scrId === 'day_gainers')             sorted = sorted.sort((a, b) => b.changePct - a.changePct)
    else if (scrId === 'day_losers')         sorted = sorted.sort((a, b) => a.changePct - b.changePct)
    else if (scrId === 'most_actives')       sorted = sorted.sort((a, b) => b.volume - a.volume)
    else if (scrId.includes('growth'))       sorted = sorted.sort((a, b) => b.changePct - a.changePct).filter(q => q.changePct > 0)
    else if (scrId === 'aggressive_small_caps' || scrId === 'small_cap_gainers') {
      sorted = sorted.sort((a, b) => b.changePct - a.changePct).filter(q => q.marketCap < 2e9 && q.changePct > 0)
    } else if (scrId === 'undervalued_growth_stocks') {
      sorted = sorted.sort((a, b) => b.changePct - a.changePct).filter(q => q.price > 0)
    } else {
      sorted = sorted.sort((a, b) => b.changePct - a.changePct)
    }

    if (minMCap > 0) sorted = sorted.filter(q => q.marketCap >= minMCap * 1e9)

    const result = sorted.slice(0, count)
    setCache(cacheKey, result, 120)
    return NextResponse.json({ data: result, source: 'live', screeners: SCREENER_IDS })
  } catch (err: any) {
    if (cached) return NextResponse.json({ data: cached.data, source: 'stale', screeners: SCREENER_IDS })
    return NextResponse.json({ error: err?.message, data: [], screeners: SCREENER_IDS })
  }
}
