'use client'
import { useEffect, useState, useCallback } from 'react'

interface Webcam {
  id: string
  title: string
  status: string
  location: { city: string; country: string; latitude: number; longitude: number }
  images: { current: { preview: string; thumbnail?: string } }
  player?: { day?: string; live?: string }
}

interface FeaturedStream {
  id: string
  title: string
  location: string
  timezone: string
  embedId: string
}

// Verified working YouTube live streams (checked against YouTube oembed) — kept small and
// curated on purpose, since embed IDs for "live" streams go dead over time.
const FEATURED_STREAMS: FeaturedStream[] = [
  { id: 'times-square', title: 'TIMES SQUARE NYC (4K)', location: 'New York, USA', timezone: 'America/New_York', embedId: 'rnXIjl_Rzy4' },
  { id: 'iss', title: 'ISS EARTH VIEW', location: 'Low Earth Orbit', timezone: 'UTC', embedId: 'H999s0P1Er0' },
  { id: 'nasa-tv', title: 'NASA TV LIVE', location: 'NASA HQ', timezone: 'America/New_York', embedId: '21X5lGlDOfg' },
]

interface TfLCamera {
  id: string
  commonName: string
  additionalProperties: { key: string; value: string }[]
}

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

function VideoModal({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        style={{ position: 'absolute', top: 20, right: 24, color: '#fff', fontSize: 24, background: 'none', border: 'none', cursor: 'pointer' }}
      >
        ✕
      </button>
      <div onClick={e => e.stopPropagation()} style={{ width: '80vw', height: '45vw', maxHeight: '80vh' }}>
        <iframe
          src={src}
          title={title}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  )
}

