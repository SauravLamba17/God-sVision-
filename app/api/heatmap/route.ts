import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'
import { getQuotes } from '@/lib/apis/yahoo'

const SECTORS = [
  { name: 'TECHNOLOGY',   etf: 'XLK',  weight: 29.3, stocks: ['AAPL','MSFT','NVDA','AVGO','ORCL','CSCO','AMD','INTC','CRM','QCOM'] },
  { name: 'HEALTHCARE',   etf: 'XLV',  weight: 12.2, stocks: ['UNH','LLY','JNJ','ABBV','MRK','TMO','ABT','DHR','BMY','AMGN'] },
  { name: 'FINANCIALS',   etf: 'XLF',  weight: 13.1, stocks: ['BRK-B','JPM','V','MA','BAC','WFC','GS','MS','AXP','BLK'] },
  { name: 'CONS DISC',    etf: 'XLY',  weight: 10.8, stocks: ['AMZN','TSLA','HD','MCD','NKE','SBUX','TJX','LOW','BKNG','CMG'] },
  { name: 'COMM SVC',     etf: 'XLC',  weight: 8.4,  stocks: ['META','GOOGL','NFLX','VZ','T','CMCSA','DIS','EA','PARA','WBD'] },
  { name: 'INDUSTRIALS',  etf: 'XLI',  weight: 8.8,  stocks: ['GE','CAT','RTX','HON','UNP','BA','LMT','MMM','UPS','ETN'] },
  { name: 'CONS STAPLES', etf: 'XLP',  weight: 5.9,  stocks: ['PG','COST','KO','PEP','WMT','PM','MO','CL','MDLZ','STZ'] },
  { name: 'ENERGY',       etf: 'XLE',  weight: 4.0,  stocks: ['XOM','CVX','COP','EOG','SLB','MPC','VLO','PSX','OXY','KMI'] },
  { name: 'REAL ESTATE',  etf: 'XLRE', weight: 2.5,  stocks: ['PLD','AMT','EQIX','CCI','SPG','O','WELL','DLR','AVB','EXR'] },
  { name: 'MATERIALS',    etf: 'XLB',  weight: 2.4,  stocks: ['LIN','APD','SHW','FCX','NEM','DOW','NUE','ALB','PPG','IP'] },
  { name: 'UTILITIES',    etf: 'XLU',  weight: 2.6,  stocks: ['NEE','SO','D','DUK','AEP','EXC','SRE','WEC','PPL','FE'] },
]

export async function GET() {
  const cacheKey = 'heatmap_all'
  const cached = await getCache(cacheKey)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })

  try {
    const allTickers = [...new Set([
      ...SECTORS.map(s => s.etf),
      ...SECTORS.flatMap(s => s.stocks.slice(0, 5)),
    ])]

    // Use chart-based quotes (no crumb needed — parallel query1 v8/finance/chart fetches)
    const quotes = await getQuotes(allTickers)

    const priceMap: Record<string, any> = {}
    quotes.forEach((q: any) => {
      if (q?.symbol) {
        priceMap[q.symbol] = {
          price:     q.regularMarketPrice || 0,
          change:    q.regularMarketChange || 0,
          changePct: q.regularMarketChangePercent || 0,
          volume:    q.regularMarketVolume || 0,
          marketCap: q.marketCap || 0,
        }
      }
    })

    const data = SECTORS.map(sector => ({
      name:    sector.name,
      etf:     sector.etf,
      weight:  sector.weight,
      etfData: priceMap[sector.etf] || null,
      stocks:  sector.stocks.slice(0, 5).map(sym => ({
        symbol: sym,
        ...(priceMap[sym] || { price: 0, changePct: 0, change: 0 }),
      })),
    }))

    await setCache(cacheKey, data, 120)
    return NextResponse.json({ data, source: 'live' })
  } catch (err: any) {
    if (cached) return NextResponse.json({ data: cached.data, source: 'stale' })
    return NextResponse.json({ error: err?.message || 'Fetch failed' })
  }
}
