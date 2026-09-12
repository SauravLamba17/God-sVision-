'use client'
import { useEffect, useState, useCallback } from 'react'
import PanelWrapper from '@/components/panels/PanelWrapper'
import AIButton from '@/components/terminal/AIButton'
import { formatNumber } from '@/lib/utils'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface GlobalStats {
  cases: number; deaths: number; recovered: number; active: number
  todayCases: number; todayDeaths: number; critical: number
  casesPerMillion: number; deathsPerMillion: number
  affectedCountries: number
}

interface CountryStats {
  country: string
  countryInfo: { iso2: string; flag: string }
  cases: number; deaths: number; active: number
  todayCases: number; todayDeaths: number
  casesPerOneMillion: number; deathsPerOneMillion: number
}

type SortKey = 'cases'|'active'|'todayCases'|'deaths'|'todayDeaths'|'casesPerOneMillion'

function KpiCard({ label, value, sub, color='var(--text-primary)' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ border:'1px solid #1b2e1b', background:'var(--bg-terminal)', padding:'10px 14px', flex:1 }}>
      <div style={{ fontFamily:'IBM Plex Mono', fontSize:9, color:'var(--text-muted)', letterSpacing:'0.08em', marginBottom:4 }}>{label}</div>
      <div style={{ fontFamily:'IBM Plex Mono', fontSize:18, fontWeight:700, color }}>{value}</div>
      {sub && <div style={{ fontFamily:'IBM Plex Mono', fontSize:9, color:'var(--text-muted)', marginTop:2 }}>{sub}</div>}
    </div>
  )
}


/* ── WHO Disease Outbreak News ─────────────────────────────────────────── */
interface Outbreak { title: string; link: string; date: string; summary: string }

// WHO titles read "Disease - Country", e.g. "Nipah virus disease - India".
// Split so the disease can carry the visual weight and the location sit beside
// it, the way BREAKING NEWS separates headline from source.
function splitOutbreakTitle(title: string): [string, string] {
  const m = title.match(/^(.*?)\s+[-–—]\s+(.*)$/)
  return m ? [m[1], m[2]] : [title, '']
}

function fmtOutbreakDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function OutbreakPanel() {
  const [items, setItems] = useState<Outbreak[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/health/outbreaks?limit=10')
      const json = await res.json()
      if (Array.isArray(json.data) && json.data.length) {
        setItems(json.data)
        setError(null)
      } else {
        setError('Outbreak alerts temporarily unavailable')
      }
    } catch {
      setError('Outbreak alerts temporarily unavailable')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(); const id = setInterval(fetchData, 3600000); return () => clearInterval(id) }, [fetchData])

  return (
    <PanelWrapper
      title="CURRENT OUTBREAK ALERTS"
      loading={loading}
      error={error}
      source="live"
      onRefresh={fetchData}
      accentColor="var(--text-negative)"
      fullHeight
    >
      <div className="divide-y" style={{ borderColor: 'var(--border-dim)' }}>
        {items.map(o => {
          const [disease, place] = splitOutbreakTitle(o.title)
          return (
            <a
              key={o.link}
              href={o.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-2 py-1.5 hover:bg-header transition-colors"
            >
              <div className="flex items-start gap-2">
                <span
                  className="font-mono text-[10px] px-1 py-0.5 flex-shrink-0 mt-0.5"
                  style={{ color: 'var(--text-negative)', border: '1px solid var(--text-negative)' }}
                >
                  DON
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-primary text-[13px] leading-tight line-clamp-2">{disease}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {place && <span className="text-accent text-[11px] font-mono truncate">{place}</span>}
                    <span className="text-muted text-[11px] font-mono flex-shrink-0">{fmtOutbreakDate(o.date)}</span>
                  </div>
                </div>
              </div>
            </a>
          )
        })}
      </div>
    </PanelWrapper>
  )
}

