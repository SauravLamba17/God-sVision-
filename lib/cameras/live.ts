import 'server-only'
import { readThrough } from '@/lib/cache'
import health from '@/data/camera-health.json'
import { CAMERAS } from './catalog'
import { probeImages, isFresh, youtubeLiveByApi, type CameraView } from './probe'

// The cameras the page may show right now. Hidden when the daily health check
// marked them dead, when an image is older than its source's update window, or
// (with YOUTUBE_API_KEY) when a stream is no longer live. Cached 60 s so a page
// full of viewers costs one probe round a minute.

const HIDDEN = new Set(Object.keys((health as { hidden: Record<string, string> }).hidden))

async function youtubeLive(): Promise<Record<string, boolean> | null> {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) return null
  const ids = CAMERAS.filter(c => c.source === 'youtube').map(c => c.ref)
  // 15-minute cache: ~96 calls/day, 1 quota unit each (free quota is 10,000/day).
  return (await readThrough('youtube_live', 900, () => youtubeLiveByApi(ids, key)).catch(() => null))?.data ?? null
}

export async function getCameraViews(): Promise<{ cameras: CameraView[]; checkedAt: number }> {
  const { data } = await readThrough('cameras_v1', 60, async () => {
    const candidates = CAMERAS.filter(c => !HIDDEN.has(c.id))
    const [images, live] = await Promise.all([probeImages(candidates), youtubeLive()])
    const now = Date.now()
    const cameras: CameraView[] = candidates.flatMap((c): CameraView[] => {
      if (c.source === 'youtube') return live && live[c.ref] === false ? [] : [{ ...c, kind: 'video' as const }]
      const img = images[c.id]
      return img && isFresh(c.source, img.capturedAt, now) ? [{ ...c, kind: 'image' as const, ...img }] : []
    })
    return { cameras, checkedAt: now }
  })
  return data
}
