'use client'
import { useEffect, useState, useCallback } from 'react'
import PanelWrapper from '@/components/panels/PanelWrapper'
import AIButton from '@/components/terminal/AIButton'
import { tint } from '@/lib/context/ThemeContext'

interface CalendarEvent {
  event: string; country: string; currency: string
  date: string; time: string
  impact: 'high'|'medium'|'low'
  forecast: string; previous: string; actual: string
}

const CURRENCIES = ['ALL','USD','EUR','GBP','JPY','CNY','INR','CAD','AUD','CHF']

function ImpactBadge({ impact }: { impact: string }) {
  const cfg: Record<string,{color:string;bg:string;label:string}> = {
    // No fill: the badge sits on rows that may already be tinted (upcoming/today).
    high:   { color:'var(--text-negative)', bg:'transparent', label:'HIGH' },
    medium: { color:'var(--text-warning)', bg:'transparent', label:'MED'  },
    low:    { color:'var(--text-muted)', bg:'transparent',          label:'LOW'  },
  }
  const c = cfg[impact] || cfg.low
  return (
    <span style={{ fontSize:9, fontWeight:700, color:c.color, background:c.bg, border:'var(--bw) solid currentColor', borderRadius:4, padding:'0 5px' }}>
      {c.label}
    </span>
  )
}

function actualColor(actual: string, forecast: string) {
  if (!actual || !forecast) return 'var(--text-primary)'
  const a = parseFloat(actual.replace(/[^0-9.-]/g, ''))
  const f = parseFloat(forecast.replace(/[^0-9.-]/g, ''))
  if (isNaN(a) || isNaN(f)) return 'var(--text-primary)'
  return a >= f ? 'var(--text-positive)' : 'var(--text-negative)'
}

