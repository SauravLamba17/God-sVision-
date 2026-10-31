'use client'
import { useEffect, useRef } from 'react'
import { DOWN_TEXT, INK, UP, inkText } from '@/lib/canvas/globe'
import { arrow, pct } from '@/lib/format'
import { useTickerFeed, statusTag, quoteTitle, type TickerQuote } from './useTickerFeed'

const fmtPrice = (n: number) =>
  n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  : n < 10 ? n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function LandingTickerTape() {
  // No placeholder prices: until the feed answers the tape is empty, and a
  // symbol without a fresh quote is simply absent. Rows arrive in tape order.
  const feed = useTickerFeed()
  const rows = feed ? Object.values(feed) : []
  const tapeRef = useRef<HTMLDivElement>(null)

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

  const cell = (q: TickerQuote, key: string) => {
    const up = q.changePercent > 0
    const dir = arrow(q.changePercent)
    const tag = statusTag(q)
    return (
      <span key={key} title={quoteTitle(q)} style={{
        display: 'inline-flex', gap: 10, alignItems: 'baseline',
        padding: '0 22px', borderRight: `1px solid rgba(${INK},.09)`,
      }}>
        <b translate="no" style={{ color: '#e8e6e1', fontWeight: 600 }}>{q.symbol}</b>
        <span style={{ color: inkText(.6) }}>{fmtPrice(q.price)}</span>
        <span style={{ color: up ? UP : DOWN_TEXT }}>{(dir === '' ? '' : up ? '▲ ' : '▼ ') + pct(q.changePercent, 2)}</span>
        {tag && <span style={{ color: inkText(.45) }}>{tag}</span>}
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
          animation: 'gv-tape 72s linear infinite', padding: '7px 0', minHeight: 25,
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
