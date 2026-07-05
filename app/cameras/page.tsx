'use client'
import { useEffect, useState } from 'react'

interface CameraFeed {
  id: string
  title: string
  location: string
  timezone: string
  type: 'youtube' | 'image' | 'tfl'
  embedId?: string
  imageUrl?: string
  lat?: number
  lon?: number
}

const STATIC_CAMERAS: CameraFeed[] = [
  { id: 'iss', title: 'ISS EARTH VIEW', location: 'Low Earth Orbit', timezone: 'UTC', type: 'youtube', embedId: 'itDBSB6LBOY' },
  { id: 'nasa-tv', title: 'NASA TV LIVE', location: 'NASA HQ', timezone: 'America/New_York', type: 'youtube', embedId: '21X5lGlDOfg' },
  { id: 'nyc', title: 'TIMES SQUARE NYC', location: 'New York, USA', timezone: 'America/New_York', type: 'youtube', embedId: 'HBq1DWJjTkw' },
  { id: 'tokyo', title: 'SHIBUYA CROSSING', location: 'Tokyo, Japan', timezone: 'Asia/Tokyo', type: 'youtube', embedId: 'XXGNmlGYOso' },
  { id: 'dubai', title: 'DUBAI SKYLINE', location: 'Dubai, UAE', timezone: 'Asia/Dubai', type: 'youtube', embedId: 'Oq-2MH0gG4k' },
  { id: 'london', title: 'LONDON WESTMINSTER', location: 'London, UK', timezone: 'Europe/London', type: 'youtube', embedId: 'Lgd9mEE5e5o' },
]

function LocalClock({ timezone }: { timezone: string }) {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => {
      setTime(new Date().toLocaleTimeString('en-US', { timeZone: timezone, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [timezone])
  return <span className="font-mono text-[11px] text-positive">{time}</span>
}

function CameraCard({ cam }: { cam: CameraFeed }) {
  return (
    <div style={{ border: '1px solid #1b2e1b', background: 'var(--bg-terminal)' }}>
      <div className="panel-header">
        <span className="panel-header-title">{cam.title}</span>
        <LocalClock timezone={cam.timezone} />
      </div>
      <div className="font-mono text-[10px] text-muted px-2 py-1 border-b" style={{ borderColor: 'var(--border-dim)' }}>
        ðŸ“ {cam.location}
      </div>
      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
        {cam.type === 'youtube' && cam.embedId && (
          <iframe
            src={`https://www.youtube.com/embed/${cam.embedId}?autoplay=1&mute=1&controls=1&modestbranding=1`}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={cam.title}
          />
        )}
        {cam.type === 'image' && cam.imageUrl && (
          <img
            src={cam.imageUrl}
            alt={cam.title}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
      </div>
    </div>
  )
}

interface TfLCamera {
  id: string
  commonName: string
  additionalProperties: { key: string; value: string }[]
}

export default function CamerasPage() {
  const [tflCameras, setTflCameras] = useState<TfLCamera[]>([])
  const [tflImages, setTflImages] = useState<Record<string, string>>({})
  const [activeSection, setActiveSection] = useState<'global' | 'london'>('global')

  useEffect(() => {
    const fetchTfL = async () => {
      try {
        const res = await fetch('/api/webcams?type=tfl')
        const json = await res.json()
        if (json.data) {
          setTflCameras(json.data.slice(0, 12))
          const images: Record<string, string> = {}
          json.data.slice(0, 12).forEach((cam: TfLCamera) => {
            const imgProp = cam.additionalProperties?.find((p: { key: string; value: string }) => p.key === 'imageUrl')
            if (imgProp) images[cam.id] = imgProp.value
          })
          setTflImages(images)
        }
      } catch { /* silent */ }
    }
    fetchTfL()
    const id = setInterval(fetchTfL, 30000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="p-2">
      {/* Section Toggle */}
      <div className="flex gap-1 mb-2">
        <button
          onClick={() => setActiveSection('global')}
          className={`btn-terminal ${activeSection === 'global' ? 'active' : ''}`}
        >
          GLOBAL CAMERAS
        </button>
        <button
          onClick={() => setActiveSection('london')}
          className={`btn-terminal ${activeSection === 'london' ? 'active' : ''}`}
        >
          LONDON TfL CAMERAS
        </button>
      </div>

      {activeSection === 'global' && (
        <div className="grid grid-cols-2 gap-2">
          {STATIC_CAMERAS.map(cam => <CameraCard key={cam.id} cam={cam} />)}
        </div>
      )}

      {activeSection === 'london' && (
        <div>
          <div className="font-mono text-[10px] text-muted mb-2">
            LONDON TRAFFIC CAMERA NETWORK â€” TRANSPORT FOR LONDON API â€” AUTO-REFRESH: 30s
          </div>
          {tflCameras.length === 0 ? (
            <div className="text-center py-8">
              <span className="font-mono text-[11px] text-muted">
                TfL camera feeds require the API. Showing placeholder â€” enter your TfL App Key for live feeds.
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {tflCameras.map(cam => (
                <div key={cam.id} style={{ border: '1px solid #1b2e1b', background: 'var(--bg-terminal)' }}>
                  <div className="panel-header">
                    <span className="panel-header-title text-[9px]">{cam.commonName}</span>
                    <LocalClock timezone="Europe/London" />
                  </div>
                  {tflImages[cam.id] ? (
                    <img src={tflImages[cam.id]} alt={cam.commonName} style={{ width: '100%', display: 'block' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  ) : (
                    <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="text-muted font-mono text-[10px]">NO FEED</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
