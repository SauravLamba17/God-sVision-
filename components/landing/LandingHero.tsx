'use client'
import { useCallback, useRef } from 'react'
import { INK, type SizedCanvas } from '@/lib/canvas/globe'
import { useGlobeAnimation } from '@/lib/hooks/useGlobeAnimation'
import { REGISTER_HREF } from './links'

const STATS: Array<[string, string, number]> = [
  ['$0', 'per seat / year', 1.3],
  ['Real‑time', 'tick refresh', 1],
  ['3', 'asset classes, one tape', 0.8],
  ['24 / 7', 'wire & world feeds', 1.1],
]

const statLabel: React.CSSProperties = {
  font: "500 10px/1.4 'Geist Mono', monospace", color: `rgba(${INK},.44)`, marginTop: 8,
}

export default function LandingHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // The readout updates every frame, so it is written straight to the node
  // rather than through state — 30 re-renders a second of this whole section
  // would be pure waste. The JSX below carries the same static placeholder the
  // reference ships, so the server and first client paint agree and the effect
  // takes over from there.
  const readoutRef = useRef<HTMLSpanElement>(null)

  // Camera curve ported verbatim from the reference's frameBody(): scroll
  // progress p pushes the globe right and down, widens it, spins yaw and
  // flattens pitch while fading out.
  const frameFn = useCallback((canvas: SizedCanvas, t: number) => {
    const vh = window.innerHeight
    const r = canvas.getBoundingClientRect()
    const p = Math.max(0, Math.min(1.4, -r.top / vh))
    const w = canvas._w || 0, h = canvas._h || 0
    const R = Math.min(w, h) * (0.46 + p * 0.4)
    const yaw = t * 0.07 + p * 1.5

    if (readoutRef.current) {
      readoutRef.current.textContent =
        'cam.z ' + (1 + p * 0.9).toFixed(2) +
        ' · yaw ' + (((yaw * 57.3) % 360 + 360) % 360).toFixed(1).padStart(5, '0') + '°'
    }

    return {
      cx: w * (0.56 + p * 0.1), cy: h * (0.46 + p * 0.22),
      r: R, yaw, pitch: 0.34 - p * 0.5,
      alpha: Math.max(0, 1 - p * 0.65), arcs: true, arcLift: 1, labels: false, t,
    }
  }, [])

  useGlobeAnimation(canvasRef, frameFn)

  return (
    <section data-screen-label="Hero" style={{
      position: 'relative', borderBottom: `1px solid rgba(${INK},.1)`, overflow: 'hidden',
    }}>
      <canvas ref={canvasRef} id="gv-hero-globe" aria-hidden="true" style={{
        position: 'absolute', top: 0, right: 0, width: '64%', height: '100%', pointerEvents: 'none',
      }} />
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(96deg, #0a0b0d 20%, rgba(10,11,13,.7) 46%, rgba(10,11,13,0) 70%)',
      }} />

      <div style={{
        position: 'relative', maxWidth: 1440, margin: '0 auto',
        padding: 'clamp(52px, 8vw, 104px) 24px clamp(40px, 5vw, 76px)',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
        gap: 40, alignItems: 'center', minHeight: 'min(76dvh, 680px)',
      }}>
        <div style={{ maxWidth: 620 }}>
          <p data-reveal style={{
            display: 'inline-flex', alignItems: 'center', gap: 10, margin: '0 0 24px',
            border: '1px solid rgba(201,138,75,.36)', padding: '8px 12px',
            font: "500 11px/1 'Geist Mono', monospace", color: '#d99a5c',
          }}>
            <span data-pulse aria-hidden="true" style={{
              width: 6, height: 6, borderRadius: '50%', background: '#c98a4b',
              animation: 'gv-live 1.8s ease-in-out infinite',
            }} />
            <span>Live &#183; equities, crypto &amp; FX streaming</span>
          </p>

          <h1 data-reveal data-delay="60" style={{
            margin: 0, font: '600 clamp(30px, 3.9vw, 54px)/1.06 Geist, sans-serif',
            letterSpacing: '-.026em', textWrap: 'balance',
          }}>
            A terminal that reads the whole tape &#8212; and costs{' '}
            <span style={{ color: '#d99a5c' }}>nothing</span> to run.
          </h1>

          <p data-reveal data-delay="120" style={{
            margin: '22px 0 0', maxWidth: '50ch',
            font: '400 clamp(15px, 1.2vw, 17px)/1.62 Geist, sans-serif',
            color: `rgba(${INK},.64)`, textWrap: 'pretty',
          }}>
            Equities, crypto &amp; FX on one tick engine. An analysis desk that reads the wires and
            writes your morning brief before the open. Flight, seismic &amp; orbital feeds on the
            same clock. Built by one person, priced at zero.
          </p>

          <dl data-reveal data-delay="180" style={{
            display: 'flex', flexWrap: 'wrap', gap: 1, margin: '38px 0 0',
            background: `rgba(${INK},.12)`, border: `1px solid rgba(${INK},.12)`,
            boxShadow: '0 1px 1px rgba(0,0,0,.5), 0 12px 28px -18px rgba(0,0,0,.9)',
          }}>
            {STATS.map(([value, label, grow], i) => (
              <div key={label} style={{
                flex: `${grow} 1 ${[128, 118, 108, 124][i]}px`, background: '#101114', padding: 16,
              }}>
                <dd style={{
                  margin: 0,
                  font: i === 1
                    ? "600 clamp(19px, 2vw, 26px)/1 'Geist Mono', monospace"
                    : "600 clamp(22px, 2.3vw, 30px)/1 'Geist Mono', monospace",
                  fontVariantNumeric: i === 0 || i === 2 ? 'tabular-nums' : undefined,
                }}>{value}</dd>
                <dt style={statLabel}>{label}</dt>
              </div>
            ))}
          </dl>

          <div data-reveal data-delay="240" style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 28,
          }}>
            <a href={REGISTER_HREF} className="gv-btn-primary" style={{
              display: 'inline-flex', alignItems: 'center', minHeight: 48,
              font: "600 14px/1 'Geist Mono', monospace", padding: '0 24px',
              boxShadow: '0 1px 1px rgba(0,0,0,.5), 0 10px 24px -10px rgba(201,138,75,.5)',
            }}>Open the terminal &#8594;</a>
            <a href="#ledger" className="gv-btn-ghost" style={{
              display: 'inline-flex', alignItems: 'center', minHeight: 48,
              font: "500 14px/1 'Geist Mono', monospace", padding: '0 20px',
            }}>See the cost comparison</a>
          </div>
        </div>
        <div aria-hidden="true" />
      </div>

      <div style={{
        position: 'relative', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
        gap: '8px 20px', borderTop: `1px solid rgba(${INK},.1)`, maxWidth: 1440, margin: '0 auto',
        padding: '11px 24px', font: "500 10px/1.4 'Geist Mono', monospace", color: `rgba(${INK},.36)`,
      }}>
        <span>Scroll &#8595; camera tracks the globe</span>
        <span ref={readoutRef} id="gv-scroll-readout" style={{ fontVariantNumeric: 'tabular-nums' }}>
          cam.z 1.00 &#183; yaw 000.0&#176;
        </span>
      </div>
    </section>
  )
}
