'use client'
import { useCallback, useRef } from 'react'
import { INK, type SizedCanvas } from '@/lib/canvas/globe'
import { useGlobeAnimation } from '@/lib/hooks/useGlobeAnimation'

const STATS: Array<[string, string, string, string, boolean]> = [
  ['Flight tracking', 'Thousands', 'of commercial aircraft tracked live, routed & continuously refreshed.', '1.6 1 250px', false],
  ['Seismic', 'M 4.0+', 'alerts pulled near real‑time from the USGS feed, tagged by exposed index.', '1 1 195px', true],
  ['Orbital', 'ISS', 'ground track & pass predictions, because the founder wanted them there.', '.85 1 180px', false],
  ['Financial centres', '10', 'session clocks with open, close & overlap windows on one arc.', '1.25 1 215px', true],
]

export default function LandingWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Camera curve ported verbatim from the reference's frameBody(): as the
  // section crosses the viewport it rises, grows, spins and fades up from .25.
  const frameFn = useCallback((canvas: SizedCanvas, t: number) => {
    const vh = window.innerHeight
    const r = canvas.getBoundingClientRect()
    const p = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)))
    const w = canvas._w || 0, h = canvas._h || 0
    const R = Math.min(w * 0.44, h * 0.62) * (0.86 + p * 0.28)

    return {
      cx: w * 0.5, cy: h * (0.62 - p * 0.14),
      r: R, yaw: -0.4 + t * 0.045 + p * 1.1, pitch: 0.5 - p * 0.42,
      alpha: Math.min(1, Math.max(0.25, p * 2.2 - 0.1)),
      arcs: true, arcLift: 1.5, labels: true, t,
    }
  }, [])

  useGlobeAnimation(canvasRef, frameFn)

  return (
    <section id="world" data-screen-label="World Intelligence" style={{
      position: 'relative', borderBottom: `1px solid rgba(${INK},.1)`, overflow: 'hidden',
    }}>
      <canvas ref={canvasRef} id="gv-world-globe" aria-hidden="true" style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none',
      }} />
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(120% 90% at 50% 46%, rgba(10,11,13,0) 32%, rgba(10,11,13,.88) 78%)',
      }} />

      <div style={{
        position: 'relative', maxWidth: 1440, margin: '0 auto',
        padding: 'clamp(68px, 9vw, 140px) 24px', minHeight: 'min(90dvh, 820px)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        gap: 'clamp(44px, 7vw, 108px)',
      }}>
        <div data-reveal style={{ maxWidth: 540 }}>
          <h2 style={{
            margin: 0, font: '600 clamp(25px, 2.9vw, 42px)/1.08 Geist, sans-serif',
            letterSpacing: '-.022em', textWrap: 'balance',
          }}>The world moves markets. Put it on the same screen.</h2>
          <p style={{
            margin: '18px 0 0', font: '400 16px/1.62 Geist, sans-serif',
            color: `rgba(${INK},.66)`, maxWidth: '46ch', textWrap: 'pretty',
          }}>
            Live commercial air traffic, USGS seismic alerts &amp; ISS orbit, plotted against the
            tape. A magnitude 6.1 off Honshu shows up beside JPY before the desk note does.
          </p>
        </div>

        <div data-reveal data-delay="120" style={{
          display: 'flex', flexWrap: 'wrap', gap: 1, background: `rgba(${INK},.12)`,
          border: `1px solid rgba(${INK},.14)`, backdropFilter: 'blur(6px)',
          boxShadow: '0 1px 1px rgba(0,0,0,.5), 0 28px 60px -40px rgba(0,0,0,1)',
        }}>
          {STATS.map(([label, value, body, flex, tabular]) => (
            <div key={label} style={{ flex, background: 'rgba(16,17,20,.9)', padding: '20px 18px' }}>
              <div style={{ font: "500 10px/1 'Geist Mono', monospace", color: '#d99a5c' }}>{label}</div>
              <div
                translate={label === 'Orbital' ? 'no' : undefined}
                style={{
                  font: "600 26px/1 'Geist Mono', monospace", margin: '12px 0 8px',
                  fontVariantNumeric: tabular ? 'tabular-nums' : undefined,
                }}
              >{value}</div>
              <div style={{
                font: '400 13px/1.5 Geist, sans-serif', color: `rgba(${INK},.56)`,
              }}>{body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
