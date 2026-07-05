import { NextRequest, NextResponse } from 'next/server'
import { getTopWebcams, getTfLCameras } from '@/lib/apis/windy'
import { setCache, getCache } from '@/lib/cache'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'all'

  const key = `webcams_${type}`
  const cached = getCache(key)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cache' })

  try {
    if (type === 'tfl') {
      const data = await getTfLCameras()
      setCache(key, data, 300)
      return NextResponse.json({ data, source: 'live' })
    }

    const data = await getTopWebcams(20)
    setCache(key, data, 1800)
    return NextResponse.json({ data, source: 'live' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    if (cached) return NextResponse.json({ data: cached.data, source: 'cached', error: msg })
    return NextResponse.json({ error: msg, data: [] }, { status: 200 })
  }
}
