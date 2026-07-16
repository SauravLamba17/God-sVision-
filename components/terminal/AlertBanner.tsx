'use client'
import { useEffect, useState } from 'react'

interface Alert {
  id: string
  message: string
  type: 'breaking' | 'earthquake' | 'market'
}

export default function AlertBanner() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const eqRes = await fetch('/api/earthquakes?type=recent&minMag=6.0')
        const eqJson = await eqRes.json()
        const eqAlerts: Alert[] = (eqJson.data || []).slice(0, 3).map((q: {
          id: string; magnitude: number; place: string; tsunami: number
        }) => ({
          id: q.id,
          message: `⚠ EARTHQUAKE M${q.magnitude.toFixed(1)} — ${q.place}${q.tsunami ? ' — TSUNAMI WARNING' : ''}`,
          type: 'earthquake' as const
        }))
        setAlerts(eqAlerts)
      } catch {
        // silent
      }
    }
    fetchAlerts()
  }, [])

  useEffect(() => {
    if (alerts.length === 0) return
    const id = setInterval(() => setCurrent(c => (c + 1) % alerts.length), 5000)
    return () => clearInterval(id)
  }, [alerts.length])

  if (alerts.length === 0) return null

  const alert = alerts[current]
  return (
    <div
      className="fixed top-[68px] left-0 right-0 z-30 flex items-center justify-center h-5 font-mono text-[10px]"
      style={{
        background: alert.type === 'earthquake' ? 'var(--bg-buy)' : 'var(--bg-sell)',
        borderBottom: '1px solid var(--text-accent)',
        animation: 'pulse 2s ease-in-out infinite'
      }}
    >
      <span className="text-accent animate-pulse">{alert.message}</span>
    </div>
  )
}
