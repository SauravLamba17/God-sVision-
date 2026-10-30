'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { tint } from '@/lib/context/ThemeContext'

const AIButton = dynamic(() => import('@/components/terminal/AIButton'), { ssr: false })

interface Rate { bank: string; country: string; rate: number; lastChange: string; direction: 'UP' | 'DOWN' | 'HOLD'; color: string }
interface Speech { id: string; bank: string; speaker: string; title: string; date: string; link: string; sentiment: 'HAWKISH' | 'DOVISH' | 'NEUTRAL'; keyWords: string[] }

const SENT_COLORS = { HAWKISH: 'var(--text-negative)', DOVISH: 'var(--text-positive)', NEUTRAL: 'var(--text-warning)' }
const DIR_ICONS = { UP: '▲', DOWN: '▼', HOLD: '—' }

function HawkDoveMeter({ speeches }: { speeches: Speech[] }) {
  const hawks = speeches.filter(s => s.sentiment === 'HAWKISH').length
  const doves = speeches.filter(s => s.sentiment === 'DOVISH').length
  const total = speeches.length || 1
  const hawkPct = Math.round((hawks / total) * 100)
  const dovePct = Math.round((doves / total) * 100)

  return (
    <div style={{ padding: '8px 16px', borderBottom: 'var(--bw) solid var(--divider)', display: 'flex', alignItems: 'center', gap: 16 }}>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>HAWKISH/DOVISH BALANCE:</span>
      <div style={{ flex: 1, height: 6, background: 'var(--border-color)', borderRadius: 3, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: `${hawkPct}%`, background: 'var(--text-negative)', transition: 'width 0.6s ease' }} />
        <div style={{ width: `${100 - hawkPct - dovePct}%`, background: 'var(--text-warning)' }} />
        <div style={{ width: `${dovePct}%`, background: 'var(--text-positive)' }} />
      </div>
      <span style={{ fontSize: 9, color: 'var(--text-negative)' }}>HAWK <span className="gv-num">{hawkPct}%</span></span>
      <span style={{ fontSize: 9, color: 'var(--text-positive)' }}>DOVE <span className="gv-num">{dovePct}%</span></span>
    </div>
  )
}

