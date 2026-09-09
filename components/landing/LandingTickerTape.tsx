'use client'
import { useEffect, useRef, useState } from 'react'
import { DOWN, INK, UP } from '@/lib/canvas/globe'

/** [symbol, price, change, direction] — the design's illustrative tape. */
type TapeRow = [string, string, string, number]

/* The full tape from the approved design. Crypto rows are overwritten with
 * live prices from /api/public/ticker once it answers; everything else stays
 * at these illustrative values (see that route for why). This array is also
 * the fallback if the fetch fails, so the marquee is never empty. */
const TAPE: TapeRow[] = [
  ['AAPL', '241.86', '+1.24%', 1], ['BTC', '67,412', '+2.81%', 1], ['NIFTY', '24,918', '-0.42%', -1],
  ['USDINR', '83.19', '+0.08%', 1], ['ETH', '3,284', '+1.90%', 1], ['SPX', '5,742', '+0.31%', 1],
  ['EURUSD', '1.0842', '-0.12%', -1], ['GOLD', '2,614', '+0.74%', 1], ['NVDA', '128.44', '-1.02%', -1],
  ['RELIANCE', '2,974', '+0.63%', 1], ['WTI', '71.28', '-0.88%', -1], ['JPY', '149.33', '+0.21%', 1],
  ['TSLA', '248.10', '+3.44%', 1], ['SENSEX', '81,442', '-0.28%', -1], ['SOL', '172.60', '+4.12%', 1],
]

interface LiveRow { symbol: string; price: number; changePercent: number }

const fmtPrice = (n: number) =>
  n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 0 })
            : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtChange = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%'

export default function LandingTickerTape() {
  const [rows, setRows] = useState<TapeRow[]>(TAPE)
  const tapeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/public/ticker')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((live: LiveRow[]) => {
        if (!alive || !Array.isArray(live) || !live.length) return
        const bySymbol = new Map(live.map(l => [l.symbol, l]))
        setRows(TAPE.map(row => {
          const l = bySymbol.get(row[0])
          if (!l || typeof l.price !== 'number') return row
          return [row[0], fmtPrice(l.price), fmtChange(l.changePercent), l.changePercent >= 0 ? 1 : -1]
        }))
      })
      // Leave the illustrative array in place — never an empty marquee.
      .catch(() => {})
    return () => { alive = false }
  }, [])

  // Pause on hover and while off screen; honour reduced motion. All of it is
  // effect-side so the server and first client render agree.
  useEffect(() => {
    const el = tapeRef.current
    const wrap = el?.parentElement
    if (!el || !wrap) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) { el.style.animationPlayState = 'paused'; return }

    const pause = () => { el.style.animationPlayState = 'paused' }
    const run = () => { el.style.animationPlayState = 'running' }
    wrap.addEventListener('pointerenter', pause)
    wrap.addEventListener('pointerleave', run)

    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { el.style.animationPlayState = e.isIntersecting ? 'running' : 'paused' })
    }, { rootMargin: '140px 0px' })
    io.observe(el)

    return () => {
      wrap.removeEventListener('pointerenter', pause)
      wrap.removeEventListener('pointerleave', run)
      io.disconnect()
    }
  }, [])

  const cell = (q: TapeRow, key: string) => {
    const up = q[3] > 0
    return (
      <span key={key} style={{
        display: 'inline-flex', gap: 10, alignItems: 'baseline',
        padding: '0 22px', borderRight: `1px solid rgba(${INK},.09)`,
      }}>
        <b translate="no" style={{ color: '#e8e6e1', fontWeight: 600 }}>{q[0]}</b>
        <span style={{ color: `rgba(${INK},.6)` }}>{q[1]}</span>
        <span style={{ color: up ? UP : DOWN }}>{(up ? '▲' : '▼') + ' ' + q[2]}</span>
      </span>
    )
  }

  return (
    <div style={{ overflow: 'hidden', borderTop: `1px solid rgba(${INK},.07)`, background: '#0d0e11' }}>
      <div
        ref={tapeRef}
        id="gv-tape"
        role="marquee"
        aria-label="Live market ticker"
        style={{
          display: 'flex', width: 'max-content', willChange: 'transform',
          animation: 'gv-tape 72s linear infinite', padding: '7px 0',
          font: "500 11px/1 'Geist Mono', monospace", fontVariantNumeric: 'tabular-nums',
        }}
      >
        {/* Doubled so the -50% translate loops seamlessly. */}
        {rows.map((q, i) => cell(q, 'a' + i))}
        {rows.map((q, i) => cell(q, 'b' + i))}
      </div>
    </div>
  )
}