function FeaturedCard({ cam, onOpen }: { cam: FeaturedStream; onOpen: () => void }) {
  const [imgError, setImgError] = useState(false)
  return (
    <div
      onClick={onOpen}
      style={{ border: '1px solid var(--border-color)', background: 'var(--bg-panel)', borderRadius: 4, overflow: 'hidden', cursor: 'pointer' }}
    >
      <div className="panel-header">
        <span className="panel-header-title">{cam.title}</span>
        <LocalClock timezone={cam.timezone} />
      </div>
      <div className="font-mono text-[10px] text-muted px-2 py-1 border-b" style={{ borderColor: 'var(--border-dim)' }}>
        📍 {cam.location} · 📹 LIVE STREAM
      </div>
      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', background: '#000' }}>
        {imgError ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <span style={{ fontSize: 20, opacity: 0.5 }}>📵</span>
            <span className="text-muted font-mono text-[10px]">Feed unavailable</span>
          </div>
        ) : (
          <>
            <img
              src={`https://i.ytimg.com/vi/${cam.embedId}/hqdefault.jpg`}
              alt={cam.title}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() => setImgError(true)}
            />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18 }}>
                ▶
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function WebcamCard({ cam, onOpen }: { cam: Webcam; onOpen: () => void }) {
  const thumb = cam.images?.current?.preview || cam.images?.current?.thumbnail
  const [imgError, setImgError] = useState(false)
  return (
    <div
      onClick={onOpen}
      style={{ border: '1px solid var(--border-color)', background: 'var(--bg-panel)', borderRadius: 4, overflow: 'hidden', cursor: 'pointer' }}
    >
      <div className="panel-header">
        <span className="panel-header-title text-[10px]">{cam.title}</span>
      </div>
      <div className="font-mono text-[10px] text-muted px-2 py-1 border-b" style={{ borderColor: 'var(--border-dim)' }}>
        📍 {cam.location.city}{cam.location.country ? `, ${cam.location.country}` : ''} · 📸 SNAPSHOT
      </div>
      <div style={{ position: 'relative', height: 140, overflow: 'hidden', background: '#000' }}>
        {thumb && !imgError ? (
          <img
            src={thumb}
            alt={cam.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <span style={{ fontSize: 18, opacity: 0.5 }}>📷</span>
            <span className="text-muted font-mono text-[10px]">{imgError ? 'Feed unavailable' : 'NO PREVIEW'}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CamerasPage() {
  const [webcams, setWebcams] = useState<Webcam[]>([])
  const [webcamsLoading, setWebcamsLoading] = useState(true)
  const [webcamsSource, setWebcamsSource] = useState('')
  const [webcamsNotice, setWebcamsNotice] = useState('')
  const [tflCameras, setTflCameras] = useState<TfLCamera[]>([])
  const [tflImages, setTflImages] = useState<Record<string, string>>({})
  const [tflLastUpdated, setTflLastUpdated] = useState<number>(Date.now())
  const [tflTick, setTflTick] = useState(0)
  const [activeSection, setActiveSection] = useState<'global' | 'london'>('global')
  const [modal, setModal] = useState<{ src: string; title: string } | null>(null)

  useEffect(() => {
    const fetchWebcams = async () => {
      try {
        const res = await fetch('/api/webcams?type=all')
        const json = await res.json()
        if (json.data) {
          setWebcams(json.data)
          setWebcamsSource(json.source || '')
        }
        // Distinguish "key missing in this environment" from a real outage.
        setWebcamsNotice(json.message || json.error || '')
      } catch { /* silent */ }
      finally { setWebcamsLoading(false) }
    }
    fetchWebcams()
    const id = setInterval(fetchWebcams, 1800000)
    return () => clearInterval(id)
  }, [])

  const fetchTfL = useCallback(async () => {
    try {
      const res = await fetch('/api/webcams?type=tfl')
      const json = await res.json()
      if (json.data) {
        setTflCameras(json.data.slice(0, 12))
        const images: Record<string, string> = {}
        json.data.slice(0, 12).forEach((cam: TfLCamera) => {
          const imgProp = cam.additionalProperties?.find(p => p.key === 'imageUrl')
          if (imgProp) images[cam.id] = imgProp.value
        })
        setTflImages(images)
        setTflLastUpdated(Date.now())
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchTfL()
    const id = setInterval(fetchTfL, 60000)
    return () => clearInterval(id)
  }, [fetchTfL])

  // Re-render every second so "last updated Xs ago" stays live
  useEffect(() => {
    const id = setInterval(() => setTflTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const secondsAgo = Math.max(0, Math.round((Date.now() - tflLastUpdated) / 1000))

  const openFeatured = (cam: FeaturedStream) =>
    setModal({ src: `https://www.youtube.com/embed/${cam.embedId}?autoplay=1&mute=0&controls=1&modestbranding=1`, title: cam.title })

  const openWebcam = (cam: Webcam) => {
    if (cam.player?.day) setModal({ src: cam.player.day, title: cam.title })
  }

  return (
    <div className="p-2">
      {modal && <VideoModal src={modal.src} title={modal.title} onClose={() => setModal(null)} />}

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
        <div className="space-y-4">
          <div>
            <div className="font-mono text-[10px] text-muted mb-2">FEATURED LIVE STREAMS</div>
            <div className="grid grid-cols-3 gap-2">
              {FEATURED_STREAMS.map(cam => (
                <FeaturedCard key={cam.id} cam={cam} onOpen={() => openFeatured(cam)} />
              ))}
            </div>
          </div>

          <div>
            <div className="font-mono text-[10px] text-muted mb-2">
              WORLD WEBCAMS {webcamsSource === 'cache' ? '(cached)' : ''}
            </div>
            {webcamsLoading ? (
              <div className="text-center py-8">
                <span className="font-mono text-[11px] text-muted">Loading webcams...</span>
              </div>
            ) : webcams.length === 0 ? (
              <div className="text-center py-8">
                <span className="font-mono text-[11px] text-muted">
                  {webcamsNotice || 'No webcams available right now.'}
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {webcams.map(cam => (
                  <WebcamCard key={cam.id} cam={cam} onOpen={() => openWebcam(cam)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSection === 'london' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="font-mono text-[10px] text-muted">
              LONDON TRAFFIC CAMERA NETWORK — TRANSPORT FOR LONDON API · 📸 SNAPSHOT (updates every 30s)
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] text-neutral">Last updated: {secondsAgo}s ago</span>
              <button onClick={fetchTfL} className="btn-terminal text-[9px]">↻ Refresh</button>
            </div>
          </div>
          {tflCameras.length === 0 ? (
            <div className="text-center py-8">
              <span className="font-mono text-[11px] text-muted">
                TfL camera feeds require the API. Showing placeholder — enter your TfL App Key for live feeds.
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
                    <img
                      src={`${tflImages[cam.id]}?t=${tflLastUpdated}`}
                      alt={cam.commonName}
                      style={{ width: '100%', display: 'block' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
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
