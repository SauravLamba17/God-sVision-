'use client'
import { INK } from '@/lib/canvas/globe'
import { useLandingReveal } from '@/lib/hooks/useLandingReveal'
import LandingTickerTape from './LandingTickerTape'
import { REGISTER_HREF, SIGNIN_HREF } from './links'

const navLink: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 14px',
}

const NAV = [
  ['#markets', 'Markets'],
  ['#ai', 'AI Desk'],
  ['#backtest', 'Backtest'],
  ['#world', 'World'],
  ['#ledger', 'Cost'],
] as const

export default function LandingHeader() {
  // Settles every [data-reveal] on the page. Run from here because the header
  // is the one client component guaranteed to be mounted for the page's life.
  useLandingReveal()

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 20, background: 'rgba(10,11,13,.86)',
      backdropFilter: 'blur(14px)', borderBottom: `1px solid rgba(${INK},.1)`,
    }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
        gap: '12px 24px', maxWidth: 1440, margin: '0 auto', padding: '10px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span aria-hidden="true" style={{
            width: 10, height: 10, background: '#c98a4b',
            boxShadow: '0 0 0 3px rgba(201,138,75,.15), 0 1px 2px rgba(0,0,0,.6)',
          }} />
          <span translate="no" style={{ font: '600 15px/1 Geist, sans-serif', letterSpacing: '-.01em' }}>
            GOD&#8217;s Vision
          </span>
          <span style={{
            font: "500 10px/1 'Geist Mono', monospace", color: `rgba(${INK},.42)`,
            borderLeft: `1px solid rgba(${INK},.16)`, paddingLeft: 12,
          }}>Terminal v3.1</span>
        </div>

        <nav aria-label="Primary" style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4,
          font: "500 13px/1 'Geist Mono', monospace",
        }}>
          {NAV.map(([href, label]) => (
            <a key={href} href={href} className="gv-nav-link" style={navLink}>{label}</a>
          ))}
          <a href={SIGNIN_HREF} className="gv-link-quiet" style={{ ...navLink, marginLeft: 6, fontWeight: 500 }}>
            Sign in
          </a>
          <a href={REGISTER_HREF} className="gv-btn-primary" style={{
            display: 'inline-flex', alignItems: 'center', minHeight: 44, marginLeft: 4,
            padding: '0 18px', fontWeight: 600,
            boxShadow: '0 1px 1px rgba(0,0,0,.5), 0 6px 16px rgba(201,138,75,.18)',
          }}>Get started</a>
        </nav>
      </div>

      <LandingTickerTape />
    </header>
  )
}
