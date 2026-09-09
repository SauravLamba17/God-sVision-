'use client'
import { useRef } from 'react'
import { ACCENT, INK, UP } from '@/lib/canvas/globe'
import { AI_LINE_COLORS, useTypewriter } from '@/lib/hooks/useTypewriter'

const BULLETS = [
  'Your brief lands 40 minutes before the open, in your currency & timezone.',
  'Every claim links to the wire that produced it, so nothing arrives unsourced.',
  'Ask it anything in the command bar; it answers against live tape, not a stale index.',
]

export default function LandingAI() {
  const outRef = useRef<HTMLPreElement>(null)
  const { lines, done, idle, blink } = useTypewriter(outRef)

  const status = idle
    ? { text: 'Idle', color: ACCENT }
    : done
      ? { text: 'Brief ready · confidence 0.72', color: UP }
      : { text: 'Reading wires…', color: ACCENT }

  return (
    <section id="ai" data-screen-label="AI Analysis" style={{
      borderBottom: `1px solid rgba(${INK},.1)`, background: '#0d0e11',
    }}>
      <div style={{
        maxWidth: 1440, margin: '0 auto', padding: 'clamp(56px, 6.5vw, 104px) 24px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
        gap: 'clamp(28px, 4vw, 64px)', alignItems: 'start',
      }}>
        <div data-reveal style={{
          border: `1px solid rgba(${INK},.14)`, background: '#08090b',
          boxShadow: '0 1px 1px rgba(0,0,0,.6), 0 30px 70px -40px rgba(0,0,0,1)',
        }}>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'center',
            justifyContent: 'space-between', borderBottom: `1px solid rgba(${INK},.12)`,
            padding: '11px 16px', font: "500 10px/1 'Geist Mono', monospace", color: `rgba(${INK},.44)`,
          }}>
            <span translate="no">gv://desk/analysis &#8212; session 0413</span>
            <span id="gv-ai-status" role="status" aria-live="polite" style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, color: status.color,
            }}>
              <span aria-hidden="true">&#9679;</span><span>{status.text}</span>
            </span>
          </div>

          <pre ref={outRef} id="gv-ai-out" role="log" aria-label="Analysis desk output" style={{
            margin: 0, padding: '20px 18px 26px', minHeight: 'clamp(280px, 32vw, 400px)',
            font: "400 12.5px/1.72 'Geist Mono', monospace", color: `rgba(${INK},.8)`,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {idle ? (
              // Server-rendered placeholder — identical on the first client
              // paint, so nothing can mismatch before the observer fires.
              <span style={{ color: `rgba(${INK},.3)` }}>
                {'  awaiting desk session…\n'}
                {'  ────────────────────────────\n'}
                {'  wire ingest        ░░░░░░░░░\n'}
                {'  position scoring   ░░░░░░░░░\n'}
                {'  brief composition  ░░░░░░░░░'}
              </span>
            ) : (
              <>
                {lines.map(([kind, text], i) => (
                  <span key={i} style={{
                    color: AI_LINE_COLORS[kind],
                    fontWeight: kind === 'hl' || kind === 'cmd' ? 600 : 400,
                  }}>{text + '\n'}</span>
                ))}
                <span aria-hidden="true" style={{
                  color: ACCENT,
                  animation: blink ? 'gv-blink 1s step-end infinite' : undefined,
                }}>▌</span>
              </>
            )}
          </pre>
        </div>

        <div data-reveal data-delay="100" style={{ maxWidth: '44ch' }}>
          <h2 style={{
            margin: 0, font: '600 clamp(24px, 2.7vw, 38px)/1.1 Geist, sans-serif',
            letterSpacing: '-.02em', textWrap: 'balance',
          }}>Watch it read the wires</h2>
          <p style={{
            margin: '18px 0 0', font: '400 16px/1.62 Geist, sans-serif',
            color: `rgba(${INK},.64)`, textWrap: 'pretty',
          }}>
            The desk reads the wires as they land, scores each headline against your watchlist,
            then writes a brief covering the positions it actually moves. You get the reasoning
            trace, the sources &amp; the confidence &#8212; not a sentiment dial.
          </p>
          <ul style={{
            listStyle: 'none', margin: '28px 0 0', padding: 0, display: 'grid', gap: 14,
            font: '400 14px/1.55 Geist, sans-serif', color: `rgba(${INK},.7)`,
          }}>
            {BULLETS.map(b => (
              <li key={b} style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: 12 }}>
                <span aria-hidden="true" style={{
                  color: '#c98a4b', font: "500 12px/1.6 'Geist Mono', monospace",
                }}>&#8250;</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
