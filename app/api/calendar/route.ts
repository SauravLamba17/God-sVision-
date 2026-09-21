import { NextResponse, NextRequest } from 'next/server'
import { fetchCalendarEvents } from '@/lib/apis/calendar'

interface CalendarEvent {
  date:        string
  time:        string
  event:       string
  category:    'FED' | 'INFLATION' | 'EMPLOYMENT' | 'GDP' | 'TRADE' | 'HOUSING' | 'SENTIMENT' | 'EARNINGS'
  importance:  'HIGH' | 'MEDIUM' | 'LOW'
  forecast?:   string
  previous?:   string
  actual?:     string
  country:     string
}

// STATIC_CALENDAR lived here: ~89 hardcoded events, most of them 2025 FOMC/CPI/
// NFP dates. It was dead code — nothing referenced it; GET() has always used
// fetchCalendarEvents(), which pulls the live Forex Factory feed. Deleted so a
// stale table cannot be wired back in by accident.

export async function GET(req: NextRequest) {
  const week = (req.nextUrl.searchParams.get('week') || 'this') as 'this' | 'next' | 'prev'
  const currency = req.nextUrl.searchParams.get('currency') || ''
  const impact = req.nextUrl.searchParams.get('impact') || ''

  try {
    let events = await fetchCalendarEvents(week)
    if (currency) events = events.filter(e => e.currency === currency)
    if (impact)   events = events.filter(e => e.impact === impact)
    return NextResponse.json({
      data: events,
      source: events.length > 0 ? 'live' : 'unavailable',
      count: events.length,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, data: [] })
  }
}
