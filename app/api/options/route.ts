import { NextResponse } from 'next/server'
import yahooFinance from 'yahoo-finance2'
import { getCache, setCache } from '@/lib/cache'
import { blackScholes, daysToExpiry } from '@/lib/black-scholes'
import { getQuotes } from '@/lib/apis/yahoo'

const RISK_FREE_RATE = 0.05

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ticker = (searchParams.get('ticker') || 'AAPL').toUpperCase()
  const expiry = searchParams.get('expiry') || ''

  const cacheKey = `options_v2_${ticker}_${expiry}`
  const cached = getCache(cacheKey)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })

  try {
    // Get current spot price via chart (no crumb needed)
    const [spotQuotes, optData] = await Promise.allSettled([
      getQuotes([ticker]),
      (yahooFinance as any).options(ticker, expiry ? { date: expiry } : undefined),
    ])

    const spotPrice = spotQuotes.status === 'fulfilled' && spotQuotes.value.length > 0
      ? spotQuotes.value[0].regularMarketPrice
      : 0

    if (optData.status !== 'fulfilled') {
      // Options chain requires Yahoo crumb auth — return empty but valid response
      return NextResponse.json({
        data: { ticker, spotPrice, expiry: '', expiryDates: [], daysToExpiry: 0, calls: [], puts: [] },
        source: 'unavailable',
        message: 'Live options chain unavailable — Yahoo Finance auth required',
      })
    }

    const opts = optData.value
    const expiryDates = opts.expirationDates?.map((d: Date) => d.toISOString().slice(0, 10)) || []
    const currentExpiry = opts.expirationDates?.[0]?.toISOString().slice(0, 10) || ''
    const T = daysToExpiry(currentExpiry)

    const enrichContract = (c: any, type: 'call' | 'put') => {
      const mid = c.ask && c.bid ? (c.ask + c.bid) / 2 : c.lastPrice || 0
      const iv = c.impliedVolatility || 0.3
      const greeks = spotPrice > 0 && T > 0
        ? blackScholes(spotPrice, c.strike, T, RISK_FREE_RATE, iv, type)
        : null
      return {
        contractSymbol: c.contractSymbol,
        strike:         c.strike,
        lastPrice:      c.lastPrice,
        bid:            c.bid,
        ask:            c.ask,
        mid:            parseFloat(mid.toFixed(2)),
        change:         c.change,
        changePct:      c.percentChange,
        volume:         c.volume || 0,
        openInterest:   c.openInterest || 0,
        iv:             parseFloat(((iv) * 100).toFixed(1)),
        inTheMoney:     c.inTheMoney || false,
        delta:          greeks ? parseFloat(greeks.delta.toFixed(3)) : null,
        gamma:          greeks ? parseFloat(greeks.gamma.toFixed(4)) : null,
        theta:          greeks ? parseFloat(greeks.theta.toFixed(3)) : null,
        vega:           greeks ? parseFloat(greeks.vega.toFixed(3)) : null,
        rho:            greeks ? parseFloat(greeks.rho.toFixed(3)) : null,
      }
    }

    const calls = (opts.calls || []).map((c: any) => enrichContract(c, 'call'))
    const puts  = (opts.puts  || []).map((c: any) => enrichContract(c, 'put'))

    const data = { ticker, spotPrice, expiry: currentExpiry, expiryDates, daysToExpiry: Math.round(T * 365), calls, puts }
    setCache(cacheKey, data, 300)
    return NextResponse.json({ data, source: 'live' })
  } catch (err: any) {
    if (cached) return NextResponse.json({ data: cached.data, source: 'stale' })
    return NextResponse.json({ error: err?.message || 'Options data unavailable' })
  }
}
