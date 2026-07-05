import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'
import { fetchIndiaIndices, getIndianMarketStatus } from '@/lib/apis/india'
export async function GET() {
  const key    = 'india_indices'
  const cached = getCache(key)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cached' })

  try {
    const indices = await fetchIndiaIndices()
    const status  = getIndianMarketStatus()
    const ttl     = status === 'OPEN' ? 30 : 300
    const result  = { indices, marketStatus: status, fetchedAt: Date.now() }
    setCache(key, result, ttl)
    return NextResponse.json({ data: result, source: 'live' })
  } catch (err) {
    const fallback = getCache(key)
    if (fallback) return NextResponse.json({ data: fallback.data, source: 'stale' })
    return NextResponse.json({ error: String(err), data: { indices: [], marketStatus: 'CLOSED', fetchedAt: Date.now() }, source: 'empty' })
  }
}
