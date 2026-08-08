import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'

const INDIA_CRYPTO_IDS = [
  'bitcoin','ethereum','matic-network','solana','ripple',
  'cardano','dogecoin','shiba-inu','chainlink','polkadot',
  'binancecoin','avalanche-2','uniswap','tron',
]

const LABELS: Record<string, string> = {
  'bitcoin': 'BTC', 'ethereum': 'ETH', 'matic-network': 'MATIC',
  'solana': 'SOL', 'ripple': 'XRP', 'cardano': 'ADA',
  'dogecoin': 'DOGE', 'shiba-inu': 'SHIB', 'chainlink': 'LINK',
  'polkadot': 'DOT', 'binancecoin': 'BNB', 'avalanche-2': 'AVAX',
  'uniswap': 'UNI', 'tron': 'TRX',
}

const INDIAN_PROJECTS: Record<string, boolean> = { 'matic-network': true }

export async function GET() {
  const key    = 'india_crypto_inr'
  const cached = await getCache(key)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })

  try {
    const ids = INDIA_CRYPTO_IDS.join(',')
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=inr,usd&include_24hr_change=true&include_market_cap=true`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })

    if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
    const raw = await res.json() as Record<string, {
      inr?: number; usd?: number;
      inr_24h_change?: number;
      inr_market_cap?: number;
    }>

    const coins = INDIA_CRYPTO_IDS.map(id => ({
      id, symbol: LABELS[id] || id.toUpperCase(),
      priceINR:  raw[id]?.inr  ?? 0,
      priceUSD:  raw[id]?.usd  ?? 0,
      change24h: raw[id]?.inr_24h_change ?? 0,
      marketCapINR: raw[id]?.inr_market_cap ?? 0,
      isIndianProject: INDIAN_PROJECTS[id] ?? false,
    })).filter(c => c.priceINR > 0)

    const result = { coins, fetchedAt: Date.now() }
    await setCache(key, result, 15)
    return NextResponse.json({ data: result, source: 'live' })
  } catch (err) {
    const fallback = await getCache(key)
    if (fallback) return NextResponse.json({ data: fallback.data, source: 'stale' })
    return NextResponse.json({ error: String(err) })
  }
}
