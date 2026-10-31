'use client'
import { useEffect, useState } from 'react'
import { ACCENT_TEXT, DOWN_TEXT, INK, UP, inkText } from '@/lib/canvas/globe'
import { useMode } from '@/lib/context/ModeContext'
import { arrow, pct } from '@/lib/format'
import { marketState } from '@/lib/tickerStatus'
import { useTickerFeed, statusTag, quoteTitle, fmtPrice } from './useTickerFeed'

/* The reference prototype kept its own local `mode` state and mirrored it into
 * a ?locale= query param. Here the widget drives the real terminal ModeContext
 * instead, so the choice a visitor makes on the landing page is the mode their
 * dashboard opens in after they sign in — ModeContext already persists it to
 * localStorage, which supersedes the prototype's URL-param trick. */

// Benchmark levels, USD/INR and the market state are real (the landing ticker feed and
// the exchange's session hours); the portfolio value is a sample and is labelled so.
const US_PANEL = {
  index: 'S&P 500', symbol: 'SPX', session: 'us' as const,
  tz: 'America/New_York · ET',
  watch: 'AAPL NVDA MSFT SPY BTC', brief: '08:50 ET daily',
}

const IN_PANEL = {
  index: 'NIFTY 50', symbol: 'NIFTY', session: 'in' as const,
  tz: 'Asia/Kolkata · IST',
  watch: 'RELIANCE HDFCBANK TCS NIFTY BTC', brief: '08:20 IST daily',
}

/** The sample portfolio, held in USD; the India view converts it at the live USD/INR. */
const EXAMPLE_USD = 1_284_600.42

const duration = (min: number) => {
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60
  return d > 0 ? `${d} d ${h} h` : `${h} h ${m} m`
}

const CLOCK_PLACEHOLDER = '——:——:——'

const dtLabel: React.CSSProperties = {
  font: "500 9px/1 'Geist Mono', monospace", color: inkText(.4),
}
const ddSub: React.CSSProperties = {
  margin: 0, font: "500 12px/1 'Geist Mono', monospace", color: inkText(.5),
}

