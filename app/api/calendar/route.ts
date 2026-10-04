import { NextResponse, NextRequest } from 'next/server'
import { fetchCalendarEvents } from '@/lib/apis/calendar'
import { z } from 'zod'
import { parseQuery } from '@/lib/validation'

const Query = z.object({
  week: z.enum(['this', 'next', 'prev']).default('this'),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'currency must be a 3-letter code').optional(),
  impact: z.enum(['high', 'medium', 'low']).optional(),
})

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
  const q = parseQuery(req, Query)
  if (q.error) return q.error
  const { week, currency, impact } = q.data

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
