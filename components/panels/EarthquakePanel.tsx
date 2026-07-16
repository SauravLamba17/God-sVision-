'use client'
import { useEffect, useState } from 'react'
import PanelWrapper from './PanelWrapper'
import { magnitudeColor, timeAgo } from '@/lib/utils'

interface Earthquake {
  id: string
  magnitude: number
  place: string
  time: number
  depth: number
  tsunami: number
}

export default function EarthquakePanel({ limit = 5 }: { limit?: number }) {
  const [quakes, setQuakes] = useState<Earthquake[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState('live')

  const fetchData = async () => {
    try {
      const res = await fetch('/api/earthquakes?minMag=4.0')
      const json = await res.json()
      if (json.data) {
        setQuakes(json.data.slice(0, limit))
        setSource(json.source)
        setError(null)
      }
    } catch {
      setError('Failed to fetch earthquake data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 60000)
    return () => clearInterval(id)
  }, [])

  return (
    <PanelWrapper title="SEISMIC ACTIVITY" loading={loading} error={error} source={source} onRefresh={fetchData}>
      <div className="divide-y" style={{ borderColor: 'var(--border-dim)' }}>
        {quakes.map(q => (
          <div key={q.id} className="px-2 py-1.5 hover:bg-header">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="font-mono text-[12px] font-bold w-8 text-center"
                  style={{ color: magnitudeColor(q.magnitude) }}
                >
                  M{q.magnitude.toFixed(1)}
                </span>
                <div>
                  <p className="text-primary text-[11px] leading-tight">{q.place}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-muted text-[9px] font-mono">DEPTH: {q.depth.toFixed(0)}km</span>
                    {q.tsunami === 1 && (
                      <span className="text-negative text-[9px] font-mono animate-pulse">⚠ TSUNAMI</span>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-muted text-[9px] font-mono flex-shrink-0">{timeAgo(q.time)}</span>
            </div>
          </div>
        ))}
      </div>
    </PanelWrapper>
  )
}
