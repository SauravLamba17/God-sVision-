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
}

interface CountryStats {
  country: string
  countryInfo: { iso2: string; flag: string }
  cases: number; deaths: number; active: number
  todayCases: number; todayDeaths: number
  casesPerMillion: number; deathPerMillion: number
}

type SortKey = 'cases'|'active'|'todayCases'|'deaths'|'todayDeaths'|'casesPerMillion'

function KpiCard({ label, value, sub, color='var(--text-primary)' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ border:'1px solid #1b2e1b', background:'var(--bg-terminal)', padding:'10px 14px', flex:1 }}>
      <div style={{ fontFamily:'IBM Plex Mono', fontSize:9, color:'var(--text-muted)', letterSpacing:'0.08em', marginBottom:4 }}>{label}</div>
      <div style={{ fontFamily:'IBM Plex Mono', fontSize:18, fontWeight:700, color }}>{value}</div>
      {sub && <div style={{ fontFamily:'IBM Plex Mono', fontSize:9, color:'var(--text-muted)', marginTop:2 }}>{sub}</div>}
    </div>
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
    return (bv - av) * sortDir
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

  const todayCasesColor = (n: number) => n > 10000 ? 'var(--text-negative)' : n > 1000 ? 'var(--text-warning)' : 'var(--text-secondary)'

  return (
    <div className="p-2 flex flex-col gap-2 h-full">
      {/* Title */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontFamily:'IBM Plex Mono', fontSize:14, fontWeight:700, color:'var(--text-accent)', letterSpacing:'0.08em' }}>
            GLOBAL HEALTH INTELLIGENCE
          </div>
          <div style={{ fontFamily:'IBM Plex Mono', fontSize:9, color:'var(--text-muted)', marginTop:2 }}>
            Source: disease.sh · Data refreshes hourly
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
          <KpiCard label="TOTAL CASES WORLDWIDE" value={formatNumber(global_.cases)} color="#94a3b8" />
          <KpiCard label="ACTIVE CASES" value={formatNumber(global_.active)} color="#f59e0b" />
          <KpiCard label="DEATHS TODAY" value={formatNumber(global_.todayDeaths)} color="#ef4444" />
          <KpiCard label="CASES TODAY" value={formatNumber(global_.todayCases)} color="#ff6d00" />
          <KpiCard label="CRITICAL" value={formatNumber(global_.critical)} color="#ef4444" />
        </div>
      )}

      <div className="flex gap-2 flex-1 min-h-0">
        {/* Main table */}
        <div className="flex-1 flex flex-col min-w-0">
          <PanelWrapper title="COUNTRY BREAKDOWN" loading={loading} fullHeight>
            <div style={{ overflowY:'auto', maxHeight:'calc(100vh - 280px)' }}>
              <table className="data-table" style={{ width:'100%' }}>
                <thead style={{ position:'sticky', top:0, zIndex:1 }}>
                  <tr>
                    <th style={{ textAlign:'left' }}>COUNTRY</th>
                    <th onClick={() => toggleSort('cases')} style={thStyle('cases')}>TOTAL CASES{sortKey==='cases'?sortDir===-1?'↓':'↑':''}</th>
                    <th onClick={() => toggleSort('active')} style={thStyle('active')}>ACTIVE{sortKey==='active'?sortDir===-1?'↓':'↑':''}</th>
                    <th onClick={() => toggleSort('deaths')} style={thStyle('deaths')}>DEATHS{sortKey==='deaths'?sortDir===-1?'↓':'↑':''}</th>
                    <th onClick={() => toggleSort('todayCases')} style={thStyle('todayCases')}>TODAY{sortKey==='todayCases'?sortDir===-1?'↓':'↑':''}</th>
                    <th onClick={() => toggleSort('todayDeaths')} style={thStyle('todayDeaths')}>DTH/DAY{sortKey==='todayDeaths'?sortDir===-1?'↓':'↑':''}</th>
                    <th onClick={() => toggleSort('casesPerMillion')} style={thStyle('casesPerMillion')}>CASES/1M{sortKey==='casesPerMillion'?sortDir===-1?'↓':'↑':''}</th>
                    <th>DEATH RATE</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(c => (
                    <tr key={c.country}>
                      <td style={{ textAlign:'left' }}>
                        <span style={{ marginRight:4 }}>{c.countryInfo?.flag || ''}</span>
                        <span style={{ color:'var(--text-primary)' }}>{c.country}</span>
                      </td>
                      <td>{formatNumber(c.cases)}</td>
                      <td style={{ color:'var(--text-warning)' }}>{formatNumber(c.active)}</td>
                      <td style={{ color:'var(--text-negative)' }}>{formatNumber(c.deaths)}</td>
                      <td style={{ color:todayCasesColor(c.todayCases) }}>{formatNumber(c.todayCases)}</td>
                      <td style={{ color:c.todayDeaths > 100 ? 'var(--text-negative)' : 'var(--text-secondary)' }}>{formatNumber(c.todayDeaths)}</td>
                      <td>{c.casesPerMillion?.toFixed(0) || '—'}</td>
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

        {/* Right: trend chart */}
        {history.length > 0 && (
          <div style={{ width:280, flexShrink:0 }}>
            <PanelWrapper title="GLOBAL DAILY CASES (90D)" fullHeight>
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
  )
}
