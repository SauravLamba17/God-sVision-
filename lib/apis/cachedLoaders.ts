import 'server-only'
// Server-only cache-backed loaders for modules that client components also
// import (india.ts for market status/constants, and yahoo.ts through it), so
// lib/cache never reaches the browser bundle.
import { readThrough } from '@/lib/cache'
import { fetchNifty50Quotes, fetchIndiaIndices, fetchIndiaForex, getUsdInr, getIndianMarketStatus } from '@/lib/apis/india'
import { getMarketMovers } from '@/lib/apis/yahoo'

// ── Cached loaders shared by the India routes and the evidence engine ────────
const indiaTtl = () => (getIndianMarketStatus() === 'OPEN' ? 30 : 300)

/** All Nifty 50 quotes with a usable price and % change. */
export async function getNifty50QuotesCached() {
  return readThrough('nifty50_quotes', indiaTtl, async () => {
    const quotes = (await fetchNifty50Quotes()).filter(q => Number.isFinite(q.price) && Number.isFinite(q.changePct))
    if (quotes.length === 0) throw new Error('No Nifty 50 quotes')
    return { quotes, marketStatus: getIndianMarketStatus(), fetchedAt: Date.now() }
  })
}

export async function getIndiaIndicesCached() {
  return readThrough('india_indices', indiaTtl, async () => ({
    indices: await fetchIndiaIndices(), marketStatus: getIndianMarketStatus(), fetchedAt: Date.now(),
  }))
}

export async function getIndiaForexCached() {
  return readThrough('india_forex', 60, async () => {
    const usdInr = await getUsdInr()
    return { pairs: await fetchIndiaForex(usdInr), usdInr, fetchedAt: Date.now() }
  })
}

// US day gainers/losers, cached under the key /api/stocks?type=movers has always
// used — shared with the evidence engine.
export async function getMarketMoversCached() {
  return readThrough('market_movers', 60, getMarketMovers)
}
