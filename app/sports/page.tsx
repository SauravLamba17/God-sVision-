'use client'
import { useEffect, useState } from 'react'
import PanelWrapper from '@/components/panels/PanelWrapper'

type SportType = 'football' | 'f1' | 'nba' | 'cricket'

interface FootballLeague {
  league: string
  events: FootballEvent[]
}

interface FootballEvent {
  idEvent: string
  strEvent: string
  strHomeTeam: string
  strAwayTeam: string
  intHomeScore: string
  intAwayScore: string
  strStatus: string
  dateEvent: string
  strTime: string
}

interface F1Driver {
  driver_number: number
  full_name: string
  country_code: string
  team_name: string
}

interface F1Race {
  session_key: string
  session_name: string
  date_start: string
  circuit_short_name: string
  country_name: string
}

interface NBAGame {
  id: string
  name: string
  status: { type: { detail: string; completed: boolean } }
  competitions: { competitors: { team: { abbreviation: string; displayName: string }; score: string; homeAway: string }[] }[]
}

const TABS: { key: SportType; label: string; emoji: string }[] = [
  { key: 'football', label: 'FOOTBALL', emoji: '⚽' },
  { key: 'f1', label: 'FORMULA 1', emoji: '🏎' },
  { key: 'nba', label: 'NBA', emoji: '🏀' },
  { key: 'cricket', label: 'CRICKET', emoji: '🏏' },
]

