import axios from 'axios'

const KEY = process.env.OPENWEATHER_KEY || ''
const BASE = 'https://api.openweathermap.org/data/2.5'

export const WORLD_CITIES = [
  { name: 'New York', tz: 'America/New_York', lat: 40.71, lon: -74.01 },
  { name: 'London', tz: 'Europe/London', lat: 51.51, lon: -0.13 },
  { name: 'Tokyo', tz: 'Asia/Tokyo', lat: 35.69, lon: 139.69 },
  { name: 'Dubai', tz: 'Asia/Dubai', lat: 25.20, lon: 55.27 },
  { name: 'Mumbai', tz: 'Asia/Kolkata', lat: 19.08, lon: 72.88 },
  { name: 'Singapore', tz: 'Asia/Singapore', lat: 1.35, lon: 103.82 },
  { name: 'Sydney', tz: 'Australia/Sydney', lat: -33.87, lon: 151.21 },
  { name: 'Paris', tz: 'Europe/Paris', lat: 48.86, lon: 2.35 },
  { name: 'Frankfurt', tz: 'Europe/Berlin', lat: 50.11, lon: 8.68 },
  { name: 'Toronto', tz: 'America/Toronto', lat: 43.65, lon: -79.38 },
]

export const INDIA_CITIES = [
  { name: 'Mumbai',     tz: 'Asia/Kolkata', lat: 19.08, lon: 72.88 },
  { name: 'Delhi',      tz: 'Asia/Kolkata', lat: 28.61, lon: 77.21 },
  { name: 'Bangalore',  tz: 'Asia/Kolkata', lat: 12.97, lon: 77.59 },
  { name: 'Chennai',    tz: 'Asia/Kolkata', lat: 13.08, lon: 80.27 },
  { name: 'Kolkata',    tz: 'Asia/Kolkata', lat: 22.57, lon: 88.36 },
  { name: 'Hyderabad',  tz: 'Asia/Kolkata', lat: 17.38, lon: 78.49 },
  { name: 'Pune',       tz: 'Asia/Kolkata', lat: 18.52, lon: 73.86 },
  { name: 'Ahmedabad',  tz: 'Asia/Kolkata', lat: 23.03, lon: 72.58 },
  { name: 'Jaipur',     tz: 'Asia/Kolkata', lat: 26.91, lon: 75.79 },
  { name: 'Kochi',      tz: 'Asia/Kolkata', lat: 9.93,  lon: 76.27 },
  { name: 'Chandigarh', tz: 'Asia/Kolkata', lat: 30.73, lon: 76.78 },
  { name: 'Lucknow',    tz: 'Asia/Kolkata', lat: 26.85, lon: 80.95 },
]

export interface WeatherData {
  city: string
  temp: number
  feelsLike: number
  humidity: number
  windSpeed: number
  windDeg: number
  pressure: number
  visibility: number
  description: string
  icon: string
  sunrise: number
  sunset: number
  uvIndex?: number
}

export async function getWeather(lat: number, lon: number, cityName: string): Promise<WeatherData | null> {
  if (!KEY) {
    return getOpenMeteoWeather(lat, lon, cityName)
  }
  try {
    const { data } = await axios.get(`${BASE}/weather`, {
      params: { lat, lon, appid: KEY, units: 'imperial' },
      timeout: 8000
    })
    return {
      city: cityName,
      temp: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed),
      windDeg: data.wind.deg,
      pressure: data.main.pressure,
      visibility: Math.round((data.visibility || 10000) / 1609),
      description: data.weather[0]?.description || '',
      icon: data.weather[0]?.icon || '01d',
      sunrise: data.sys.sunrise,
      sunset: data.sys.sunset,
    }
  } catch {
    return getOpenMeteoWeather(lat, lon, cityName)
  }
}

async function getOpenMeteoWeather(lat: number, lon: number, cityName: string): Promise<WeatherData | null> {
  try {
    const { data } = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: lat, longitude: lon,
        current: ['temperature_2m', 'relative_humidity_2m', 'wind_speed_10m', 'weather_code', 'surface_pressure', 'apparent_temperature'],
        temperature_unit: 'fahrenheit',
        wind_speed_unit: 'mph',
        forecast_days: 1
      },
      timeout: 8000
    })
    const c = data.current
    return {
      city: cityName,
      temp: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      humidity: c.relative_humidity_2m,
      windSpeed: Math.round(c.wind_speed_10m),
      windDeg: 0,
      pressure: Math.round(c.surface_pressure),
      visibility: 10,
      description: wmoToDescription(c.weather_code),
      icon: wmoToIcon(c.weather_code),
      sunrise: 0,
      sunset: 0,
    }
  } catch {
    return null
  }
}

export async function getForecast(lat: number, lon: number) {
  try {
    const { data } = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: lat, longitude: lon,
        daily: ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'weather_code'],
        hourly: ['temperature_2m', 'precipitation_probability'],
        temperature_unit: 'fahrenheit',
        wind_speed_unit: 'mph',
        forecast_days: 7
      },
      timeout: 8000
    })
    return data
  } catch {
    return null
  }
}

export async function getNOAAAlerts() {
  try {
    const { data } = await axios.get('https://api.weather.gov/alerts/active', {
      params: { status: 'actual', limit: 20 },
      headers: { 'User-Agent': 'GodVision/1.0 (operations@myhealthiq.io)' },
      timeout: 8000
    })
    return data.features || []
  } catch {
    return []
  }
}

export function wmoToDescription(code: number): string {
  if (code === 0) return 'Clear sky'
  if (code <= 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code <= 49) return 'Foggy'
  if (code <= 59) return 'Drizzle'
  if (code <= 69) return 'Rain'
  if (code <= 79) return 'Snow'
  if (code <= 82) return 'Rain showers'
  if (code <= 86) return 'Snow showers'
  if (code >= 95) return 'Thunderstorm'
  return 'Unknown'
}

export function wmoToIcon(code: number): string {
  if (code === 0) return '01d'
  if (code <= 2) return '02d'
  if (code === 3) return '04d'
  if (code <= 49) return '50d'
  if (code <= 69) return '10d'
  if (code <= 79) return '13d'
  if (code <= 82) return '09d'
  if (code >= 95) return '11d'
  return '01d'
}

// OpenWeatherMap icon code → emoji, shared across weather page + dashboard panel
export const WEATHER_ICON_EMOJI: Record<string, string> = {
  '01d': '☀️', '02d': '⛅', '03d': '🌤', '04d': '☁️',
  '09d': '🌧', '10d': '🌦', '11d': '⛈', '13d': '❄️',
  '50d': '🌫', '01n': '🌙', '02n': '🌙', '03n': '☁️', '04n': '☁️',
}

export function getWeatherEmoji(icon: string): string {
  return WEATHER_ICON_EMOJI[icon] || '🌡'
}
