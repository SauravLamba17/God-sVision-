import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { setCache, getCache } from '@/lib/cache'

const SPORTSDB = 'https://www.thesportsdb.com/api/v1/json/3'
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports'
const OPENF1 = 'https://api.openf1.org/v1'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'football'
  const league = searchParams.get('league') || '4328'

  const key = `sports_${type}_${league}`
  const cached = await getCache(key)
  if (cached && !cached.stale) return NextResponse.json({ data: cached.data, source: 'cache' })

  try {
    if (type === 'football') {
      const leagues = [
        { id: '4328', name: 'English Premier League' },
        { id: '4335', name: 'La Liga' },
        { id: '4331', name: 'Bundesliga' },
        { id: '4332', name: 'Serie A' },
        { id: '4334', name: 'Ligue 1' },
        { id: '4480', name: 'Champions League' },
      ]
      const results = await Promise.allSettled(
        leagues.map(l => axios.get(`${SPORTSDB}/eventspastleague.php?id=${l.id}`, { timeout: 8000 }))
      )
      const data = leagues.map((l, i) => ({
        league: l.name,
        leagueId: l.id,
        events: results[i].status === 'fulfilled'
          ? (results[i].value.data?.events || []).slice(0, 5)
          : []
      }))
      await setCache(key, data, 300)
      return NextResponse.json({ data, source: 'live' })
    }

    if (type === 'f1') {
      const season = new Date().getFullYear()
      const [driversRes, racesRes] = await Promise.allSettled([
        axios.get(`${OPENF1}/drivers?session_key=latest`, { timeout: 8000 }),
        axios.get(`${OPENF1}/sessions?year=${season}&session_type=Race`, { timeout: 8000 }),
      ])
      // The season endpoint returns the whole calendar, so the tail is next
      // year's unraced rounds. Keep only sessions that have actually started,
      // otherwise "RECENT RACES" lists races that haven't happened yet.
      const now = new Date().toISOString()
      const races = racesRes.status === 'fulfilled'
        ? (racesRes.value.data ?? [])
            .filter((r: any) => (r.date_start ?? '') <= now)
            .slice(-5)
            .reverse()
        : []
      const data = {
        drivers: driversRes.status === 'fulfilled' ? driversRes.value.data?.slice(0, 20) : [],
        races,
        season,
      }
      await setCache(key, data, 300)
      return NextResponse.json({ data, source: 'live' })
    }

    if (type === 'nba') {
      const { data } = await axios.get(`${ESPN}/basketball/nba/scoreboard`, { timeout: 8000 })
      const result = {
        games: data.events?.slice(0, 10) || [],
        date: data.day?.date || new Date().toDateString()
      }
      await setCache(key, result, 60)
      return NextResponse.json({ data: result, source: 'live' })
    }

    if (type === 'cricket') {
      // 4430 was French Top 14 (rugby), not cricket. These three are real
      // cricket leagues; their seasons barely overlap (CPL ~Aug-Sep, IPL
      // ~Mar-May, Big Bash ~Dec-Jan), so query all of them and merge to keep
      // the tab populated year-round instead of empty for nine months.
      const leagues = ['5176', '4460', '4461']
      const results = await Promise.allSettled(
        leagues.map(id => axios.get(`${SPORTSDB}/eventspastleague.php?id=${id}`, { timeout: 8000 }))
      )
      const events = results
        .flatMap(r => (r.status === 'fulfilled' ? (r.value.data?.events ?? []) : []))
        .sort((a: any, b: any) => (b.dateEvent ?? '').localeCompare(a.dateEvent ?? ''))
      await setCache(key, events, 300)
      return NextResponse.json({ data: events.slice(0, 10), source: 'live' })
    }

    if (type === 'tennis') {
      const { data } = await axios.get(`${SPORTSDB}/lookuptable.php?l=4424&s=2024`, { timeout: 8000 })
      await setCache(key, data?.table || [], 3600)
      return NextResponse.json({ data: data?.table?.slice(0, 20) || [], source: 'live' })
    }

    return NextResponse.json({ error: 'Invalid sport type' }, { status: 400 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    if (cached) return NextResponse.json({ data: cached.data, source: 'cached', error: msg })
    return NextResponse.json({ error: msg, data: [] }, { status: 200 })
  }
}