function Countdown({ targetDate, targetTime }: { targetDate: string; targetTime: string }) {
  const [display, setDisplay] = useState('')
  useEffect(() => {
    const update = () => {
      const target = new Date(`${targetDate}T${targetTime || '09:00'}:00-05:00`)
      const diff = target.getTime() - Date.now()
      if (diff <= 0) { setDisplay('RELEASED'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setDisplay(h > 24 ? `${Math.floor(h/24)}d ${h%24}h` : `${h}h ${m}m ${s}s`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [targetDate, targetTime])
  return <span className="gv-num" style={{ fontSize:10, color:'var(--text-warning)' }}>{display}</span>
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [week, setWeek] = useState<'prev'|'this'|'next'>('this')
  const [currency, setCurrency] = useState('ALL')
  const [impactFilter, setImpactFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState('')

  const load = useCallback(async (w: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/calendar?week=${w}`)
      const j = await res.json()
      if (j.data) { setEvents(j.data); setSource(j.source || 'live') }
    } catch {
      // Network failure: keep current events; the page shows its empty state.
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(week) }, [week])

  const today = new Date().toISOString().slice(0, 10)

  const filtered = events.filter(e => {
    if (currency !== 'ALL' && e.currency !== currency) return false
    if (impactFilter !== 'ALL' && e.impact !== impactFilter.toLowerCase()) return false
    return true
  })

  const upcoming5High = events
    .filter(e => e.impact === 'high' && new Date(`${e.date}T${e.time||'09:00'}:00`) > new Date())
    .slice(0, 5)

  const next3High = events.filter(e => e.impact === 'high').slice(0, 3)

  // Active = accent fill + on-accent text (as every toggle in the app).
  const btnStyle = (active: boolean) => ({
    fontSize:9, cursor:'pointer', fontWeight: active ? 700 : 500,
    color: active ? 'var(--on-accent)' : 'var(--text-2)',
    background: active ? 'var(--accent)' : 'transparent',
    border: `var(--bw) solid ${active ? 'var(--accent)' : 'transparent'}`,
    padding:'3px 8px', borderRadius:'var(--radius-inner)',
  })

  return (
    <div className="p-2 flex gap-2" style={{ height:'100%' }}>
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        {/* Controls */}
        <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
          {(['prev','this','next'] as const).map(w => (
            <button key={w} type="button" aria-pressed={week===w} onClick={() => setWeek(w)} style={{
              ...btnStyle(week===w),
              fontSize:10, padding:'4px 12px', border:`var(--bw) solid ${week===w?'var(--accent)':'var(--border-color)'}`,
            }}>
              {w==='prev'?'← PREV WEEK':w==='this'?'THIS WEEK':'NEXT WEEK →'}
            </button>
          ))}

          <div style={{ width:1, height:18, background:'var(--border-color)', margin:'0 4px' }} />

          {CURRENCIES.map(c => (
            <button key={c} type="button" aria-pressed={currency===c} onClick={() => setCurrency(c)} style={btnStyle(currency===c)}>{c}</button>
          ))}

          <div style={{ width:1, height:18, background:'var(--border-color)', margin:'0 4px' }} />

          {['ALL','HIGH','MEDIUM','LOW'].map(imp => (
            <button key={imp} type="button" aria-pressed={impactFilter===imp} onClick={() => setImpactFilter(imp)} style={btnStyle(impactFilter===imp)}>{imp}</button>
          ))}
        </div>

        <PanelWrapper title="ECONOMIC CALENDAR" loading={loading} source={source} fullHeight>
          <div style={{ overflowY:'auto', maxHeight:'calc(100vh - 175px)' }}>
            <table className="data-table" style={{ width:'100%' }}>
              <thead style={{ position:'sticky', top:0, zIndex:1 }}>
                <tr>
                  <th style={{ textAlign:'left' }}>DATE</th>
                  <th>TIME ET</th>
                  <th>CCY</th>
                  <th style={{ textAlign:'left', minWidth:200 }}>EVENT</th>
                  <th>IMPACT</th>
                  <th>PREVIOUS</th>
                  <th>FORECAST</th>
                  <th>ACTUAL</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((evt, i) => {
                  const isToday = evt.date === today
                  const dt = new Date(`${evt.date}T${evt.time||'09:00'}:00-05:00`)
                  const minsAway = (dt.getTime() - Date.now()) / 60000
                  const upcoming = minsAway > 0 && minsAway <= 120
                  return (
                    <tr key={i} style={{
                      borderLeft: isToday ? '3px solid var(--accent)' : '3px solid transparent',
                      // 5% (not --accent-soft) so the red HIGH badge keeps 4.5:1 on Saffron Dark.
                      background: upcoming ? tint('var(--accent)', 5) : isToday ? 'var(--surface-2)' : 'transparent',
                    }}>
                      <td style={{ textAlign:'left', color:isToday?'var(--text-accent)':'var(--text-secondary)', fontWeight:isToday?700:400, whiteSpace:'nowrap' }}>{evt.date}</td>
                      <td style={{ color:'var(--text-muted)', whiteSpace:'nowrap' }}>{evt.time || '—'}</td>
                      <td><span style={{ fontFamily:'var(--font-sans)', fontSize:10, fontWeight:700, color:'var(--text-accent)' }}>{evt.currency}</span></td>
                      <td style={{ textAlign:'left' }}>
                        <span style={{ fontSize:10, color:'var(--text-primary)' }}>{evt.event}</span>
                      </td>
                      <td><ImpactBadge impact={evt.impact} /></td>
                      <td style={{ color:'var(--text-muted)' }}>{evt.previous || '—'}</td>
                      <td style={{ color:'var(--text-secondary)' }}>{evt.forecast || '—'}</td>
                      <td style={{ color:actualColor(evt.actual, evt.forecast), fontWeight:evt.actual?700:400 }}>
                        {evt.actual || '—'}
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && !loading && (
                  <tr><td colSpan={8} style={{ textAlign:'center', color:'var(--text-muted)', padding:'24px', fontFamily:'var(--font-sans)', fontSize:11 }}>
                    NO EVENTS — TRY A DIFFERENT FILTER OR WEEK
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </PanelWrapper>
      </div>

      {/* Right sidebar */}
      <div style={{ width:220, flexShrink:0, display:'flex', flexDirection:'column', gap:8 }}>
        <PanelWrapper title="UPCOMING HIGH IMPACT">
          <div>
            {upcoming5High.map((evt, i) => (
              <div key={i} style={{ padding:'8px 16px', borderBottom:'var(--bw) solid var(--divider)' }}>
                <div title={evt.event} style={{ fontSize:10, color:'var(--text-primary)', lineHeight:1.3, marginBottom:3 }}>
                  {evt.event.slice(0, 32)}{evt.event.length > 32 ? '…' : ''}
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:9, color:'var(--text-muted)' }}>{evt.currency} · <span className="gv-num">{evt.date}</span></span>
                </div>
                <div style={{ marginTop:3 }}>
                  <Countdown targetDate={evt.date} targetTime={evt.time} />
                </div>
              </div>
            ))}
            {upcoming5High.length === 0 && (
              <div style={{ padding:'12px', fontSize:10, color:'var(--text-muted)', textAlign:'center' }}>No upcoming high impact</div>
            )}
          </div>
        </PanelWrapper>

        <div className="gv-card" style={{ padding:'12px 16px' }}>
          <div style={{ fontSize:'var(--fs-header)', color:'var(--text)', marginBottom:6, fontWeight:700 }}>AI EVENT PREVIEW</div>
          <p style={{ fontSize:9, color:'var(--text-muted)', margin:'0 0 8px 0', lineHeight:1.6 }}>
            Claude will preview impact of the next 3 high-impact events on markets.
          </p>
          <AIButton
            panelData={next3High}
            panelName="ECONOMIC CALENDAR"
            context="Preview what to expect for these upcoming high-impact economic events. Assess likely market impact on equities, forex, and bonds. Mention historical precedents."
            style={{ width:'100%', justifyContent:'center', padding:'5px' }}
          />
        </div>
      </div>
    </div>
  )
}