export default function SportsPage() {
  const [activeTab, setActiveTab] = useState<SportType>('football')
  const [footballData, setFootballData] = useState<FootballLeague[]>([])
  const [f1Data, setF1Data] = useState<{ drivers: F1Driver[]; races: F1Race[] }>({ drivers: [], races: [] })
  const [nbaData, setNbaData] = useState<{ games: NBAGame[]; date: string }>({ games: [], date: '' })
  const [cricketData, setCricketData] = useState<FootballEvent[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSport = async (sport: SportType) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sports?type=${sport}`)
      const json = await res.json()
      if (sport === 'football') setFootballData(json.data || [])
      else if (sport === 'f1') setF1Data(json.data || { drivers: [], races: [] })
      else if (sport === 'nba') setNbaData(json.data || { games: [], date: '' })
      else if (sport === 'cricket') setCricketData(json.data || [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchSport(activeTab)
    const id = setInterval(() => fetchSport(activeTab), 60000)
    return () => clearInterval(id)
  }, [activeTab])

  return (
    <div className="p-2 flex flex-col gap-2 h-full">
      {/* Tab Bar */}
      <div className="flex gap-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`btn-terminal ${activeTab === tab.key ? 'active' : ''}`}
          >
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

      {/* Football */}
      {activeTab === 'football' && (
        <div className="grid grid-cols-2 gap-2">
          {loading ? (
            <div className="col-span-2 flex items-center justify-center h-32">
              <span className="font-mono text-[11px] text-positive">LOADING<span className="blink-cursor" /></span>
            </div>
          ) : footballData.map(league => (
            <PanelWrapper key={league.league} title={league.league.toUpperCase()}>
              {league.events.length === 0 ? (
                <div className="px-2 py-2 text-muted font-mono text-[10px]">NO RECENT MATCHES</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>HOME</th>
                      <th>SCORE</th>
                      <th style={{ textAlign: 'right' }}>AWAY</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {league.events.slice(0, 5).map(ev => (
                      <tr key={ev.idEvent}>
                        <td style={{ textAlign: 'left' }} className="text-primary">{ev.strHomeTeam}</td>
                        <td className="font-mono text-accent font-bold text-center">
                          {ev.intHomeScore ?? '-'} - {ev.intAwayScore ?? '-'}
                        </td>
                        <td style={{ textAlign: 'right' }} className="text-primary">{ev.strAwayTeam}</td>
                        <td>
                          <span className={`font-mono text-[9px] ${ev.strStatus === 'Match Finished' ? 'text-muted' : 'text-positive'}`}>
                            {ev.strStatus || ev.dateEvent}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </PanelWrapper>
          ))}
        </div>
      )}

      {/* F1 */}
      {activeTab === 'f1' && (
        <div className="grid grid-cols-2 gap-2">
          <PanelWrapper title="F1 2024 DRIVERS" loading={loading}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th style={{ textAlign: 'left' }}>DRIVER</th>
                  <th style={{ textAlign: 'left' }}>TEAM</th>
                  <th>CTY</th>
                </tr>
              </thead>
              <tbody>
                {f1Data.drivers.map((d, i) => (
                  <tr key={d.driver_number || i}>
                    <td className="text-accent font-mono">{d.driver_number}</td>
                    <td style={{ textAlign: 'left' }} className="font-bold">{d.full_name}</td>
                    <td style={{ textAlign: 'left' }} className="text-muted">{d.team_name}</td>
                    <td className="text-neutral">{d.country_code}</td>
                  </tr>
                ))}
                {f1Data.drivers.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-muted py-4">F1 session data available during race weekends</td></tr>
                )}
              </tbody>
            </table>
          </PanelWrapper>
          <PanelWrapper title="F1 2024 RECENT RACES" loading={loading}>
            {f1Data.races.map((race, i) => (
              <div key={race.session_key || i} className="px-2 py-2" style={{ borderBottom: '1px solid #0d1f0d' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-primary text-[11px]">{race.circuit_short_name}</div>
                    <div className="text-muted text-[9px]">{race.country_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-accent font-mono text-[10px]">{race.session_name}</div>
                    <div className="text-muted font-mono text-[9px]">{race.date_start?.slice(0, 10)}</div>
                  </div>
                </div>
              </div>
            ))}
            {f1Data.races.length === 0 && (
              <div className="px-2 py-4 text-muted font-mono text-[10px]">No race data. OpenF1 API available during race season.</div>
            )}
          </PanelWrapper>
        </div>
      )}

      {/* NBA */}
      {activeTab === 'nba' && (
        <PanelWrapper title={`NBA SCORES — ${nbaData.date || 'TODAY'}`} loading={loading}>
          {nbaData.games.length === 0 ? (
            <div className="px-2 py-4 text-muted font-mono text-[11px] text-center">
              No NBA games today. Check back during the season.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 p-2">
              {nbaData.games.map(game => {
                const comps = game.competitions?.[0]?.competitors || []
                const home = comps.find(c => c.homeAway === 'home')
                const away = comps.find(c => c.homeAway === 'away')
                return (
                  <div key={game.id} style={{ border: '1px solid #1b2e1b', padding: '8px 12px' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-bold text-primary">{away?.team.abbreviation}</div>
                        <div className="text-muted text-[9px]">{away?.team.displayName}</div>
                      </div>
                      <div className="text-center px-4">
                        <div className="font-mono text-[20px] text-accent font-bold">
                          {away?.score} - {home?.score}
                        </div>
                        <div className="font-mono text-[9px] text-muted">{game.status.type.detail}</div>
                      </div>
                      <div className="flex-1 text-right">
                        <div className="font-bold text-primary">{home?.team.abbreviation}</div>
                        <div className="text-muted text-[9px]">{home?.team.displayName}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </PanelWrapper>
      )}

      {/* Cricket */}
      {activeTab === 'cricket' && (
        <PanelWrapper title="CRICKET — RECENT MATCHES" loading={loading}>
          {cricketData.length === 0 ? (
            <div className="px-2 py-4 text-muted font-mono text-[11px] text-center">No cricket matches found.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>MATCH</th>
                  <th>SCORE</th>
                  <th>DATE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {cricketData.slice(0, 15).map(ev => (
                  <tr key={ev.idEvent}>
                    <td style={{ textAlign: 'left' }}>
                      <span className="text-primary">{ev.strHomeTeam}</span>
                      <span className="text-muted"> vs </span>
                      <span className="text-primary">{ev.strAwayTeam}</span>
                    </td>
                    <td className="font-mono text-accent">{ev.intHomeScore ?? 'TBD'} - {ev.intAwayScore ?? 'TBD'}</td>
                    <td className="text-muted text-[9px]">{ev.dateEvent}</td>
                    <td className="text-neutral text-[9px]">{ev.strStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </PanelWrapper>
      )}
    </div>
  )
}
