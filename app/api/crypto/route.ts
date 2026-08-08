import { NextRequest, NextResponse } from 'next/server'
import { getCryptoTop100, getCryptoTrending, getGlobalMarket, getCoinChart, getFearGreed, getDeFiTVL, getBTCHalvingCountdown } from '@/lib/apis/coingecko'
import { setCache, getCache } from '@/lib/cache'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'top100'
  const coin = searchParams.get('coin') || 'bitcoin'
  const days = parseInt(searchParams.get('days') || '30')

  try {
    if (type === 'top100') {
      const key = 'crypto_top100'
      const cached = await getCache(key)
      if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cache' })
      const data = await getCryptoTop100()
      await setCache(key, data, 15)
      return NextResponse.json({ data, source: 'live' })
    }

    if (type === 'trending') {
      const key = 'crypto_trending'
      const cached = await getCache(key)
      if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cache' })
      const data = await getCryptoTrending()
      await setCache(key, data, 300)
      return NextResponse.json({ data, source: 'live' })
    }

    if (type === 'global') {
      const key = 'crypto_global'
      const cached = await getCache(key)
      if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cache' })
      const data = await getGlobalMarket()
      await setCache(key, data, 60)
      return NextResponse.json({ data, source: 'live' })
    }

    if (type === 'chart') {
      const key = `crypto_chart_${coin}_${days}`
      const cached = await getCache(key)
      if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cache' })
      const data = await getCoinChart(coin, days)
      await setCache(key, data, 300)
      return NextResponse.json({ data, source: 'live' })
    }

    if (type === 'feargreed') {
      const key = 'fear_greed'
      const cached = await getCache(key)
      if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cache' })
      const data = await getFearGreed()
      await setCache(key, data, 3600)
      return NextResponse.json({ data, source: 'live' })
    }

    if (type === 'defi') {
      const key = 'defi_tvl'
      const cached = await getCache(key)
      if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cache' })
      const data = await getDeFiTVL()
      await setCache(key, data, 600)
      return NextResponse.json({ data, source: 'live' })
    }

    if (type === 'halving') {
      return NextResponse.json({ data: getBTCHalvingCountdown(), source: 'live' })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg, data: [], source: 'empty' })
  }
}
