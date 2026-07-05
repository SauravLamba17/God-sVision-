'use client'
import { useEffect, useState } from 'react'
import PanelWrapper from '@/components/panels/PanelWrapper'
import { WORLD_CITIES } from '@/lib/apis/openweather'
import LineChartComponent from '@/components/charts/LineChart'
import { GlossaryTooltip } from '@/components/ui/GlossaryTooltip'

// API returns Fahrenheit (units=imperial) and mph â€” convert on display
type TempUnit = 'C' | 'F'

interface WeatherData {
  city: string
  temp: number       // Â°F from API
  feelsLike: number  // Â°F from API
  humidity: number
  windSpeed: number  // mph from API
  windDeg: number
  pressure: number
  visibility: number // miles from API
  description: string
  icon: string
  sunrise: number
  sunset: number
}

interface ForecastData {
  daily: {
    time: string[]
    temperature_2m_max: number[]  // Â°F
    temperature_2m_min: number[]  // Â°F
    precipitation_sum: number[]
    weather_code: number[]
  }
  hourly: {
    time: string[]
    temperature_2m: number[]      // Â°F
    precipitation_probability: number[]
  }
}

interface NOAAAlert {
  properties: {
    event: string
    headline: string
    severity: string
    areaDesc: string
    sent: string
  }
}

const WEATHER_ICONS: Record<string, string> = {
  '01d': 'â˜€ï¸', '02d': 'â›…', '03d': 'ðŸŒ¤', '04d': 'â˜ï¸',
  '09d': 'ðŸŒ§', '10d': 'ðŸŒ¦', '11d': 'â›ˆ', '13d': 'â„ï¸',
  '50d': 'ðŸŒ«', '01n': 'ðŸŒ™', '02n': 'ðŸŒ™', '03n': 'â˜ï¸', '04n': 'â˜ï¸',
}

function getIcon(code: string) { return WEATHER_ICONS[code] || 'ðŸŒ¡' }

function TempToggle({ unit, onChange }: { unit: TempUnit; onChange: (u: TempUnit) => void }) {
  return (
    <div style={{
      display: 'inline-flex',
      background: 'var(--bg-header, #0d1526)',
      border: '1px solid var(--border-dim, #1e293b)',
      borderRadius: 20,
      padding: 2,
      gap: 2,
      flexShrink: 0,
    }}>
      {(['C', 'F'] as TempUnit[]).map(u => (
        <button
          key={u}
          onClick={() => onChange(u)}
          style={{
            background: unit === u ? 'var(--text-accent, #38bdf8)' : 'transparent',
            color: unit === u ? '#000' : 'var(--text-muted, #475569)',
            border: 'none',
            borderRadius: 16,
            padding: '3px 10px',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'IBM Plex Mono',
            transition: 'all 150ms ease',
          }}
        >
          Â°{u}
        </button>
      ))}
    </div>
  )
}

