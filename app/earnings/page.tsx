'use client'
import { useEffect, useState, useCallback } from 'react'
import PanelWrapper from '@/components/panels/PanelWrapper'

interface EarningsEvent {
  ticker: string; date: string; epsEstimate: number|null; epsLow: number|null; epsHigh: number|null
  revenueEstimate: number|null; timing: string
}

interface EarningsHistory {
  period: string; actual: number|null; estimate: number|null; surprise: number|null; surprisePct: number|null
}

function formatRevenue(v: number|null) {
  if (!v) return 'â€”'
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toFixed(0)}`
}

function daysFromNow(dateStr: string): number {
  const now  = new Date(); now.setHours(0,0,0,0)
  const date = new Date(dateStr)
  return Math.round((date.getTime() - now.getTime()) / 86400000)
}

function dateBadge(dateStr: string) {
  const d = daysFromNow(dateStr)
  if (d < 0)   return <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>REPORTED</span>
  if (d === 0) return <span style={{ color: 'var(--text-negative)', fontWeight: 700, fontSize: 9, padding: '1px 5px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 3 }}>TODAY</span>
  if (d === 1) return <span style={{ color: 'var(--text-warning)', fontWeight: 700, fontSize: 9, padding: '1px 5px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 3 }}>TOMORROW</span>
  if (d <= 7)  return <span style={{ color: 'var(--text-accent)', fontSize: 9, padding: '1px 5px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 3 }}>IN {d}d</span>
  return <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>{dateStr}</span>
}

export default function EarningsPage() {
  const [upcoming, setUpcoming]     = useState<EarningsEvent[]>([])
  const [loading,  setLoading]      = useState(true)
  const [detail,   setDetail]       = useState<{ ticker: string; history: EarningsHistory[]; nextDate: string|null; epsEst: number|null } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [source,   setSource]       = useState('live')

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res  = await fetch('/api/earnings')
        const json = await res.json()
        if (json.data) { setUpcoming(json.data); setSource(json.source) }
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    fetch_()
  }, [])

  const loadDetail = useCallback(async (ticker: string) => {
    setDetailLoading(true)
    try {
      const res  = await fetch(`/api/earnings?ticker=${ticker}`)
      const json = await res.json()
      if (json.data) {
        setDetail({
          ticker,
          history:  json.data.history || [],
          nextDate: json.data.nextEarningsDate,
          epsEst:   json.data.epsEstimate,
        })
      }
    } catch { /* silent */ }
    finally { setDetailLoading(false) }
  }, [])

  const grouped = upcoming.reduce((acc, ev) => {
    const key = ev.date
    if (!acc[key]) acc[key] = []
    acc[key].push(ev)
    return acc
  }, {} as Record<string, EarningsEvent[]>)

  const sortedDates = Object.keys(grouped).sort()

  return (
    <div style={{ padding: 8, height: '100%', display: 'flex', gap: 8 }}>
      {/* Left: Calendar */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <PanelWrapper title="EARNINGS CALENDAR" loading={loading} source={source}>
          <div style={{ padding: '4px 0' }}>
            {sortedDates.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', fontSize: 11 }}>
                No upcoming earnings found
              </div>
            )}
            {sortedDates.map(date => {
              const d = daysFromNow(date)
              const isToday = d === 0
              return (
                <div key={date} style={{ marginBottom: 8 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '4px 10px',
                    background: isToday ? 'rgba(239,68,68,0.08)' : 'rgba(13,21,38,0.6)',
                    borderLeft: `2px solid ${isToday ? 'var(--text-negative)' : 'var(--border-color)'}`,
                    marginBottom: 2,
                  }}>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 700, color: isToday ? 'var(--text-negative)' : 'var(--text-accent)', letterSpacing: '0.06em' }}>
                      {date}
                    </span>
                    {dateBadge(date)}
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {grouped[date].length} COMPANIES
                    </span>
                  </div>
                  <table className="data-table" style={{ marginBottom: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>TICKER</th>
                        <th>EPS EST</th>
                        <th>EPS LOW</th>
                        <th>EPS HIGH</th>
                        <th>REV EST</th>
                        <th>TIMING</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped[date].map(ev => (
                        <tr key={ev.ticker} onClick={() => loadDetail(ev.ticker)} style={{ cursor: 'pointer' }}>
                          <td style={{ textAlign: 'left' }}>
                            <span style={{ color: 'var(--text-accent)', fontWeight: 700 }}>{ev.ticker}</span>
                          </td>
                          <td style={{ color: 'var(--text-positive)' }}>{ev.epsEstimate ? `$${ev.epsEstimate.toFixed(2)}` : 'â€”'}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{ev.epsLow ? `$${ev.epsLow.toFixed(2)}` : 'â€”'}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{ev.epsHigh ? `$${ev.epsHigh.toFixed(2)}` : 'â€”'}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{formatRevenue(ev.revenueEstimate)}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 9 }}>{ev.timing}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        </PanelWrapper>
      </div>

      {/* Right: Earnings history detail */}
      <div style={{ width: 340, flexShrink: 0 }}>
        <PanelWrapper title={detail ? `${detail.ticker} â€” EARNINGS HISTORY` : 'SELECT A TICKER'} loading={detailLoading} accentColor="#22c55e">
          {!detail ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', fontSize: 10 }}>
              Click any row to see earnings history
            </div>
          ) : (
            <div>
              {detail.nextDate && (
                <div style={{ padding: '8px 10px', background: 'rgba(34,197,94,0.06)', borderBottom: '1px solid #1e293b' }}>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)' }}>NEXT REPORT DATE</div>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, fontWeight: 700, color: 'var(--text-positive)', marginTop: 2 }}>
                    {detail.nextDate} {detail.epsEst !== null && <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>Â· EPS EST ${detail.epsEst.toFixed(2)}</span>}
                  </div>
                </div>
              )}
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>PERIOD</th>
                    <th>ACTUAL</th>
                    <th>ESTIMATE</th>
                    <th>SURPRISE</th>
                    <th>BEAT%</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.history.map((h, i) => {
                    const beat = h.surprisePct !== null && h.surprisePct >= 0
                    return (
                      <tr key={i}>
                        <td style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>{h.period}</td>
                        <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                          {h.actual !== null ? `$${h.actual.toFixed(2)}` : 'â€”'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {h.estimate !== null ? `$${h.estimate.toFixed(2)}` : 'â€”'}
                        </td>
                        <td style={{ color: beat ? 'var(--text-positive)' : 'var(--text-negative)' }}>
                          {h.surprise !== null ? `${beat ? '+' : ''}$${h.surprise.toFixed(2)}` : 'â€”'}
                        </td>
                        <td style={{ color: beat ? 'var(--text-positive)' : 'var(--text-negative)', fontWeight: 600 }}>
                          {h.surprisePct !== null ? `${beat ? '+' : ''}${h.surprisePct.toFixed(1)}%` : 'â€”'}
                        </td>
                      </tr>
                    )
                  })}
                  {detail.history.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>No history available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </PanelWrapper>
      </div>
    </div>
  )
}
