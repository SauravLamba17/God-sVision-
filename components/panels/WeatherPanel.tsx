'use client'
import { useEffect, useState, useCallback } from 'react'
import PanelWrapper from './PanelWrapper'
import { getWeatherEmoji } from '@/lib/apis/openweather'
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

  // API values are °F — convert to the selected display unit
  const toTemp = (fahrenheit: number): string => {
    if (tempUnit === 'F') return `${Math.round(fahrenheit)}°F`
    return `${Math.round((fahrenheit - 32) * 5 / 9)}°C`
  }

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/weather${isIndia ? '?region=india' : ''}`)
      const json = await res.json()
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
        {cities.map(city => (
          <div key={city.city} style={cardStyle}>
            <div style={nameStyle}>{city.city}</div>
            <div style={tempStyle}>{toTemp(city.temp)}</div>
            <div style={conditionStyle}>{getWeatherEmoji(city.icon)} {city.description}</div>
          </div>
        ))}
      </div>
    </PanelWrapper>
  )
}
