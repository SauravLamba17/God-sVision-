// Is each camera current right now? Shared by /api/cameras (every minute, cached)
// and the daily health check (scripts/camera-health.ts). Built-in fetch only.
import { SOURCES, type CameraDef, type CameraSource } from './catalog.ts'

export interface CameraImage { image: string; capturedAt: number }
export interface CameraView extends CameraDef { kind: 'video' | 'image'; image?: string; capturedAt?: number }

const UA = 'GodsVision/1.0 (camera page)'
// no-store: inside Next a plain fetch() goes through its data cache, which served
// build-time capture times as current.
const get = (url: string, init: RequestInit = {}) =>
  fetch(url, { ...init, cache: 'no-store', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': UA, ...(init.headers as Record<string, string>) } })

// HK TD serves a yellow "No Service" JPEG (5,892 bytes) in place of a down camera, with a
// fresh Last-Modified. ponytail: exact-size match; switch to a content hash if TD changes the image.
const HK_NO_SERVICE_BYTES = '5892'

/** Fixed-URL image: capture time is the object's Last-Modified (TfL S3, HK TD, Caltrans). */
async function byLastModified(url: string): Promise<CameraImage | null> {
  const r = await get(url, { method: 'HEAD' })
  if (url.includes('tdcctv.data.one.gov.hk') && r.headers.get('content-length') === HK_NO_SERVICE_BYTES) return null
  const t = Date.parse(r.headers.get('last-modified') ?? '')
  // HK may redirect (its terms say follow it); show the final URL.
  return r.ok && Number.isFinite(t) ? { image: r.url || url, capturedAt: t } : null
}

/** Singapore LTA: one call lists every camera with its image URL and timestamp. */
async function ltaImages(): Promise<Record<string, CameraImage>> {
  const r = await get('https://api.data.gov.sg/v1/transport/traffic-images')
  const cams: any[] = (await r.json())?.items?.[0]?.cameras ?? []
  return Object.fromEntries(cams.flatMap(c => {
    const t = Date.parse(c.timestamp)
    return c.image && Number.isFinite(t) ? [[String(c.camera_id), { image: c.image, capturedAt: t }]] : []
  }))
}

/** Digitraffic: the station's data endpoint gives each preset's measuredTime. */
async function digitrafficImage(preset: string): Promise<CameraImage | null> {
  const r = await get(`https://tie.digitraffic.fi/api/weathercam/v1/stations/${preset.slice(0, 6)}/data`, { headers: { 'Digitraffic-User': UA } })
  const p = ((await r.json())?.presets ?? []).find((x: any) => x.id === preset)
  const t = Date.parse(p?.measuredTime ?? '')
  return Number.isFinite(t) ? { image: `https://weathercam.digitraffic.fi/${preset}.jpg`, capturedAt: t } : null
}

/** Latest image + capture time for every image camera that answers (failures are just absent). */
export async function probeImages(cams: CameraDef[]): Promise<Record<string, CameraImage>> {
  const images = cams.filter(c => c.source !== 'youtube')
  const lta = images.some(c => c.source === 'lta') ? ltaImages().catch(() => ({} as Record<string, CameraImage>)) : null
  const out: Record<string, CameraImage> = {}
  await Promise.allSettled(images.map(async c => {
    const img = c.source === 'lta' ? (await lta!)[c.ref] ?? null
      : c.source === 'digitraffic' ? await digitrafficImage(c.ref)
      : await byLastModified(c.ref)
    if (img) out[c.id] = img
  }))
  return out
}

/** Fresh = captured within the source's normal update window (and not in the future). */
export function isFresh(source: CameraSource, capturedAt: number, now = Date.now()): boolean {
  return capturedAt <= now + 2 * 60_000 && now - capturedAt <= SOURCES[source].maxAgeMin * 60_000
}

/** YouTube Data API (1 quota unit per call): live now and embeddable. */
export async function youtubeLiveByApi(ids: string[], key: string): Promise<Record<string, boolean>> {
  const r = await get(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${ids.join(',')}&key=${encodeURIComponent(key)}`)
  if (!r.ok) throw new Error(`YouTube API ${r.status}`)
  const items: any[] = (await r.json()).items ?? []
  return Object.fromEntries(ids.map(id => {
    const v = items.find(i => i.id === id)
    return [id, v?.snippet?.liveBroadcastContent === 'live' && v?.status?.embeddable === true]
  }))
}

/** No key: the public watch page says whether it is live now and embeddable.
 *  `inconclusive` = YouTube served a bot check / consent page instead of the video. */
export async function youtubeLiveByPage(id: string): Promise<{ live: boolean; reason: string; inconclusive?: boolean }> {
  const r = await get(`https://www.youtube.com/watch?v=${id}`, { headers: { 'Accept-Language': 'en' } })
  const html = await r.text()
  const status = html.match(/"playabilityStatus":\{"status":"([A-Z_]+)"/)?.[1] ?? 'UNKNOWN'
  const why = html.match(/"playabilityStatus":\{[^}]*?"reason":"([^"]+)"/)?.[1] ?? ''
  const liveNow = /"isLiveNow":true/.test(html)
  const embeddable = /"playableInEmbed":true/.test(html)
  if (!r.ok || status === 'UNKNOWN' || /not a bot|consent/i.test(why)) return { live: false, reason: `inconclusive (${r.status} ${status})`, inconclusive: true }
  if (status !== 'OK') return { live: false, reason: `not playable (${why || status})` }
  if (!liveNow) return { live: false, reason: 'not live now (ended or replay)' }
  if (!embeddable) return { live: false, reason: 'embedding disabled' }
  return { live: true, reason: 'live' }
}
