'use client'
import { useEffect, useState } from 'react'

interface ISSData {
  position: { lat: number; lng: number; altitude: number; velocity: number } | null
  astronauts: { name: string; craft: string }[] | null
}

export default function ISSTracker() {
  const [data, setData] = useState<ISSData | null>(null)
  const [orbitCount, setOrbitCount] = useState(0)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    // ISS completes ~15.5 orbits per day
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const msElapsed = Date.now() - startOfDay.getTime()
    setOrbitCount(Math.floor(msElapsed / (92.5 * 60 * 1000)))

    const fetchISS = async () => {
      try {
        const res = await fetch('/api/iss')
        const j = await res.json()
        if (j.data) { setData(j.data); setLastUpdate(new Date()); setFailed(false) }
        else setFailed(true)
      } catch { setFailed(true) }
    }
    fetchISS()
    const id = setInterval(fetchISS, 60000)
    return () => clearInterval(id)
  }, [])

  const pos = data?.position ?? null
  const crew = data?.astronauts ?? null
  const loaded = !!data || failed

  return (
    <div style={{ padding:'12px 16px' }}>
      {/* Position */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
        {[
          { label:'LATITUDE',  value: pos ? `${pos.lat.toFixed(3)}°` : '—' },
          { label:'LONGITUDE', value: pos ? `${pos.lng.toFixed(3)}°` : '—' },
          { label:'ALTITUDE',  value: pos ? `${pos.altitude} km` : '—' },
          { label:'VELOCITY',  value: pos ? `${pos.velocity.toLocaleString()} km/h` : '—' },
          { label:'ORBIT #',   value: `${orbitCount} today` },
          { label:'CREW',      value: crew ? `${crew.length} aboard` : '—' },
        ].map(item => (
          <div key={item.label}>
            <div style={{ fontSize:'var(--fs-meta)', color:'var(--text-muted)', letterSpacing:'0.08em' }}>{item.label}</div>
            <div style={{ fontSize:'var(--fs-body)', color:'var(--text-primary)', marginTop:1 }}>{item.value}</div>
          </div>
        ))}
      </div>

      {loaded && !pos && (
        <div style={{ fontSize:'var(--fs-meta)', color:'var(--text-warning)', marginBottom:6 }}>
          ISS position unavailable — tracking feed unreachable
        </div>
      )}

      {/* ISS position dot visualization */}
      <div style={{ position:'relative', height:60, background:'var(--surface-2)', border:'var(--bw) solid var(--border)', borderRadius:'var(--radius-inner)', overflow:'hidden', marginBottom:8 }}>
        <svg width="100%" height="60" viewBox="0 0 300 60">
          {/* Globe outline */}
          <rect x="0" y="0" width="300" height="60" fill="var(--surface-2)" />
          {/* Latitude lines */}
          {[-30,0,30].map(lat => (
            <line key={lat} x1="0" x2="300" y1={30 - lat * 0.5} y2={30 - lat * 0.5} stroke="var(--border)" strokeWidth="0.5" />
          ))}
          {/* Longitude lines */}
          {[-120,-60,0,60,120].map(lng => (
            <line key={lng} x1={(lng + 180) * 300 / 360} y1="0" x2={(lng + 180) * 300 / 360} y2="60" stroke="var(--border)" strokeWidth="0.5" />
          ))}
          {/* ISS position */}
          {pos && (
            <>
              <circle
                cx={(pos.lng + 180) * 300 / 360}
                cy={30 - pos.lat * 0.5}
                r="4"
                fill="var(--accent)"
                opacity="0.9"
              />
              <circle
                cx={(pos.lng + 180) * 300 / 360}
                cy={30 - pos.lat * 0.5}
                r="8"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1"
                opacity="0.4"
              />
            </>
          )}
        </svg>
      </div>

      {/* Crew list */}
      <div style={{ fontSize:'var(--fs-meta)', color:'var(--text-muted)', marginBottom:3 }}>CREW ABOARD ISS:</div>
      {crew ? (
        <>
          {crew.slice(0, 6).map(a => (
            <div key={a.name} style={{ fontSize:'var(--fs-body)', color:'var(--text-secondary)', lineHeight:1.6 }}>• {a.name}</div>
          ))}
          {crew.length > 6 && <div style={{ fontSize:'var(--fs-meta)', color:'var(--text-muted)' }}>+{crew.length - 6} more</div>}
        </>
      ) : loaded && (
        <div style={{ fontSize:'var(--fs-body)', color:'var(--text-muted)' }}>Crew data unavailable</div>
      )}

      {lastUpdate && (
        <div style={{ fontSize:'var(--fs-meta)', color:'var(--text-muted)', marginTop:6 }}>
          Updated {lastUpdate.toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}