export default function LandingDualMode() {
  const { isIndia, toggleMode, timezone } = useMode()
  // Static em-dash placeholder for the server and the first client paint —
  // a real time here would guarantee a hydration mismatch. The interval below
  // takes over once mounted, exactly as the reference's clock does.
  const [clock, setClock] = useState(CLOCK_PLACEHOLDER)
  const [session, setSession] = useState<{ open: boolean; minutes: number } | null>(null)
  const feed = useTickerFeed()

  const dm = isIndia ? IN_PANEL : US_PANEL
  const q = feed?.[dm.symbol]
  const inr = feed?.USDINR
  const idxText = q ? `${arrow(q.changePercent) && arrow(q.changePercent) + ' '}${pct(q.changePercent, 2, '−')}  ${fmtPrice(q.price)}` : '—'
  const idxColor = !q || q.changePercent === 0 ? inkText(.7) : q.changePercent > 0 ? UP : DOWN_TEXT
  const value = !isIndia
    ? '$' + EXAMPLE_USD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : inr ? '₹' + (EXAMPLE_USD * inr.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
  const fx = !isIndia ? 'base USD · 1.0000' : inr ? `USDINR · ${inr.price.toFixed(2)}` : 'USDINR · —'

  // ModeContext exposes only toggleMode, so "set to X" is a toggle guarded by
  // the current value — this keeps the core auth/mode config untouched.
  const setMode = (india: boolean) => { if (india !== isIndia) toggleMode() }

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: timezone,
    })
    const tick = () => {
      setClock(fmt.format(new Date()))
      const s = marketState(isIndia ? 'in' : 'us')
      setSession(prev => (prev?.open === s.open && prev.minutes === s.minutes ? prev : s))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [timezone, isIndia])

  // ⌘J / Ctrl+J, as the section's copy promises.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        toggleMode()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleMode])

  const tabStyle = (active: boolean): React.CSSProperties => ({
    minHeight: 44, padding: '0 16px', border: 0, cursor: 'pointer',
    background: active ? ACCENT_TEXT : '#101114',
    color: active ? '#0a0b0d' : inkText(.62),
    font: "600 11px/1 'Geist Mono', monospace",
    transition: 'background .28s ease, color .28s ease',
  })

  return (
    <section id="dual" data-screen-label="Dual Mode" style={{ borderBottom: `1px solid rgba(${INK},.1)` }}>
      <div style={{
        maxWidth: 1440, margin: '0 auto', padding: 'clamp(56px, 6.5vw, 104px) 24px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
        gap: 'clamp(28px, 4vw, 64px)', alignItems: 'center',
      }}>
        <div data-reveal style={{ maxWidth: '42ch' }}>
          <h2 style={{
            margin: 0, font: '600 clamp(24px, 2.7vw, 38px)/1.1 Geist, sans-serif',
            letterSpacing: '-.02em', textWrap: 'balance',
          }}>Two markets, one keystroke</h2>
          <p style={{
            margin: '18px 0 0', font: '400 16px/1.62 Geist, sans-serif',
            color: inkText(.64), textWrap: 'pretty',
          }}>
            Press &#8984;J and the terminal re&#8209;bases: currency, session clock, exchange
            calendar, tax lots, the brief. Not a display toggle &#8212; the FX conversion &amp;
            market hours change underneath, and the workspace is deep&#8209;linkable.
          </p>
          <p style={{
            display: 'inline-flex', alignItems: 'center', gap: 12, margin: '26px 0 0',
            font: "500 11px/1 'Geist Mono', monospace", color: inkText(.45),
          }}>
            <kbd style={{
              border: `1px solid rgba(${INK},.22)`, padding: '8px 10px', color: `rgba(${INK},.82)`,
              boxShadow: 'inset 0 -2px 0 rgba(0,0,0,.5)',
            }}>&#8984; J</kbd>
            <span>toggles USA &#8646; India</span>
          </p>
        </div>

        <div data-reveal data-delay="100" style={{
          border: `1px solid rgba(${INK},.14)`, background: '#101114',
          boxShadow: '0 1px 1px rgba(0,0,0,.5), 0 26px 60px -34px rgba(0,0,0,1)',
        }}>
          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
            gap: '10px 16px', padding: '12px 14px', borderBottom: `1px solid rgba(${INK},.12)`,
          }}>
            <span style={{ font: "500 10px/1 'Geist Mono', monospace", color: inkText(.42) }}>
              Workspace / base locale
            </span>
            <div role="radiogroup" aria-label="Base locale" style={{
              display: 'flex', gap: 1, border: `1px solid rgba(${INK},.18)`, background: `rgba(${INK},.18)`,
            }}>
              <button
                type="button" role="radio" aria-checked={!isIndia}
                onClick={() => setMode(false)} style={tabStyle(!isIndia)}
              >USA &#183; USD / ET</button>
              <button
                type="button" role="radio" aria-checked={isIndia}
                onClick={() => setMode(true)} style={tabStyle(isIndia)}
              >India &#183; INR / IST</button>
            </div>
          </div>

          <dl style={{ display: 'flex', flexWrap: 'wrap', gap: 1, margin: 0, background: `rgba(${INK},.12)` }}>
            <div style={{ flex: '1.2 1 165px', background: '#101114', padding: '18px 16px' }}>
              <dt style={dtLabel}>primary benchmark</dt>
              <dd style={{ margin: '11px 0 6px', font: "600 17px/1 'Geist Mono', monospace" }}>{dm.index}</dd>
              <dd title={q ? quoteTitle(q) : undefined} style={{
                margin: 0, font: "500 12px/1 'Geist Mono', monospace",
                fontVariantNumeric: 'tabular-nums', color: idxColor,
              }}>{idxText}{q && statusTag(q) && <span style={{ color: inkText(.45) }}> · {statusTag(q)}</span>}</dd>
            </div>

            <div style={{ flex: '1.4 1 185px', background: '#101114', padding: '18px 16px' }}>
              <dt style={dtLabel}>portfolio value · example</dt>
              <dd style={{
                margin: '11px 0 6px', font: "600 17px/1 'Geist Mono', monospace",
                fontVariantNumeric: 'tabular-nums', color: '#d99a5c',
              }}>{value}</dd>
              <dd style={ddSub} title={isIndia && inr ? quoteTitle(inr) : undefined}>{fx}</dd>
            </div>

            <div style={{ flex: '1 1 155px', background: '#101114', padding: '18px 16px' }}>
              <dt style={dtLabel}>session clock</dt>
              <dd id="gv-clock" style={{
                margin: '11px 0 6px', font: "600 17px/1 'Geist Mono', monospace",
                fontVariantNumeric: 'tabular-nums',
              }}>{clock}</dd>
              <dd style={ddSub}>{dm.tz}</dd>
            </div>

            <div style={{ flex: '1.1 1 165px', background: '#101114', padding: '18px 16px' }}>
              <dt style={dtLabel}>market state</dt>
              <dd style={{
                margin: '11px 0 6px', display: 'flex', alignItems: 'center', gap: 8,
                font: "600 17px/1 'Geist Mono', monospace", color: session?.open ? UP : `rgba(${INK},.7)`,
              }}>
                <span aria-hidden="true" style={{ fontSize: 11 }}>{session ? (session.open ? '●' : '○') : ''}</span>{session ? (session.open ? 'Open' : 'Closed') : '—'}
              </dd>
              <dd style={ddSub}>{session ? `${session.open ? 'closes' : 'opens'} in ${duration(session.minutes)}` : ' '}</dd>
            </div>
          </dl>

          <div style={{
            borderTop: `1px solid rgba(${INK},.12)`, padding: '14px 16px', display: 'flex',
            flexWrap: 'wrap', gap: '8px 20px',
            font: "500 11px/1.6 'Geist Mono', monospace", color: inkText(.55),
          }}>
            <span>watchlist &#8250; {dm.watch}</span>
            <span>brief &#8250; {dm.brief}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
