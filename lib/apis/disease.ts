import { getCache, setCache } from '@/lib/cache'

export interface GlobalStats {
  cases: number
  deaths: number
  recovered: number
  active: number
  todayCases: number
  todayDeaths: number
  critical: number
  casesPerMillion: number
  deathsPerMillion: number
  updated: number
}

export interface CountryStats {
  country: string
  countryInfo: { iso2: string; iso3: string; flag: string }
  cases: number
  deaths: number
  recovered: number
  active: number
  todayCases: number
  todayDeaths: number
  critical: number
  casesPerMillion: number
  deathPerMillion: number
}

export async function fetchGlobalStats(): Promise<GlobalStats | null> {
  const cacheKey = 'disease_global'
  const cached = getCache(cacheKey)
  if (cached && !cached.stale) return cached.data as GlobalStats

  try {
    const res = await fetch('https://disease.sh/v3/covid-19/all', {
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json()
    setCache(cacheKey, data, 3600)
    return data
  } catch {
    return null
  }
}

export async function fetchCountryStats(limit = 50): Promise<CountryStats[]> {
  const cacheKey = `disease_countries_${limit}`
  const cached = getCache(cacheKey)
  if (cached && !cached.stale) return cached.data as CountryStats[]

  try {
    const res = await fetch(`https://disease.sh/v3/covid-19/countries?sort=cases&limit=${limit}`, {
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json()
    const countries = Array.isArray(data) ? data.slice(0, limit) : []
    setCache(cacheKey, countries, 3600)
    return countries
  } catch {
    return []
  }
}

export async function fetchHistoricalGlobal(days = 90): Promise<{ date: string; cases: number }[]> {
  const cacheKey = `disease_history_${days}`
  const cached = getCache(cacheKey)
  if (cached && !cached.stale) return cached.data as { date: string; cases: number }[]

  try {
    const res = await fetch(`https://disease.sh/v3/covid-19/historical/all?lastdays=${days}`, {
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json()
    const timeline = data?.cases || {}
    const result = Object.entries(timeline).map(([date, cases]) => ({
      date,
      cases: cases as number,
    }))
    setCache(cacheKey, result, 7200)
    return result
  } catch {
    return []
  }
}