export default function DiseasePage() {
  const [global_, setGlobal] = useState<GlobalStats | null>(null)
  const [countries, setCountries] = useState<CountryStats[]>([])
  const [history, setHistory] = useState<{ date: string; cases: number }[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('cases')
  const [sortDir, setSortDir] = useState<1|-1>(-1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [mainRes, histRes] = await Promise.allSettled([
        fetch('/api/disease'),
        fetch('/api/disease?type=history&days=90'),
      ])
      if (mainRes.status === 'fulfilled') {
        const j = await mainRes.value.json()
        if (j.data?.global) setGlobal(j.data.global)
        if (j.data?.countries) setCountries(j.data.countries)
      }
      if (histRes.status === 'fulfilled') {
        const j = await histRes.value.json()
        if (j.data) setHistory(j.data)
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [])

  const sorted = [...countries].sort((a, b) => {
    const av = a[sortKey] || 0, bv = b[sortKey] || 0
    return (av - bv) * sortDir
  })

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === -1 ? 1 : -1)
    else { setSortKey(key); setSortDir(-1) }
  }

  const thStyle = (key: SortKey): React.CSSProperties => ({
    cursor:'pointer', userSelect:'none',
    color: sortKey===key ? 'var(--text-accent)' : 'var(--text-muted)',
    whiteSpace:'nowrap',
  })

  // TODAY / DTH-PER-DAY are structurally 0 now that daily reporting has stopped.
  // They stay in the table as a historical column but are rendered at a third of
  // the visual weight of the cumulative columns so they can't read as live counts.
  const staleCell: React.CSSProperties = { color: 'var(--text-muted)', opacity: 0.45 }

  return (
    <div className="p-2 flex flex-col gap-2 h-full">
      {/* Title */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontFamily:'IBM Plex Mono', fontSize:14, fontWeight:700, color:'var(--text-accent)', letterSpacing:'0.08em' }}>
            GLOBAL HEALTH INTELLIGENCE
          </div>
          <div style={{ fontFamily:'IBM Plex Mono', fontSize:9, color:'var(--text-warning)', marginTop:3, maxWidth:680, lineHeight:1.5 }}>
            Historical &amp; cumulative COVID-19 data — daily reporting has been discontinued by most
            countries since 2023, so per-day counts are structurally zero and are shown greyed out.
          </div>
          <div style={{ fontFamily:'IBM Plex Mono', fontSize:9, color:'var(--text-muted)', marginTop:2 }}>
            Source: disease.sh (JHU/Worldometers archive) · cumulative totals only
          </div>
        </div>
        {global_ && <AIButton
          panelData={countries.slice(0,10)}
          panelName="GLOBAL HEALTH"
          context="Assess current global health risk and market implications (supply chains, pharma stocks, travel sector)."
        />}
      </div>

      {/* KPI cards */}
      {global_ && (
        <div style={{ display:'flex', gap:8 }}>
          <KpiCard label="TOTAL CASES WORLDWIDE" value={formatNumber(global_.cases)} sub="cumulative since 2020" color="#94a3b8" />
          <KpiCard label="TOTAL DEATHS WORLDWIDE" value={formatNumber(global_.deaths)} sub="cumulative since 2020" color="#ef4444" />
          <KpiCard
            label="GLOBAL CASE FATALITY RATE"
            value={global_.cases > 0 ? ((global_.deaths / global_.cases) * 100).toFixed(2) + '%' : '—'}
            sub="deaths ÷ confirmed cases"
            color="#f59e0b"
          />
          <KpiCard label="COUNTRIES TRACKED" value={String(global_.affectedCountries ?? '—')} sub="reporting territories" color="var(--text-accent)" />
        </div>
      )}

      <div className="flex gap-2 flex-1 min-h-0">
        {/* Main table */}
        <div className="flex-1 flex flex-col min-w-0">
          <PanelWrapper title="COUNTRY BREAKDOWN (CUMULATIVE)" loading={loading} fullHeight hideAgeBadge>
            <div style={{ overflowY:'auto', maxHeight:'calc(100vh - 280px)' }}>
              <table className="data-table" style={{ width:'100%' }}>
                <thead style={{ position:'sticky', top:0, zIndex:1 }}>
                  <tr>
                    <th style={{ textAlign:'left' }}>COUNTRY</th>
                    <th onClick={() => toggleSort('cases')} style={thStyle('cases')}>TOTAL CASES{sortKey==='cases'?sortDir===-1?'↓':'↑':''}</th>
                    <th onClick={() => toggleSort('active')} style={thStyle('active')}>ACTIVE{sortKey==='active'?sortDir===-1?'↓':'↑':''}</th>
                    <th onClick={() => toggleSort('deaths')} style={thStyle('deaths')}>DEATHS{sortKey==='deaths'?sortDir===-1?'↓':'↑':''}</th>
                    <th onClick={() => toggleSort('todayCases')} style={{ ...thStyle('todayCases'), ...staleCell }} title="Daily reporting discontinued — no longer updated">TODAY ⓘ{sortKey==='todayCases'?sortDir===-1?'↓':'↑':''}</th>
                    <th onClick={() => toggleSort('todayDeaths')} style={{ ...thStyle('todayDeaths'), ...staleCell }} title="Daily reporting discontinued — no longer updated">DTH/DAY ⓘ{sortKey==='todayDeaths'?sortDir===-1?'↓':'↑':''}</th>
                    <th onClick={() => toggleSort('casesPerOneMillion')} style={thStyle('casesPerOneMillion')}>CASES/1M{sortKey==='casesPerOneMillion'?sortDir===-1?'↓':'↑':''}</th>
                    <th>DEATH RATE</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(c => (
                    <tr key={c.country}>
                      <td style={{ textAlign:'left' }}>
                        {c.countryInfo?.flag && (
                          <img
                            src={c.countryInfo.flag}
                            alt={c.country}
                            style={{ width:16, height:12, marginRight:6, verticalAlign:'middle', objectFit:'cover' }}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        )}
                        <span style={{ color:'var(--text-primary)' }}>{c.country}</span>
                      </td>
                      <td>{formatNumber(c.cases)}</td>
                      <td style={{ color:'var(--text-warning)' }}>{formatNumber(c.active)}</td>
                      <td style={{ color:'var(--text-negative)' }}>{formatNumber(c.deaths)}</td>
                      <td style={staleCell}>{formatNumber(c.todayCases)}</td>
                      <td style={staleCell}>{formatNumber(c.todayDeaths)}</td>
                      <td>{c.casesPerOneMillion?.toFixed(0) ?? '—'}</td>
                      <td style={{ color: c.deaths/c.cases > 0.02 ? 'var(--text-negative)' : 'var(--text-secondary)' }}>
                        {c.cases > 0 ? ((c.deaths/c.cases)*100).toFixed(2) + '%' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PanelWrapper>
        </div>

        {/* Right: live WHO outbreak alerts above the historical trend chart */}
        <div style={{ width:320, flexShrink:0, display:'flex', flexDirection:'column', gap:8, minHeight:0 }}>
          <div style={{ flex:1, minHeight:220 }}>
            <OutbreakPanel />
          </div>
          {history.length > 0 && (
          <div style={{ height:220, flexShrink:0 }}>
            <PanelWrapper title="GLOBAL DAILY CASES (90D)" fullHeight hideAgeBadge>
              <div style={{ padding:8, height:'calc(100% - 30px)' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ top:4, right:4, left:0, bottom:4 }}>
                    <XAxis dataKey="date" tick={{ fontFamily:'IBM Plex Mono', fontSize:8, fill:'var(--text-muted)' }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontFamily:'IBM Plex Mono', fontSize:8, fill:'var(--text-muted)' }} tickFormatter={v => formatNumber(v)} width={50} />
                    <Tooltip
                      formatter={(v: number) => [formatNumber(v), 'Cases']}
                      contentStyle={{ background:'var(--bg-terminal)', border:'1px solid #1b2e1b', fontFamily:'IBM Plex Mono', fontSize:10 }}
                    />
                    <Line type="monotone" dataKey="cases" stroke="#ef4444" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </PanelWrapper>
          </div>
          )}
        </div>
      </div>
    </div>
  )
}
