import { NextResponse } from 'next/server'
import yahooFinance from 'yahoo-finance2'
import { getCache, setCache } from '@/lib/cache'
import { blackScholes, daysToExpiry } from '@/lib/black-scholes'
import { getQuotes } from '@/lib/apis/yahoo'

// Fallback only. The live 3-month T-bill (^IRX) is the standard risk-free
// proxy and is fetched below; this is used only if that quote fails, and the
// response says which one was applied.
const RISK_FREE_FALLBACK = 0.05
const IRX = '^IRX'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ticker = (searchParams.get('ticker') || 'AAPL').toUpperCase()
  const expiry = searchParams.get('expiry') || ''

  const cacheKey = `options_v2_${ticker}_${expiry}`
  const cached = await getCache(cacheKey)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })

  try {
    // Get current spot price via chart (no crumb needed)
    const [spotQuotes, optData] = await Promise.allSettled([
      getQuotes([ticker, IRX]),
      (yahooFinance as any).options(ticker, expiry ? { date: expiry } : undefined),
    ])

    const quoteList: any[] = spotQuotes.status === 'fulfilled' ? spotQuotes.value : []
    const spotPrice = quoteList.find(q => q?.symbol === ticker)?.regularMarketPrice ?? 0

    // ^IRX is quoted in percent (e.g. 3.978 = 3.978%).
    const irx = quoteList.find(q => q?.symbol === IRX)?.regularMarketPrice
    const riskFreeLive = typeof irx === 'number' && Number.isFinite(irx) && irx > 0
    const riskFreeRate = riskFreeLive ? irx / 100 : RISK_FREE_FALLBACK
    const riskFreeSource = riskFreeLive
      ? `3M T-Bill (^IRX) ${irx.toFixed(3)}%`
      : `assumed ${(RISK_FREE_FALLBACK * 100).toFixed(2)}% — live ^IRX unavailable`

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
      // Yahoo omits impliedVolatility on thin contracts. Substituting a flat 30%
      // silently changed every Greek for that strike, with nothing in the
      // response saying so — ivEstimated now marks those rows.
      const ivRaw = c.impliedVolatility
      const ivEstimated = !(typeof ivRaw === 'number' && Number.isFinite(ivRaw) && ivRaw > 0)
      const iv = ivEstimated ? 0.3 : ivRaw
      const greeks = spotPrice > 0 && T > 0
        ? blackScholes(spotPrice, c.strike, T, riskFreeRate, iv, type)
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
        ivEstimated,
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

    const data = {
      ticker, spotPrice, expiry: currentExpiry, expiryDates,
      daysToExpiry: Math.round(T * 365), calls, puts,
      // Disclosure surfaced by the page: Greeks are model output, not
      // exchange-quoted values.
      greeksModel: 'Black-Scholes',
      riskFreeRate: parseFloat((riskFreeRate * 100).toFixed(3)),
      riskFreeSource,
    }
    await setCache(cacheKey, data, 300)
    return NextResponse.json({ data, source: 'live' })
  } catch (err: any) {
    if (cached) return NextResponse.json({ data: cached.data, source: 'stale' })
    return NextResponse.json({ error: err?.message || 'Options data unavailable' })
  }
}
