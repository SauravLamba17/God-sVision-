import { NextRequest, NextResponse } from 'next/server'
import { getTopWebcams, getTfLCameras, WindyNotConfiguredError } from '@/lib/apis/windy'
import { setCache, getCache } from '@/lib/cache'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'all'

  const key = `webcams_${type}`
  const cached = await getCache(key)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cache' })

  try {
    if (type === 'tfl') {
      const data = await getTfLCameras()
      await setCache(key, data, 300)
      return NextResponse.json({ data, source: 'live' })
    }

    const data = await getTopWebcams(20)
    await setCache(key, data, 1800)
    return NextResponse.json({ data, source: 'live' })
  } catch (error) {
    // A missing key is a deployment problem, not an outage — say which, so the
    // page can tell the user what to actually do about it instead of showing a
    // generic "no webcams" that looks like the feature is broken.
    if (error instanceof WindyNotConfiguredError) {
      return NextResponse.json({
        data: [],
        configured: false,
        message: 'Webcam feed not configured — WINDY_WEBCAM_KEY is missing in this environment',
      })
    }

    const msg = error instanceof Error ? error.message : 'Unknown error'
    if (cached) return NextResponse.json({ data: cached.data, source: 'cached', error: msg })
    return NextResponse.json({ error: msg, data: [] }, { status: 200 })
  }
}
