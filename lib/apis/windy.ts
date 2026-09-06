import axios from 'axios'

const KEY = process.env.WINDY_WEBCAM_KEY || ''
const BASE = 'https://api.windy.com/webcams/api/v3'

export interface Webcam {
  id: string
  title: string
  status: string
  location: { city: string; country: string; latitude: number; longitude: number }
  images: { current: { preview: string; thumbnail?: string } }
  player?: { day?: string; live?: string }
}

/** Thrown when WINDY_WEBCAM_KEY is absent, so the caller can say so honestly. */
export class WindyNotConfiguredError extends Error {
  constructor() {
    super('WINDY_WEBCAM_KEY is not set')
    this.name = 'WindyNotConfiguredError'
  }
}

export async function getTopWebcams(limit = 20): Promise<Webcam[]> {
  // Previously this fell back to six hardcoded entries ("Times Square NYC",
  // "Shibuya Crossing", ...) that carried real coordinates but an empty image
  // URL — they rendered as six grey "NO PREVIEW" tiles that looked like broken
  // cameras rather than a missing key. They were fabricated data; the honest
  // signal is to say the key is missing.
  if (!KEY) throw new WindyNotConfiguredError()

  // Errors propagate: a real upstream failure is not the same as an
  // unconfigured key, and the route needs to tell them apart.
  const { data } = await axios.get(`${BASE}/webcams`, {
    params: { lang: 'en', limit, offset: 0, orderby: 'popularity', include: 'images,player,location' },
    headers: { 'x-windy-api-key': KEY },
    timeout: 10000
  })

  return ((data.webcams || []) as any[])
    .filter(w => w.status === 'active')
    // A tile with no image is indistinguishable from a broken camera, so drop
    // them here rather than rendering an empty placeholder card.
    .filter(w => w.images?.current?.preview || w.images?.current?.thumbnail)
    .map(w => ({
      id: String(w.webcamId),
      title: w.title,
      status: w.status,
      location: {
        city: w.location?.city || '',
        country: w.location?.country || '',
        latitude: w.location?.latitude,
        longitude: w.location?.longitude,
      },
      images: {
        current: {
          preview: w.images?.current?.preview || '',
          thumbnail: w.images?.current?.thumbnail || '',
        },
      },
      player: { day: w.player?.day, live: w.player?.live },
    }))
}


export async function getTfLCameras() {
  try {
    const { data } = await axios.get('https://api.tfl.gov.uk/Place/Type/JamCam', {
      params: { app_id: '', app_key: '' },
      headers: { 'User-Agent': 'GodVision/1.0' },
      timeout: 10000
    })
    return (data || []).slice(0, 12)
  } catch {
    return []
  }
}
