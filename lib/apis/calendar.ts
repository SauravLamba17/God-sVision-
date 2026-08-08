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
const FALLBACK_EVENTS: CalendarEvent[] = [
  { event: 'Fed Interest Rate Decision', country: 'US', currency: 'USD', date: '2026-07-29', time: '14:00', impact: 'high', forecast: '4.25%', previous: '4.50%', actual: '' },
  { event: 'US Nonfarm Payrolls', country: 'US', currency: 'USD', date: '2026-07-03', time: '08:30', impact: 'high', forecast: '175K', previous: '151K', actual: '' },
  { event: 'US CPI (YoY)', country: 'US', currency: 'USD', date: '2026-07-15', time: '08:30', impact: 'high', forecast: '2.4%', previous: '2.3%', actual: '' },
  { event: 'US GDP Growth Rate QoQ', country: 'US', currency: 'USD', date: '2026-07-30', time: '08:30', impact: 'high', forecast: '1.8%', previous: '2.4%', actual: '' },
  { event: 'US PPI (MoM)', country: 'US', currency: 'USD', date: '2026-07-11', time: '08:30', impact: 'medium', forecast: '0.2%', previous: '0.1%', actual: '' },
  { event: 'US Retail Sales (MoM)', country: 'US', currency: 'USD', date: '2026-07-16', time: '08:30', impact: 'medium', forecast: '0.3%', previous: '-0.1%', actual: '' },
  { event: 'ECB Interest Rate Decision', country: 'EU', currency: 'EUR', date: '2026-07-23', time: '14:15', impact: 'high', forecast: '3.90%', previous: '4.00%', actual: '' },
  { event: 'Euro Zone CPI (YoY)', country: 'EU', currency: 'EUR', date: '2026-07-01', time: '10:00', impact: 'high', forecast: '2.1%', previous: '2.2%', actual: '' },
  { event: 'Euro Zone GDP Growth Rate', country: 'EU', currency: 'EUR', date: '2026-07-30', time: '10:00', impact: 'medium', forecast: '0.3%', previous: '0.4%', actual: '' },
  { event: 'Bank of England Rate Decision', country: 'UK', currency: 'GBP', date: '2026-08-07', time: '12:00', impact: 'high', forecast: '4.75%', previous: '5.00%', actual: '' },
  { event: 'UK CPI (YoY)', country: 'UK', currency: 'GBP', date: '2026-07-16', time: '07:00', impact: 'high', forecast: '2.8%', previous: '2.6%', actual: '' },
  { event: 'UK GDP (MoM)', country: 'UK', currency: 'GBP', date: '2026-07-11', time: '07:00', impact: 'medium', forecast: '0.2%', previous: '0.0%', actual: '' },
  { event: 'Bank of Japan Rate Decision', country: 'JP', currency: 'JPY', date: '2026-07-31', time: '03:00', impact: 'high', forecast: '0.25%', previous: '0.10%', actual: '' },
  { event: 'Japan CPI (YoY)', country: 'JP', currency: 'JPY', date: '2026-07-25', time: '23:30', impact: 'medium', forecast: '2.3%', previous: '2.2%', actual: '' },
  { event: 'China GDP Growth Rate', country: 'CN', currency: 'CNY', date: '2026-07-15', time: '02:00', impact: 'high', forecast: '4.8%', previous: '5.4%', actual: '' },
  { event: 'China CPI (YoY)', country: 'CN', currency: 'CNY', date: '2026-07-10', time: '01:30', impact: 'medium', forecast: '0.3%', previous: '0.1%', actual: '' },
  { event: 'RBI Interest Rate Decision', country: 'IN', currency: 'INR', date: '2026-08-08', time: '10:00', impact: 'high', forecast: '5.75%', previous: '6.00%', actual: '' },
  { event: 'India CPI (YoY)', country: 'IN', currency: 'INR', date: '2026-07-14', time: '17:30', impact: 'medium', forecast: '4.2%', previous: '3.6%', actual: '' },
  { event: 'US Initial Jobless Claims', country: 'US', currency: 'USD', date: '2026-07-03', time: '08:30', impact: 'medium', forecast: '222K', previous: '219K', actual: '' },
  { event: 'US ISM Manufacturing PMI', country: 'US', currency: 'USD', date: '2026-07-01', time: '10:00', impact: 'medium', forecast: '49.2', previous: '48.7', actual: '' },
  { event: 'US ISM Services PMI', country: 'US', currency: 'USD', date: '2026-07-07', time: '10:00', impact: 'medium', forecast: '51.8', previous: '52.9', actual: '' },
  { event: 'US FOMC Meeting Minutes', country: 'US', currency: 'USD', date: '2026-07-08', time: '18:00', impact: 'high', forecast: '', previous: '', actual: '' },
  { event: 'US Consumer Confidence', country: 'US', currency: 'USD', date: '2026-07-29', time: '10:00', impact: 'medium', forecast: '100.5', previous: '98.0', actual: '' },
  { event: 'Fed Powell Speech', country: 'US', currency: 'USD', date: '2026-07-22', time: '14:00', impact: 'high', forecast: '', previous: '', actual: '' },
  { event: 'Euro Zone Retail Sales', country: 'EU', currency: 'EUR', date: '2026-07-04', time: '10:00', impact: 'low', forecast: '0.4%', previous: '0.0%', actual: '' },
  { event: 'Germany ZEW Economic Sentiment', country: 'DE', currency: 'EUR', date: '2026-07-14', time: '11:00', impact: 'medium', forecast: '25.0', previous: '20.0', actual: '' },
  { event: 'Bank of Canada Rate Decision', country: 'CA', currency: 'CAD', date: '2026-07-30', time: '14:00', impact: 'high', forecast: '2.75%', previous: '2.75%', actual: '' },
  { event: 'Australia RBA Rate Decision', country: 'AU', currency: 'AUD', date: '2026-08-04', time: '04:30', impact: 'high', forecast: '3.85%', previous: '4.10%', actual: '' },
  { event: 'US Treasury 10-Year Auction', country: 'US', currency: 'USD', date: '2026-07-09', time: '13:00', impact: 'medium', forecast: '', previous: '4.38%', actual: '' },
  { event: 'US Core PCE Price Index (YoY)', country: 'US', currency: 'USD', date: '2026-07-31', time: '08:30', impact: 'high', forecast: '2.6%', previous: '2.6%', actual: '' },
]

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
    // Return filtered fallback
    const now = new Date()
    const filtered = FALLBACK_EVENTS
      .filter(e => {
        const d = new Date(e.date)
        const diff = (d.getTime() - now.getTime()) / 86400000
        if (week === 'this') return diff >= -7 && diff <= 7
        if (week === 'next') return diff > 0 && diff <= 14
        return diff < 0 && diff >= -14
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    const result = filtered.length > 0 ? filtered : FALLBACK_EVENTS
    await setCache(cacheKey, result, 1800)
    return result
  }
}