export default function WeatherPage() {
  const [search, setSearch] = useState('')
  const [selectedCity, setSelectedCity] = useState(WORLD_CITIES[0])
  const [current, setCurrent] = useState<WeatherData | null>(null)
  const [forecast, setForecast] = useState<ForecastData | null>(null)
  const [noaaAlerts, setNoaaAlerts] = useState<NOAAAlert[]>([])
  const [cityWeathers, setCityWeathers] = useState<WeatherData[]>([])
  const [loading, setLoading] = useState(true)
  const [tempUnit, setTempUnit] = useState<TempUnit>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gv_temp_unit')
      if (saved === 'C' || saved === 'F') return saved
    }
    return 'F' // API default
  })

  const handleUnitChange = (u: TempUnit) => {
    setTempUnit(u)
    try { localStorage.setItem('gv_temp_unit', u) } catch { /* ignore */ }
  }

  // Conversion helpers â€” API data stored as Â°F and mph
  const fToDisplay = (f: number | undefined | null): string => {
    if (f == null) return 'â€”'
    if (tempUnit === 'C') return `${Math.round((f - 32) * 5 / 9)}Â°C`
    return `${Math.round(f)}Â°F`
  }
  const windToDisplay = (mph: number | undefined | null): string => {
    if (mph == null) return 'â€”'
    if (tempUnit === 'C') return `${Math.round(mph * 1.609)} km/h`
    return `${Math.round(mph)} mph`
  }
  const visToDisplay = (mi: number | undefined | null): string => {
    if (mi == null) return 'â€”'
    if (tempUnit === 'C') return `${Math.round(mi * 1.609)} km`
    return `${Math.round(mi)} mi`
  }

  const fetchCurrent = async (lat: number, lon: number, city: string) => {
    try {
      const [curRes, fcRes] = await Promise.allSettled([
        fetch(`/api/weather?type=current&lat=${lat}&lon=${lon}&city=${city}`),
        fetch(`/api/weather?type=forecast&lat=${lat}&lon=${lon}&city=${city}`)
      ])
      if (curRes.status === 'fulfilled') {
        const j = await curRes.value.json()
        if (j.data) setCurrent(j.data)
      }
      if (fcRes.status === 'fulfilled') {
        const j = await fcRes.value.json()
        if (j.data) setForecast(j.data)
      }
    } catch { /* silent */ }
  }

  useEffect(() => {
    const fetchAll = async () => {
      const [citiesRes, noaaRes] = await Promise.allSettled([
        fetch('/api/weather'),
        fetch('/api/weather?type=noaa')
      ])
      if (citiesRes.status === 'fulfilled') {
        const j = await citiesRes.value.json()
        if (j.data) setCityWeathers(j.data.filter(Boolean))
      }
      if (noaaRes.status === 'fulfilled') {
        const j = await noaaRes.value.json()
        if (j.data) setNoaaAlerts(j.data.slice(0, 5))
      }
      setLoading(false)
    }
    fetchAll()
    fetchCurrent(selectedCity.lat, selectedCity.lon, selectedCity.name)
    const id = setInterval(fetchAll, 600000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    fetchCurrent(selectedCity.lat, selectedCity.lon, selectedCity.name)
  }, [selectedCity])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const found = WORLD_CITIES.find(c => c.name.toLowerCase().includes(search.toLowerCase()))
    if (found) { setSelectedCity(found); setSearch('') }
  }

  // Hourly chart â€” key on tempUnit so it re-renders when unit changes
  const hourlyChartData = forecast?.hourly ? (() => {
    const len = Math.min(24, forecast.hourly.time.length)
    return Array.from({ length: len }, (_, i) => ({
      date: forecast.hourly.time[i]?.slice(11, 16) || '',
      value: tempUnit === 'C'
        ? Math.round((forecast.hourly.temperature_2m[i] - 32) * 5 / 9)
        : Math.round(forecast.hourly.temperature_2m[i]),
    }))
  })() : []

  return (
    <div className="p-2 flex gap-2 h-full">
      {/* Left: Current + Forecast */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        {/* Search + Unit Toggle */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <form onSubmit={handleSearch} style={{ flex: 1 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="SEARCH CITY... (try: London, Tokyo, Dubai)"
              className="input-terminal w-full"
            />
          </form>
          <TempToggle unit={tempUnit} onChange={handleUnitChange} />
        </div>

        {/* Current Weather */}
        {current && (
          <div style={{ border: '1px solid var(--border-dim, #1e293b)', background: 'var(--bg-panel, #0a0f1e)', padding: 16 }}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="font-mono text-[20px] text-accent font-bold">{current.city}</div>
                <div className="font-mono text-[48px] text-primary font-bold leading-none">
                  {fToDisplay(current.temp)}
                </div>
                <div className="font-mono text-[13px] text-muted capitalize mt-1">
                  {getIcon(current.icon)} {current.description}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                {[
                  {
                    label: (
                      <GlossaryTooltip term="FEELS_LIKE">FEELS LIKE</GlossaryTooltip>
                    ),
                    value: fToDisplay(current.feelsLike),
                  },
                  {
                    label: (
                      <GlossaryTooltip term="HUMIDITY">HUMIDITY</GlossaryTooltip>
                    ),
                    value: `${current.humidity}%`,
                  },
                  { label: 'WIND', value: windToDisplay(current.windSpeed) },
                  { label: 'PRESSURE', value: `${current.pressure} hPa` },
                  { label: 'VISIBILITY', value: visToDisplay(current.visibility) },
                  {
                    label: 'SUNRISE',
                    value: current.sunrise
                      ? new Date(current.sunrise * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                      : 'N/A',
                  },
                ].map((row, i) => (
                  <div key={i}>
                    <div className="font-mono text-[9px] text-muted">{row.label}</div>
                    <div className="font-mono text-[12px] text-primary">{row.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 7-Day Forecast */}
        {forecast?.daily && (
          <PanelWrapper title="7-DAY FORECAST">
            <div className="flex divide-x" style={{ borderColor: 'var(--border-dim, #1e293b)' }}>
              {forecast.daily.time.slice(0, 7).map((date, i) => {
                const maxT = forecast.daily.temperature_2m_max[i]
                const minT = forecast.daily.temperature_2m_min[i]
                const precip = forecast.daily.precipitation_sum[i]
                return (
                  <div key={date} className="flex-1 text-center p-2">
                    <div className="font-mono text-[9px] text-muted">
                      {new Date(date).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                    </div>
                    <div className="font-mono text-[9px] text-muted mb-1">
                      {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="text-lg mb-1">â˜ï¸</div>
                    <div className="font-mono text-[12px] text-positive">{fToDisplay(maxT)}</div>
                    <div className="font-mono text-[11px] text-neutral">{fToDisplay(minT)}</div>
                    {precip > 0 && (
                      <div className="font-mono text-[9px] text-neutral mt-0.5">{precip.toFixed(1)}&quot;</div>
                    )}
                  </div>
                )
              })}
            </div>
          </PanelWrapper>
        )}

        {/* Hourly Chart â€” key forces remount on unit change */}
        {hourlyChartData.length > 0 && (
          <PanelWrapper title={`24H TEMPERATURE (Â°${tempUnit})`}>
            <LineChartComponent
              key={tempUnit}
              data={hourlyChartData}
              color="#ff6d00"
              height={140}
              formatValue={(v) => `${v.toFixed(0)}Â°${tempUnit}`}
            />
          </PanelWrapper>
        )}
      </div>

      {/* Right: World Cities + NOAA Alerts */}
      <div style={{ width: 280, flexShrink: 0 }} className="space-y-2">
        {/* City Selector */}
        <div style={{ border: '1px solid var(--border-dim, #1e293b)', background: 'var(--bg-panel, #0a0f1e)' }}>
          <div className="panel-header" style={{ justifyContent: 'space-between' }}>
            <span className="panel-header-title">WORLD CITIES</span>
            <TempToggle unit={tempUnit} onChange={handleUnitChange} />
          </div>
          <div className="flex flex-wrap gap-1 p-2">
            {WORLD_CITIES.map(city => (
              <button
                key={city.name}
                onClick={() => setSelectedCity(city)}
                className={`btn-terminal text-[9px] ${selectedCity.name === city.name ? 'active' : ''}`}
              >
                {city.name}
              </button>
            ))}
          </div>
        </div>

        {/* World Weather Table */}
        <PanelWrapper title="WORLD WEATHER" loading={loading}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>CITY</th>
                <th>TEMP ({tempUnit === 'C' ? 'Â°C' : 'Â°F'})</th>
                <th>
                  <GlossaryTooltip term="HUMIDITY">HUM</GlossaryTooltip>
                </th>
                <th style={{ textAlign: 'left' }}>SKY</th>
              </tr>
            </thead>
            <tbody>
              {cityWeathers.map(w => (
                <tr key={w.city} onClick={() => {
                  const city = WORLD_CITIES.find(c => c.name === w.city)
                  if (city) setSelectedCity(city)
                }} style={{ cursor: 'pointer' }}>
                  <td style={{ textAlign: 'left' }}>
                    <span className="text-accent font-bold text-[10px]">{w.city}</span>
                  </td>
                  <td className="font-mono">{fToDisplay(w.temp)}</td>
                  <td className="font-mono text-neutral">{w.humidity}%</td>
                  <td style={{ textAlign: 'left' }} className="text-muted text-[10px] capitalize">{w.description?.slice(0, 12)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PanelWrapper>

        {/* NOAA Alerts */}
        {noaaAlerts.length > 0 && (
          <PanelWrapper title="âš  NOAA ALERTS">
            <div className="divide-y" style={{ borderColor: 'var(--border-dim)' }}>
              {noaaAlerts.map((alert, i) => (
                <div key={i} className="px-2 py-1.5">
                  <div className="font-mono text-[10px] text-negative font-bold">{alert.properties.event}</div>
                  <div className="font-mono text-[9px] text-muted mt-0.5">{alert.properties.areaDesc?.slice(0, 50)}</div>
                  <div className="font-mono text-[9px] text-neutral mt-0.5">{alert.properties.severity}</div>
                </div>
              ))}
            </div>
          </PanelWrapper>
        )}
      </div>
    </div>
  )
}
