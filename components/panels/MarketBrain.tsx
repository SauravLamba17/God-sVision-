'use client'
import { useEffect, useState } from 'react'
import { useMode } from '@/lib/context/ModeContext'
import type { BrainResponse } from '@/lib/brain'
import type { SectionKey } from '@/lib/brain/text'
import type { Theme } from '@/lib/brain/types'
import { pct } from '@/lib/format'

// Market Brain: one evidence-built picture of the market (replaces the AI Morning
// Brief and the AI Narrative Detector). Text is rendered server-side from the
// structured brain with LIVE numbers; AI prose (if enabled) is labelled AI.
const SECTION_TITLE: Record<SectionKey, string> = {
  state: 'MARKET STATE', sectors: 'SECTORS', movers: 'TOP MOVERS', crossAsset: 'CROSS-ASSET',
  events: 'WORLD EVENTS', themes: 'THEMES', upcoming: 'UPCOMING',
}
const LIVE_SECTIONS = new Set<SectionKey>(['state', 'sectors', 'movers', 'crossAsset'])
const ORDER: SectionKey[] = ['state', 'sectors', 'movers', 'crossAsset', 'themes', 'events', 'upcoming']
const TZ = { us: { tz: 'America/New_York', label: 'ET' }, in: { tz: 'Asia/Kolkata', label: 'IST' } }
const TONE = { BULLISH: 'var(--text-positive)', BEARISH: 'var(--text-negative)', NEUTRAL: 'var(--text-muted)' }

const badge = (label: string, color: string, title: string) => (
  <span title={title} style={{ fontSize: 'var(--fs-badge)', fontWeight: 700, letterSpacing: '0.06em', padding: '0 5px', border: `1px solid ${color}66`, color, borderRadius: 2 }}>{label}</span>
)

