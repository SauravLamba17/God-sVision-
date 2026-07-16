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

export async function getTopWebcams(limit = 20): Promise<Webcam[]> {
  if (!KEY) return getStaticWebcams()
  try {
    const { data } = await axios.get(`${BASE}/webcams`, {
      params: { lang: 'en', limit, offset: 0, orderby: 'popularity', include: 'images,player,location' },
      headers: { 'x-windy-api-key': KEY },
      timeout: 10000
    })
    const webcams = (data.webcams || []) as any[]
    return webcams
      .filter(w => w.status === 'active')
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
  } catch {
    return getStaticWebcams()
  }
}

function getStaticWebcams(): Webcam[] {
  return [
    { id: '1', title: 'Times Square NYC', status: 'active', location: { city: 'New York', country: 'USA', latitude: 40.758, longitude: -73.985 }, images: { current: { preview: '' } } },
    { id: '2', title: 'Shibuya Crossing', status: 'active', location: { city: 'Tokyo', country: 'Japan', latitude: 35.659, longitude: 139.700 }, images: { current: { preview: '' } } },
    { id: '3', title: 'Eiffel Tower', status: 'active', location: { city: 'Paris', country: 'France', latitude: 48.858, longitude: 2.294 }, images: { current: { preview: '' } } },
    { id: '4', title: 'Dubai Skyline', status: 'active', location: { city: 'Dubai', country: 'UAE', latitude: 25.197, longitude: 55.274 }, images: { current: { preview: '' } } },
    { id: '5', title: 'Sydney Harbour', status: 'active', location: { city: 'Sydney', country: 'Australia', latitude: -33.858, longitude: 151.214 }, images: { current: { preview: '' } } },
    { id: '6', title: 'London Eye', status: 'active', location: { city: 'London', country: 'UK', latitude: 51.503, longitude: -0.119 }, images: { current: { preview: '' } } },
  ]
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
