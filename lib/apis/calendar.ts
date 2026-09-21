import { getCache, setCache } from '@/lib/cache'

export interface CalendarEvent {
  event: string
  country: string
  currency: string
  date: string       // YYYY-MM-DD
  time: string       // HH:MM ET
  impact: 'high' | 'medium' | 'low'
  forecast: string
  previous: string
  actual: string
}

// Hardcoded fallback: next 30 known major events
// FALLBACK_EVENTS lived here: 30 hardcoded July/August 2026 events. On any
// feed failure the catch below returned them as the CURRENT week — and its
// date filter excluded them all by now, which tripped a
// `filtered.length > 0 ? filtered : FALLBACK_EVENTS` guard into returning the
// whole stale list unfiltered. An empty result is returned instead, and the
// route reports source:'unavailable'.

function mapImpact(ff: string): 'high' | 'medium' | 'low' {
  if (ff === 'High') return 'high'
  if (ff === 'Medium') return 'medium'
  return 'low'
}

function mapCurrency(country: string): string {
  const map: Record<string, string> = {
    USD: 'USD', EUR: 'EUR', GBP: 'GBP', JPY: 'JPY', CNY: 'CNY',
    AUD: 'AUD', CAD: 'CAD', CHF: 'CHF', NZD: 'NZD', INR: 'INR',
  }
  return map[country] || country
}

export async function fetchCalendarEvents(week: 'this' | 'next' | 'prev' = 'this'): Promise<CalendarEvent[]> {
  const cacheKey = `calendar_events_${week}`
  const cached = await getCache(cacheKey)
  if (cached && !cached.stale) return cached.data as CalendarEvent[]

  try {
    // Try Forex Factory public JSON
    const urls: Record<string, string> = {
      this: 'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
      next: 'https://nfs.faireconomy.media/ff_calendar_nextweek.json',
      prev: 'https://nfs.faireconomy.media/ff_calendar_thisweek.json', // best available
    }
    const url = urls[week]
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 GodVision/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`FF returned ${res.status}`)
    const data = await res.json()

    const events: CalendarEvent[] = data
      .filter((e: any) => e.title && e.date)
      .map((e: any) => ({
        event: e.title,
        country: e.country || '',
        currency: mapCurrency(e.country || ''),
        date: e.date?.slice(0, 10) || '',
        time: e.date?.slice(11, 16) || '',
        impact: mapImpact(e.impact || ''),
        forecast: e.forecast || '',
        previous: e.previous || '',
        actual: e.actual || '',
      }))
      .filter((e: CalendarEvent) => e.date)
      .sort((a: CalendarEvent, b: CalendarEvent) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))

    await setCache(cacheKey, events, 3600)
    return events
  } catch {
    // Serve the last good fetch if we have one; otherwise nothing. Never
    // substitute hardcoded events - a calendar of dates that already passed is
    // worse than an empty one.
    if (cached) return cached.data as CalendarEvent[]
    return []
  }
}
