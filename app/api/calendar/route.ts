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

// Static 2025-2026 economic calendar — key events
const STATIC_CALENDAR: CalendarEvent[] = [
  // FOMC 2025
  { date: '2025-01-29', time: '14:00 ET', event: 'FOMC Interest Rate Decision', category: 'FED', importance: 'HIGH', country: 'US', previous: '4.50%' },
  { date: '2025-03-19', time: '14:00 ET', event: 'FOMC Interest Rate Decision', category: 'FED', importance: 'HIGH', country: 'US', previous: '4.50%' },
  { date: '2025-05-07', time: '14:00 ET', event: 'FOMC Interest Rate Decision', category: 'FED', importance: 'HIGH', country: 'US', previous: '4.50%' },
  { date: '2025-06-18', time: '14:00 ET', event: 'FOMC Interest Rate Decision', category: 'FED', importance: 'HIGH', country: 'US' },
  { date: '2025-07-30', time: '14:00 ET', event: 'FOMC Interest Rate Decision', category: 'FED', importance: 'HIGH', country: 'US' },
  { date: '2025-09-17', time: '14:00 ET', event: 'FOMC Interest Rate Decision', category: 'FED', importance: 'HIGH', country: 'US' },
  { date: '2025-10-29', time: '14:00 ET', event: 'FOMC Interest Rate Decision', category: 'FED', importance: 'HIGH', country: 'US' },
  { date: '2025-12-17', time: '14:00 ET', event: 'FOMC Interest Rate Decision', category: 'FED', importance: 'HIGH', country: 'US' },
  // FOMC 2026
  { date: '2026-01-28', time: '14:00 ET', event: 'FOMC Interest Rate Decision', category: 'FED', importance: 'HIGH', country: 'US' },
  { date: '2026-03-18', time: '14:00 ET', event: 'FOMC Interest Rate Decision', category: 'FED', importance: 'HIGH', country: 'US' },
  { date: '2026-05-06', time: '14:00 ET', event: 'FOMC Interest Rate Decision', category: 'FED', importance: 'HIGH', country: 'US' },
  { date: '2026-06-17', time: '14:00 ET', event: 'FOMC Interest Rate Decision', category: 'FED', importance: 'HIGH', country: 'US' },
  { date: '2026-07-29', time: '14:00 ET', event: 'FOMC Interest Rate Decision', category: 'FED', importance: 'HIGH', country: 'US' },
  { date: '2026-09-16', time: '14:00 ET', event: 'FOMC Interest Rate Decision', category: 'FED', importance: 'HIGH', country: 'US' },
  // CPI 2025-2026 (approx BLS dates, ~2nd Tuesday/Wednesday of month)
  { date: '2025-01-15', time: '08:30 ET', event: 'CPI (Consumer Price Index) - Dec 2024', category: 'INFLATION', importance: 'HIGH', country: 'US', previous: '2.7%' },
  { date: '2025-02-12', time: '08:30 ET', event: 'CPI (Consumer Price Index) - Jan 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2025-03-12', time: '08:30 ET', event: 'CPI (Consumer Price Index) - Feb 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2025-04-10', time: '08:30 ET', event: 'CPI (Consumer Price Index) - Mar 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2025-05-13', time: '08:30 ET', event: 'CPI (Consumer Price Index) - Apr 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2025-06-11', time: '08:30 ET', event: 'CPI (Consumer Price Index) - May 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2025-07-15', time: '08:30 ET', event: 'CPI (Consumer Price Index) - Jun 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2025-08-13', time: '08:30 ET', event: 'CPI (Consumer Price Index) - Jul 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2025-09-10', time: '08:30 ET', event: 'CPI (Consumer Price Index) - Aug 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2025-10-15', time: '08:30 ET', event: 'CPI (Consumer Price Index) - Sep 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2025-11-12', time: '08:30 ET', event: 'CPI (Consumer Price Index) - Oct 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2025-12-10', time: '08:30 ET', event: 'CPI (Consumer Price Index) - Nov 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2026-01-14', time: '08:30 ET', event: 'CPI (Consumer Price Index) - Dec 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2026-02-11', time: '08:30 ET', event: 'CPI (Consumer Price Index) - Jan 2026', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2026-03-11', time: '08:30 ET', event: 'CPI (Consumer Price Index) - Feb 2026', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2026-04-09', time: '08:30 ET', event: 'CPI (Consumer Price Index) - Mar 2026', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2026-05-13', time: '08:30 ET', event: 'CPI (Consumer Price Index) - Apr 2026', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2026-06-10', time: '08:30 ET', event: 'CPI (Consumer Price Index) - May 2026', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2026-07-14', time: '08:30 ET', event: 'CPI (Consumer Price Index) - Jun 2026', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  // NFP (Non-Farm Payrolls) 2025-2026 (1st Friday of month)
  { date: '2025-01-10', time: '08:30 ET', event: 'Non-Farm Payrolls - Dec 2024', category: 'EMPLOYMENT', importance: 'HIGH', country: 'US', previous: '227K' },
  { date: '2025-02-07', time: '08:30 ET', event: 'Non-Farm Payrolls - Jan 2025', category: 'EMPLOYMENT', importance: 'HIGH', country: 'US' },
  { date: '2025-03-07', time: '08:30 ET', event: 'Non-Farm Payrolls - Feb 2025', category: 'EMPLOYMENT', importance: 'HIGH', country: 'US' },
  { date: '2025-04-04', time: '08:30 ET', event: 'Non-Farm Payrolls - Mar 2025', category: 'EMPLOYMENT', importance: 'HIGH', country: 'US' },
  { date: '2025-05-02', time: '08:30 ET', event: 'Non-Farm Payrolls - Apr 2025', category: 'EMPLOYMENT', importance: 'HIGH', country: 'US' },
  { date: '2025-06-06', time: '08:30 ET', event: 'Non-Farm Payrolls - May 2025', category: 'EMPLOYMENT', importance: 'HIGH', country: 'US' },
  { date: '2025-07-03', time: '08:30 ET', event: 'Non-Farm Payrolls - Jun 2025', category: 'EMPLOYMENT', importance: 'HIGH', country: 'US' },
  { date: '2025-08-01', time: '08:30 ET', event: 'Non-Farm Payrolls - Jul 2025', category: 'EMPLOYMENT', importance: 'HIGH', country: 'US' },
  { date: '2025-09-05', time: '08:30 ET', event: 'Non-Farm Payrolls - Aug 2025', category: 'EMPLOYMENT', importance: 'HIGH', country: 'US' },
  { date: '2025-10-03', time: '08:30 ET', event: 'Non-Farm Payrolls - Sep 2025', category: 'EMPLOYMENT', importance: 'HIGH', country: 'US' },
  { date: '2025-11-07', time: '08:30 ET', event: 'Non-Farm Payrolls - Oct 2025', category: 'EMPLOYMENT', importance: 'HIGH', country: 'US' },
  { date: '2025-12-05', time: '08:30 ET', event: 'Non-Farm Payrolls - Nov 2025', category: 'EMPLOYMENT', importance: 'HIGH', country: 'US' },
  { date: '2026-01-09', time: '08:30 ET', event: 'Non-Farm Payrolls - Dec 2025', category: 'EMPLOYMENT', importance: 'HIGH', country: 'US' },
  { date: '2026-02-06', time: '08:30 ET', event: 'Non-Farm Payrolls - Jan 2026', category: 'EMPLOYMENT', importance: 'HIGH', country: 'US' },
  { date: '2026-03-06', time: '08:30 ET', event: 'Non-Farm Payrolls - Feb 2026', category: 'EMPLOYMENT', importance: 'HIGH', country: 'US' },
  { date: '2026-04-03', time: '08:30 ET', event: 'Non-Farm Payrolls - Mar 2026', category: 'EMPLOYMENT', importance: 'HIGH', country: 'US' },
  { date: '2026-05-01', time: '08:30 ET', event: 'Non-Farm Payrolls - Apr 2026', category: 'EMPLOYMENT', importance: 'HIGH', country: 'US' },
  { date: '2026-06-05', time: '08:30 ET', event: 'Non-Farm Payrolls - May 2026', category: 'EMPLOYMENT', importance: 'HIGH', country: 'US' },
  { date: '2026-07-02', time: '08:30 ET', event: 'Non-Farm Payrolls - Jun 2026', category: 'EMPLOYMENT', importance: 'HIGH', country: 'US' },
  // GDP (BEA quarterly advance release — ~4 weeks after quarter end)
  { date: '2025-01-30', time: '08:30 ET', event: 'GDP Advance Estimate - Q4 2024', category: 'GDP', importance: 'HIGH', country: 'US' },
  { date: '2025-04-30', time: '08:30 ET', event: 'GDP Advance Estimate - Q1 2025', category: 'GDP', importance: 'HIGH', country: 'US' },
  { date: '2025-07-30', time: '08:30 ET', event: 'GDP Advance Estimate - Q2 2025', category: 'GDP', importance: 'HIGH', country: 'US' },
  { date: '2025-10-29', time: '08:30 ET', event: 'GDP Advance Estimate - Q3 2025', category: 'GDP', importance: 'HIGH', country: 'US' },
  { date: '2026-01-28', time: '08:30 ET', event: 'GDP Advance Estimate - Q4 2025', category: 'GDP', importance: 'HIGH', country: 'US' },
  { date: '2026-04-29', time: '08:30 ET', event: 'GDP Advance Estimate - Q1 2026', category: 'GDP', importance: 'HIGH', country: 'US' },
  { date: '2026-07-29', time: '08:30 ET', event: 'GDP Advance Estimate - Q2 2026', category: 'GDP', importance: 'HIGH', country: 'US' },
  // PCE (Fed's preferred inflation measure — last Friday of month)
  { date: '2025-01-31', time: '08:30 ET', event: 'PCE Price Index - Dec 2024', category: 'INFLATION', importance: 'HIGH', country: 'US', previous: '2.4%' },
  { date: '2025-02-28', time: '08:30 ET', event: 'PCE Price Index - Jan 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2025-03-28', time: '08:30 ET', event: 'PCE Price Index - Feb 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2025-04-30', time: '08:30 ET', event: 'PCE Price Index - Mar 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2025-05-30', time: '08:30 ET', event: 'PCE Price Index - Apr 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2025-06-27', time: '08:30 ET', event: 'PCE Price Index - May 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2025-07-31', time: '08:30 ET', event: 'PCE Price Index - Jun 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2025-08-29', time: '08:30 ET', event: 'PCE Price Index - Jul 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2025-09-26', time: '08:30 ET', event: 'PCE Price Index - Aug 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2025-10-31', time: '08:30 ET', event: 'PCE Price Index - Sep 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2025-11-26', time: '08:30 ET', event: 'PCE Price Index - Oct 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2025-12-19', time: '08:30 ET', event: 'PCE Price Index - Nov 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2026-01-30', time: '08:30 ET', event: 'PCE Price Index - Dec 2025', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2026-02-27', time: '08:30 ET', event: 'PCE Price Index - Jan 2026', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2026-03-27', time: '08:30 ET', event: 'PCE Price Index - Feb 2026', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2026-04-30', time: '08:30 ET', event: 'PCE Price Index - Mar 2026', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2026-05-29', time: '08:30 ET', event: 'PCE Price Index - Apr 2026', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  { date: '2026-06-26', time: '08:30 ET', event: 'PCE Price Index - May 2026', category: 'INFLATION', importance: 'HIGH', country: 'US' },
  // Initial Jobless Claims (weekly, Thursday)
  { date: '2025-01-16', time: '08:30 ET', event: 'Initial Jobless Claims', category: 'EMPLOYMENT', importance: 'MEDIUM', country: 'US' },
  { date: '2025-01-23', time: '08:30 ET', event: 'Initial Jobless Claims', category: 'EMPLOYMENT', importance: 'MEDIUM', country: 'US' },
  { date: '2025-01-30', time: '08:30 ET', event: 'Initial Jobless Claims', category: 'EMPLOYMENT', importance: 'MEDIUM', country: 'US' },
  // ISM Manufacturing
  { date: '2025-02-03', time: '10:00 ET', event: 'ISM Manufacturing PMI - Jan 2025', category: 'SENTIMENT', importance: 'MEDIUM', country: 'US' },
  { date: '2025-03-03', time: '10:00 ET', event: 'ISM Manufacturing PMI - Feb 2025', category: 'SENTIMENT', importance: 'MEDIUM', country: 'US' },
  { date: '2025-04-01', time: '10:00 ET', event: 'ISM Manufacturing PMI - Mar 2025', category: 'SENTIMENT', importance: 'MEDIUM', country: 'US' },
  { date: '2025-05-01', time: '10:00 ET', event: 'ISM Manufacturing PMI - Apr 2025', category: 'SENTIMENT', importance: 'MEDIUM', country: 'US' },
  // Retail Sales
  { date: '2025-01-16', time: '08:30 ET', event: 'Retail Sales - Dec 2024', category: 'SENTIMENT', importance: 'MEDIUM', country: 'US' },
  { date: '2025-02-14', time: '08:30 ET', event: 'Retail Sales - Jan 2025', category: 'SENTIMENT', importance: 'MEDIUM', country: 'US' },
  { date: '2025-03-17', time: '08:30 ET', event: 'Retail Sales - Feb 2025', category: 'SENTIMENT', importance: 'MEDIUM', country: 'US' },
  // Housing
  { date: '2025-01-23', time: '10:00 ET', event: 'Existing Home Sales - Dec 2024', category: 'HOUSING', importance: 'MEDIUM', country: 'US' },
  { date: '2025-02-26', time: '10:00 ET', event: 'New Home Sales - Jan 2025', category: 'HOUSING', importance: 'MEDIUM', country: 'US' },
]

export async function GET(req: NextRequest) {
  const week = (req.nextUrl.searchParams.get('week') || 'this') as 'this' | 'next' | 'prev'
  const currency = req.nextUrl.searchParams.get('currency') || ''
  const impact = req.nextUrl.searchParams.get('impact') || ''

  try {
    let events = await fetchCalendarEvents(week)
    if (currency) events = events.filter(e => e.currency === currency)
    if (impact)   events = events.filter(e => e.impact === impact)
    return NextResponse.json({ data: events, source: 'live', count: events.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, data: [] })
  }
}
