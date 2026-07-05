'use client'
import { useEffect, useState } from 'react'
import PanelWrapper from './PanelWrapper'

interface CityWeather {
  city: string
  temp: number
  feelsLike: number
  humidity: number
  windSpeed: number
  description: string
  icon: string
}

const WIND_DIRS = ['N','NE','E','SE','S','SW','W','NW']

function getWindDir(deg: number): string {
  return WIND_DIRS[Math.round(deg / 45) % 8]
}

export default function WeatherPanel() {
  const [cities, setCities] = useState<CityWeather[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState('live')

  const fetchData = async () => {
    try {
      const res = await fetch('/api/weather')
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
  }

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 600000)
    return () => clearInterval(id)
  }, [])

  return (
    <PanelWrapper title="WORLD WEATHER" loading={loading} error={error} source={source} onRefresh={fetchData}>
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>CITY</th>
            <th>TEMP °F</th>
            <th>FEELS</th>
            <th>HUM%</th>
            <th>WIND</th>
            <th style={{ textAlign: 'left' }}>CONDITIONS</th>
          </tr>
        </thead>
        <tbody>
          {cities.map(w => (
            <tr key={w.city}>
              <td style={{ textAlign: 'left' }}>
                <span className="text-accent font-bold">{w.city}</span>
              </td>
              <td className="font-mono text-primary">{w.temp}°</td>
              <td className="font-mono text-neutral">{w.feelsLike}°</td>
              <td className="font-mono text-neutral">{w.humidity}%</td>
              <td className="font-mono text-neutral">{w.windSpeed}mph</td>
              <td style={{ textAlign: 'left' }}>
                <span className="text-muted text-[10px] capitalize">{w.description}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PanelWrapper>
  )
}
