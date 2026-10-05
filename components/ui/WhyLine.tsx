'use client'
import { useState } from 'react'
import type { Market } from '@/lib/evidence/types'
import { useWhy } from '@/lib/hooks/useWhy'

// "Why" line: compact evidence summary for a mover, expandable to every driver
// with its score, source link and time. The live move itself is shown by the
// row/card it sits in — this line never repeats cached prices.
const TZ: Record<Market, { tz: string; label: string }> = { US: { tz: 'America/New_York', label: 'ET' }, IN: { tz: 'Asia/Kolkata', label: 'IST' } }
const WEAK = 0.5 // drivers below this are labelled WEAK in the expanded view
const TYPE_LABEL: Record<string, string> = {
  market: 'MARKET', sector: 'SECTOR', peers: 'PEERS', news: 'NEWS', related_news: 'RELATED NEWS', linked_event: 'LINKED EVENT',
  commodity: 'COMMODITY', currency: 'CURRENCY', scheduled: 'SCHEDULED', volume: 'VOLUME', breadth: 'BREADTH', global: 'GLOBAL', no_clear_driver: 'NO CLEAR DRIVER',
}

export function WhyLine({ market, symbol, liveChangePct, variant = 'row' }: { market: Market; symbol: string; liveChangePct: number | null | undefined; variant?: 'row' | 'card' | 'header' }) {
  const { explanation: e, status, showNarration } = useWhy(market, symbol, liveChangePct)
  const [open, setOpen] = useState(false)
  const fs = variant === 'header' ? 10 : 9

  if (status === 'none') return null
  if (status === 'updating' || !e) {
    return <div style={{ fontFamily: 'IBM Plex Mono', fontSize: fs, color: 'var(--text-muted)', fontStyle: 'italic' }}>updating evidence…</div>
  }

  const t = TZ[market]
  const time = new Date(e.generatedAt).toLocaleTimeString('en-US', { timeZone: t.tz, hour: '2-digit', minute: '2-digit', hour12: false })
  const ai = showNarration && e.narration
  const text = ai ? e.narration!.text : e.summary
  const badge = ai
    ? { label: 'AI', color: '#a78bfa', title: `AI narration (${e.narration!.provider}) of the evidence below — it may only restate that evidence` }
    : { label: 'EVIDENCE', color: '#38bdf8', title: 'Computed from market, sector, peer, news and event data — correlation, not proof of cause' }

  return (
    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: fs, color: 'var(--text-secondary)', minWidth: 0 }} onClick={ev => ev.stopPropagation()}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        title={open ? 'Hide evidence' : 'Show evidence'}
        style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 6, width: '100%', minWidth: 0 }}
      >
        <span title={badge.title} style={{ flexShrink: 0, fontSize: 7, fontWeight: 700, letterSpacing: '0.06em', padding: '0 4px', border: `1px solid ${badge.color}66`, color: badge.color, borderRadius: 2 }}>{badge.label}</span>
        <span style={{ flex: 1, minWidth: 0, ...(open || variant === 'header' ? { whiteSpace: 'normal' } : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }) }}>{text}</span>
        <span style={{ flexShrink: 0, color: 'var(--text-muted)', fontSize: 8 }}>{time} {t.label} {open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 4, borderLeft: '1px solid var(--border-color)' }}>
          {ai && <div style={{ fontSize: 8, color: 'var(--text-muted)' }}>Evidence summary: {e.summary}</div>}
          {e.drivers.map((d, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '84px 34px minmax(0,1fr)', gap: 6, alignItems: 'baseline' }}>
              <span style={{ fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{TYPE_LABEL[d.type] ?? d.type}</span>
              <span title={`score ${d.score.toFixed(2)}`} style={{ height: 4, background: 'var(--border-color)', borderRadius: 2, overflow: 'hidden', alignSelf: 'center' }}>
                <span style={{ display: 'block', height: '100%', width: `${Math.round(d.score * 100)}%`, background: d.score >= 0.5 ? 'var(--text-positive)' : d.score >= 0.3 ? 'var(--text-warning)' : 'var(--text-muted)' }} />
              </span>
              <span style={{ fontSize: 8, color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>
                {d.type !== 'no_clear_driver' && (
                  <span title={`Evidence score ${d.score.toFixed(2)} of 1 — below 0.5 is a weak match, not strong evidence`}
                    style={{ marginRight: 4, fontSize: 7, letterSpacing: '0.04em', color: d.score < WEAK ? 'var(--text-warning)' : 'var(--text-muted)' }}>
                    {d.score < WEAK ? `WEAK ${d.score.toFixed(2)}` : d.score.toFixed(2)}
                  </span>
                )}
                {d.evidence}{' '}
                <span style={{ color: 'var(--text-muted)' }}>
                  — {d.source.url ? <a href={d.source.url} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>{d.source.name}</a> : d.source.name}
                  {' · '}{new Date(d.timestamp).toLocaleString('en-US', { timeZone: t.tz, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
