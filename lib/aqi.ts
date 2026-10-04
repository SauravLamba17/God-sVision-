// AQI types/constants shared by the server fetcher (lib/apis/airQuality) and
// the client WeatherPanel. Kept dependency-free so the panel doesn't pull
// server code (lib/cache) into the browser bundle.

export type AqiBand = 'GOOD' | 'MODERATE' | 'SENSITIVE' | 'UNHEALTHY' | 'HAZARDOUS'

export interface CityAqi {
  city: string
  aqi: number | null      // US EPA AQI; null when the upstream has no value
  pm25: number | null
  band: AqiBand | null
}

// Standard US EPA AQI breakpoints.
export function aqiBand(aqi: number): AqiBand {
  if (aqi <= 50) return 'GOOD'
  if (aqi <= 100) return 'MODERATE'
  if (aqi <= 150) return 'SENSITIVE'
  if (aqi <= 200) return 'UNHEALTHY'
  return 'HAZARDOUS'
}

export const AQI_COLORS: Record<AqiBand, string> = {
  GOOD:       'var(--text-positive)',
  MODERATE:   'var(--text-warning)',
  SENSITIVE:  '#ff6d00',
  UNHEALTHY:  'var(--text-negative)',
  HAZARDOUS:  '#7f1d1d',
}

export const AQI_LABELS: Record<AqiBand, string> = {
  GOOD:       'Good',
  MODERATE:   'Moderate',
  SENSITIVE:  'Unhealthy (sensitive)',
  UNHEALTHY:  'Unhealthy',
  HAZARDOUS:  'Hazardous',
}