function ThemeRow({ t, fmt }: { t: Theme; fmt: (n: number) => string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderTop: '1px solid #0d1526', padding: '4px 0' }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'baseline', width: '100%', minWidth: 0 }}>
        <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>{open ? '▾' : '▸'}</span>
        <span style={{ fontWeight: 700, color: 'var(--text-accent)', whiteSpace: 'nowrap' }}>{t.title}</span>
        <span style={{ flex: 1, minWidth: 0, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t.stories} headlines · {t.sources} sources · coincides with {t.moves.slice(0, 3).map(m => `${m.name.replace(/ \((avg|\d+ stocks)[^)]*\)$/, '')} ${pct(m.changePct, 1, '−')}`).join(', ')}
        </span>
        <span title="Theme score: coverage (stories, sources) and size of the related move" style={{ fontSize: 'var(--fs-badge)', color: 'var(--text-muted)' }}>{t.score.toFixed(2)}</span>
      </button>
      {open && (
        <div style={{ margin: '4px 0 2px 16px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>
            Headline tone (keyword estimate): {t.tone.positive} positive · {t.tone.negative} negative · {t.tone.neutral} neutral
          </div>
          {t.headlines.map((h, i) => (
            <div key={i} style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>
              <span style={{ color: TONE[h.tone] }}>●</span>{' '}
              {h.source.url ? <a href={h.source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)' }}>{h.title}</a> : h.title}
              <span style={{ color: 'var(--text-muted)' }}> — {h.source.name} · {fmt(h.at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MarketBrain() {
  const { mode } = useMode()
  const market = mode === 'INDIA' ? 'in' : 'us'
  const [data, setData] = useState<BrainResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({ state: true, sectors: false, movers: true, crossAsset: false, themes: true, events: false, upcoming: false })

  const load = async () => {
    setLoading(true)
    try {
      const j = await (await fetch(`/api/brain/${market}`)).json()
      if (j.data) { setData(j.data); setError('') } else setError(j.error ?? 'unavailable')
    } catch {
      setError('could not reach the server')
    } finally { setLoading(false) }
  }
  useEffect(() => {
    setData(null)
    load()
    // Same 15-min cadence as the Narrative Detector this replaces (the server serves it from cache).
    const id = setInterval(load, 900_000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market])

  const { tz, label } = TZ[market]
  const fmt = (t: number) => `${new Date(t).toLocaleString('en-US', { timeZone: tz, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} ${label}`
  const ai = data?.showNarration && data.brain.narration

  return (
    <div style={{ border: '1px solid var(--border-color)', borderLeft: '2px solid var(--text-accent)', background: 'var(--bg-panel)', fontFamily: 'IBM Plex Mono', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '6px 10px', borderBottom: '1px solid #1b2e1b', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--fs-header)', color: 'var(--text-accent)', letterSpacing: '0.03em', fontWeight: 700 }}>🧠 MARKET BRAIN — {market === 'in' ? 'INDIA' : 'USA'}</span>
        {data && (ai
          ? badge('AI', '#a78bfa', `AI prose (${data.brain.narration!.provider}) written only from the evidence below`)
          : badge('EVIDENCE', '#38bdf8', 'Built in code from market, sector, news, event and calendar data — correlation, not proof of cause'))}
        {data && <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>session {data.brain.session.status.toLowerCase()} · {data.brain.session.date}</span>}
        <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>
          {data ? `built ${fmt(data.generatedAt)} · numbers live ${fmt(data.renderedAt)}` : loading ? 'BUILDING…' : ''}
        </span>
        <button onClick={load} disabled={loading} title="Reload (served from the shared cache; numbers re-read live)"
          style={{ background: 'none', border: '1px solid var(--border-color)', color: loading ? 'var(--text-muted)' : 'var(--text-accent)', fontFamily: 'IBM Plex Mono', fontSize: 'var(--fs-meta)', padding: '1px 6px', borderRadius: 2, cursor: loading ? 'default' : 'pointer' }}>
          ↻
        </button>
      </div>

      {!data ? (
        <div style={{ padding: 12, fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>
          {loading ? 'Building the market picture from live data…' : `Market Brain unavailable right now — ${error}.`}
        </div>
      ) : (
        // Scrolls inside a fixed window (as the Morning Brief did) so opening sections
        // or themes doesn't stretch Fear Radar / RBI Policy beside it into blank space.
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--fs-body)', maxHeight: 320, overflowY: 'auto' }}>
          <div style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>
            {ai ? data.brain.narration!.text : data.text.summary}
            {ai && <span style={{ display: 'block', fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>AI-written {fmt(data.brain.narration!.generatedAt)} from the evidence below; figures are in the sections.</span>}
          </div>
          {ORDER.map(k => (
            <div key={k} style={{ borderTop: '1px solid #1b2e1b', paddingTop: 4 }}>
              <button onClick={() => setOpen(o => ({ ...o, [k]: !o[k] }))} aria-expanded={open[k]}
                style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 6, width: '100%' }}>
                <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>{open[k] ? '▾' : '▸'}</span>
                <span style={{ fontSize: 'var(--fs-meta)', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-warning)' }}>{SECTION_TITLE[k]}</span>
                {k === 'themes' && <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>({data.brain.themes.length})</span>}
                <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-badge)', color: 'var(--text-muted)' }}>
                  {LIVE_SECTIONS.has(k) ? `live ${fmt(data.renderedAt)}` : `as of ${fmt(data.generatedAt)}`}
                </span>
              </button>
              {open[k] && (
                k === 'themes' && data.brain.themes.length
                  ? <div style={{ marginTop: 2 }}>{data.brain.themes.map(t => <ThemeRow key={t.id} t={t} fmt={fmt} />)}</div>
                  : <div style={{ marginTop: 2, color: 'var(--text-secondary)', lineHeight: 1.6, overflowWrap: 'anywhere' }}>{data.text.sections[k]}</div>
              )}
            </div>
          ))}
          <div style={{ fontSize: 'var(--fs-badge)', color: 'var(--text-muted)' }}>
            Evidence shows what moved together, not proof of cause. No predictions or advice.
          </div>
        </div>
      )}
    </div>
  )
}