export default function CentralBanksPage() {
  const [rates, setRates] = useState<Rate[]>([])
  const [ratesError, setRatesError] = useState<string | null>(null)
  const [speeches, setSpeeches] = useState<Speech[]>([])
  const [loading, setLoading] = useState(true)
  const [bankFilter, setBankFilter] = useState('ALL')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/centralbanks')
        const j = await res.json()
        if (j.rates) setRates(j.rates)
        if (j.ratesError) setRatesError(j.ratesError)
        if (j.speeches) setSpeeches(j.speeches)
      } catch {
        setRatesError('Central bank data unavailable — network error')
      } finally { setLoading(false) }
    }
    load()
  }, [])

  const filtered = bankFilter === 'ALL' ? speeches : speeches.filter(s => s.bank === bankFilter)

  return (
    <div className="gv-card" style={{ margin: 12, color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: 'var(--bw) solid var(--divider)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)' }}>CENTRAL BANK INTELLIGENCE</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>Fed · ECB · BOE · BOJ · BOC · RBI — Rate Decisions & Speeches</div>
        </div>
        <AIButton panelName="Central Banks" panelData={{ rates, speeches: speeches.slice(0, 5) }} context="Analyze the current central bank landscape: rates, recent speeches, hawkish vs dovish balance. What's the global monetary policy trend? Where are the risks and opportunities?" />
      </div>

      {/* Rate Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--bw)', padding: 0, background: 'var(--divider)', borderBottom: 'var(--bw) solid var(--divider)' }}>
        {ratesError && (
          <div style={{ gridColumn: '1 / -1', background: 'var(--surface)', padding: '10px 12px', fontSize: 10, color: 'var(--text-muted)' }}>{ratesError}</div>
        )}
        {rates.map(r => (
          <div key={r.bank} onClick={() => setBankFilter(bankFilter === r.bank ? 'ALL' : r.bank)}
            style={{ background: bankFilter === r.bank ? 'var(--surface-2)' : 'var(--surface)', padding: '10px 12px', cursor: 'pointer', transition: 'background 0.2s', borderBottom: bankFilter === r.bank ? '3px solid var(--accent)' : '3px solid transparent' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-text)', letterSpacing: '0.05em' }}>{r.bank}</span>
              <span style={{ fontSize: 8, color: r.direction === 'UP' ? 'var(--text-positive)' : r.direction === 'DOWN' ? 'var(--text-negative)' : 'var(--text-muted)' }}>
                {DIR_ICONS[r.direction]}
              </span>
            </div>
            <div className="gv-num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{r.rate.toFixed(2)}%</div>
            <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 6 }}>{r.country}</div>
            <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 2 }}>As of {r.lastChange}</div>
          </div>
        ))}
      </div>

      {/* Hawk/Dove Meter */}
      <HawkDoveMeter speeches={filtered} />

      {/* Filter row */}
      <div style={{ padding: '8px 16px', borderBottom: 'var(--bw) solid var(--divider)', display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>FILTER:</span>
        {['ALL', 'FED', 'ECB', 'BOE', 'BOC'].map(b => (
          <button key={b} type="button" className="gv-tab" aria-pressed={bankFilter === b} onClick={() => setBankFilter(b)}>
            {b}
          </button>
        ))}
      </div>

      {/* Speech Timeline */}
      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', fontSize: 10, color: 'var(--text-accent)' }}>FETCHING CENTRAL BANK RSS FEEDS...</div>
      ) : (
        <div>
          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 10, color: 'var(--text-muted)' }}>No speeches found. RSS feeds may be temporarily unavailable.</div>
          )}
          {filtered.map(speech => (
            <div key={speech.id}>
              <div
                onClick={() => setExpanded(expanded === speech.id ? null : speech.id)}
                className="gv-row"
                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 16px', borderBottom: 'var(--bw) solid var(--divider)', cursor: 'pointer', background: expanded === speech.id ? 'var(--surface-2)' : undefined }}
              >
                {/* Timeline dot */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3, flexShrink: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: SENT_COLORS[speech.sentiment] }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-accent)', letterSpacing: '0.1em' }}>
                      {speech.bank}
                    </span>
                    <span style={{ fontSize: 8, background: tint(SENT_COLORS[speech.sentiment], 9), border: 'var(--bw) solid currentColor', color: SENT_COLORS[speech.sentiment], padding: '0 5px', borderRadius: 4 }}>
                      {speech.sentiment}
                    </span>
                    <span style={{ fontSize: 8, color: 'var(--text-muted)', marginLeft: 'auto' }}>{speech.date}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.4 }}>{speech.title}</div>
                  {speech.keyWords.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      {speech.keyWords.map(w => (
                        <span key={w} style={{ fontSize: 8, color: SENT_COLORS[speech.sentiment], background: tint(SENT_COLORS[speech.sentiment], 6), padding: '1px 4px', borderRadius: 4 }}>
                          {w}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{expanded === speech.id ? '▲' : '▼'}</span>
              </div>
              {expanded === speech.id && (
                <div style={{ padding: '10px 36px', borderBottom: 'var(--bw) solid var(--divider)', background: 'var(--surface-2)', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <a href={speech.link} target="_blank" rel="noreferrer" style={{ fontSize: 9, color: 'var(--text-accent)', textDecoration: 'none' }}>
                    VIEW FULL SPEECH ON {speech.bank} WEBSITE →
                  </a>
                  <AIButton
                    panelName={`${speech.bank} Speech`}
                    panelData={speech}
                    context={`Analyze this central bank speech/statement from ${speech.bank}: "${speech.title}". Detected tone: ${speech.sentiment}. Key terms: ${speech.keyWords.join(', ')}. What are the policy implications? Hawkish or dovish shift? Market impact?`}
                    style={{ marginTop: 0 }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
