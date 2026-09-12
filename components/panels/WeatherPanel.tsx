'use client'
import { useEffect, useState, useCallback } from 'react'
import PanelWrapper from './PanelWrapper'
import { getWeatherEmoji } from '@/lib/apis/openweather'
import { AQI_COLORS, AQI_LABELS, type CityAqi } from '@/lib/apis/airQuality'
import { useMode } from '@/lib/context/ModeContext'

interface CityWeather {
  city: string
  temp: number       // °F from API
  feelsLike: number  // °F from API
  humidity: number
  windSpeed: number
  description: string
  icon: string
}

interface WeatherPanelProps {
  tempUnit?: 'C' | 'F'
  onTempUnitChange?: (u: 'C' | 'F') => void
}

export default function WeatherPanel({ tempUnit = 'C', onTempUnitChange }: WeatherPanelProps) {
  const { isIndia } = useMode()
  const [cities, setCities] = useState<CityWeather[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState('live')
  // Keyed by city name so a city missing from the AQI response simply has no
  // entry — the card then renders temperature only rather than a fake number.
  const [aqi, setAqi] = useState<Record<string, CityAqi>>({})

  // API values are °F — convert to the selected display unit
  const toTemp = (fahrenheit: number): string => {
    if (tempUnit === 'F') return `${Math.round(fahrenheit)}°F`
    return `${Math.round((fahrenheit - 32) * 5 / 9)}°C`
  }

  const fetchData = useCallback(async () => {
    // Air quality is a separate upstream — settle both so an AQI outage can
    // never take the weather cards down with it.
    const [wxRes, aqRes] = await Promise.allSettled([
      fetch(`/api/weather${isIndia ? '?region=india' : ''}`),
      fetch(`/api/health/air-quality?region=${isIndia ? 'india' : 'world'}`),
    ])

    try {
      if (wxRes.status === 'rejected') throw wxRes.reason
      const json = await wxRes.value.json()
      if (json.data) {
        setCities(json.data.filter(Boolean))
        setSource(json.source)
        setError(null)
      }
    } catch {
      setError('Failed to fetch weather data')
    } finally {
      setLoading(false)
    }

    if (aqRes.status === 'fulfilled') {
      try {
        const json = await aqRes.value.json()
        if (Array.isArray(json.data)) {
          setAqi(Object.fromEntries((json.data as CityAqi[]).map(a => [a.city, a])))
        }
      } catch { /* cards fall back to temperature only */ }
    }
  }, [isIndia])

  useEffect(() => {
    setLoading(true)
    fetchData()
    const id = setInterval(fetchData, 600000)
    return () => clearInterval(id)
  }, [fetchData])

  const unitToggle = (
    <div style={{ display: 'flex', gap: '2px' }}>
      {(['C', 'F'] as const).map(u => (
        <button
          key={u}
          onClick={() => onTempUnitChange?.(u)}
          style={{
            background: tempUnit === u ? 'var(--text-accent)' : 'transparent',
            color: tempUnit === u ? '#000' : 'var(--text-muted)',
            border: '1px solid var(--border-color)',
            borderRadius: '2px',
            padding: '2px 7px',
            fontSize: 'var(--fs-meta)',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'IBM Plex Mono, monospace',
            transition: 'all 150ms',
          }}
        >
          °{u}
        </button>
      ))}
    </div>
  )

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-header)',
    border: '1px solid var(--border-color)',
    borderRadius: '3px',
    padding: '7px 8px',
    minWidth: 0,
    overflow: 'hidden',
  }
  const nameStyle: React.CSSProperties = {
    fontSize: 'var(--fs-body)',
    fontWeight: 700,
    color: 'var(--text-accent)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: 'IBM Plex Mono, monospace',
  }
  const tempStyle: React.CSSProperties = {
    fontSize: 'var(--fs-lg)',
    fontWeight: 700,
    color: 'var(--text-primary)',
    fontFamily: 'IBM Plex Mono, monospace',
  }
  const conditionStyle: React.CSSProperties = {
    fontSize: 'var(--fs-meta)',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }

  return (
    <PanelWrapper title={isIndia ? 'INDIA WEATHER' : 'WORLD WEATHER'} loading={loading} error={error} source={source} onRefresh={fetchData} headerExtra={unitToggle}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
          gap: '4px',
          width: '100%',
          boxSizing: 'border-box',
          padding: 6,
        }}
      >
        {cities.map(city => {
          const a = aqi[city.city]
          return (
            <div key={city.city} style={cardStyle}>
              <div style={nameStyle}>{city.city}</div>
              <div style={tempStyle}>{toTemp(city.temp)}</div>
              <div style={conditionStyle}>{getWeatherEmoji(city.icon)} {city.description}</div>
              {a?.band ? (
                <div
                  title={`US AQI ${a.aqi} — ${AQI_LABELS[a.band]}${a.pm25 !== null ? ` · PM2.5 ${a.pm25} µg/m³` : ''}`}
                  style={{
                    marginTop: 3,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    maxWidth: '100%',
                    padding: '0 3px',
                    borderLeft: `2px solid ${AQI_COLORS[a.band]}`,
                    fontSize: 'var(--fs-meta)',
                    fontFamily: 'IBM Plex Mono, monospace',
                    color: AQI_COLORS[a.band],
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  <span style={{ fontWeight: 700 }}>AQI {a.aqi}</span>
                  <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{AQI_LABELS[a.band]}</span>
                </div>
              ) : (
                <div style={{ marginTop: 3, fontSize: 'var(--fs-meta)', fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-muted)', opacity: 0.5 }}>
                  AQI —
                </div>
              )}
            </div>
          )
        })}
      </div>
    </PanelWrapper>
  )
}
