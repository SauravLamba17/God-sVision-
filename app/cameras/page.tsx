'use client'
import { useEffect, useRef, useState } from 'react'
import { SOURCES, type CameraSource, type Region } from '@/lib/cameras/catalog'
import type { CameraView } from '@/lib/cameras/probe'

// Only cameras /api/cameras has just verified: live broadcaster streams and
// official still images with their capture time. Anything dead or stale is
// simply absent, and a card whose image fails to load removes itself.

const REFRESH_MS = 90_000
const REGION_ORDER: Region[] = ['Americas', 'Europe', 'Middle East', 'Asia', 'Orbit']

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
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close video"
        style={{ position: 'absolute', top: 20, right: 24, color: 'var(--text)', fontSize: 24, background: 'none', border: 'none', cursor: 'pointer' }}
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

const ago = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)} min ago`
}

// Fixed-URL sources keep the same address for each new image: bust the browser cache per capture.
const imageSrc = (c: CameraView) => (c.source === 'lta' ? c.image! : `${c.image}${c.image!.includes('?') ? '&' : '?'}t=${c.capturedAt}`)

function useOnScreen(ref: React.RefObject<Element>) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { rootMargin: '100px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return on
}

function CameraCard({ cam, now, onOpen }: { cam: CameraView; now: number; onOpen: (c: CameraView) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const onScreen = useOnScreen(ref)
  const [failed, setFailed] = useState(false)
  // The image actually displayed: swapped for a newer capture only while the card is on screen.
  const [shown, setShown] = useState<{ src: string; at: number } | null>(null)
  useEffect(() => {
    if (cam.kind === 'image' && onScreen && cam.capturedAt && cam.capturedAt !== shown?.at) {
      setShown({ src: imageSrc(cam), at: cam.capturedAt })
    }
  }, [cam, onScreen, shown?.at])

  if (failed) return null
  const video = cam.kind === 'video'
  const credit = video ? cam.channel : SOURCES[cam.source].name
  return (
    <div
      ref={ref}
      onClick={video ? () => onOpen(cam) : undefined}
      className="gv-card"
      style={{ overflow: 'hidden', cursor: video ? 'pointer' : 'default' }}
    >
      <div className="panel-header">
        <span className="panel-header-title">{cam.title}</span>
        <LocalClock timezone={cam.timezone} />
      </div>
      <div className="font-mono text-[10px] text-muted px-2 py-1 border-b flex flex-wrap items-center justify-between gap-x-2" style={{ borderColor: 'var(--border-dim)' }}>
        <span>📍 {cam.city}, {cam.country} · {credit}</span>
        {video
          ? <span className="shrink-0 font-bold text-positive">● LIVE</span>
          : <span className="shrink-0" title={shown ? `Captured ${new Date(shown.at).toLocaleString()}` : undefined}>{shown ? `Image · ${ago(now - shown.at)}` : 'Image'}</span>}
      </div>
      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', background: '#000' }}>
        {video ? (
          <>
            <img
              src={`https://i.ytimg.com/vi/${cam.ref}/hqdefault.jpg`}
              alt={cam.title}
              loading="lazy"
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() => setFailed(true)}
            />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18 }}>
                ▶
              </div>
            </div>
          </>
        ) : shown && (
          <img
            src={shown.src}
            alt={`${cam.title}, ${cam.city} — ${SOURCES[cam.source].name} camera`}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setFailed(true)}
          />
        )}
      </div>
    </div>
  )
}

function Attribution({ cams }: { cams: CameraView[] }) {
  const sources = [...new Set(cams.map(c => c.source))] as CameraSource[]
  if (!sources.length) return null
  return (
    <div className="font-mono text-[10px] text-muted mt-3 space-y-1">
      {sources.map(s => (
        <div key={s}>
          {SOURCES[s].attribution}
          {SOURCES[s].licenceUrl && <> · <a href={SOURCES[s].licenceUrl} target="_blank" rel="noopener noreferrer">licence</a></>}
        </div>
      ))}
    </div>
  )
}

export default function CamerasPage() {
  const [cameras, setCameras] = useState<CameraView[] | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [activeSection, setActiveSection] = useState<'global' | 'london'>('global')
  const [modal, setModal] = useState<{ src: string; title: string } | null>(null)

  // Refresh the list every 90 s, only while the tab is visible.
  useEffect(() => {
    let alive = true
    const load = () => {
      if (document.visibilityState !== 'visible') return
      fetch('/api/cameras')
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then(j => { if (alive && Array.isArray(j.cameras)) setCameras(j.cameras) })
        .catch(() => { if (alive) setCameras(c => c ?? []) })
    }
    load()
    const id = setInterval(load, REFRESH_MS)
    document.addEventListener('visibilitychange', load)
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', load) }
  }, [])

  // Re-render every second so "Image · Xs ago" stays current.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const openVideo = (cam: CameraView) =>
    setModal({ src: `https://www.youtube.com/embed/${cam.ref}?autoplay=1&mute=0&controls=1&modestbranding=1`, title: cam.title })

  const inSet = (cameras ?? []).filter(c => c.sets.includes(activeSection))
  const videos = inSet.filter(c => c.kind === 'video')
  const images = inSet.filter(c => c.kind === 'image')
    .sort((a, b) => REGION_ORDER.indexOf(a.region) - REGION_ORDER.indexOf(b.region))
  const grid = (list: CameraView[], cols: string) => (
    <div className={`grid ${cols} gap-2`}>
      {list.map(cam => <CameraCard key={cam.id} cam={cam} now={now} onOpen={openVideo} />)}
    </div>
  )
  const empty = (msg: string) => (
    <div className="text-center py-8"><span className="font-mono text-[11px] text-muted">{msg}</span></div>
  )

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

      {cameras === null ? empty('Checking camera feeds…') : activeSection === 'global' ? (
        <div className="space-y-4">
          <div>
            <div className="font-mono text-[10px] text-muted mb-2">LIVE STREAMS — VERIFIED LIVE BROADCASTS</div>
            {videos.length ? grid(videos, 'grid-cols-3') : empty('No verified live streams right now.')}
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted mb-2">CITY CAMERAS — OFFICIAL TRAFFIC &amp; WEATHER CAMERAS · IMAGES REFRESH WHILE ON SCREEN</div>
            {images.length ? grid(images, 'grid-cols-4') : empty('No current camera images right now.')}
          </div>
          <Attribution cams={inSet} />
        </div>
      ) : (
        <div>
          <div className="font-mono text-[10px] text-muted mb-2">
            LONDON TRAFFIC CAMERA NETWORK — TRANSPORT FOR LONDON JAMCAMS · IMAGES REFRESH WHILE ON SCREEN
          </div>
          {images.length ? grid(images, 'grid-cols-3') : empty('No current London camera images right now.')}
          <Attribution cams={inSet} />
        </div>
      )}
    </div>
  )
}
