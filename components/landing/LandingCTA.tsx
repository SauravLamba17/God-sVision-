import { INK } from '@/lib/canvas/globe'
import { REGISTER_HREF, SIGNIN_HREF } from './links'

export default function LandingCTA() {
  return (
    <section id="start" data-screen-label="Final CTA">
      <div style={{
        maxWidth: 1440, margin: '0 auto', padding: 'clamp(72px, 9vw, 140px) 24px',
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
        alignItems: 'flex-end', gap: 40,
      }}>
        <div data-reveal style={{ flex: '2 1 380px' }}>
          <h2 style={{
            margin: 0, maxWidth: '18ch', font: '600 clamp(28px, 4vw, 54px)/1.04 Geist, sans-serif',
            letterSpacing: '-.026em', textWrap: 'balance',
          }}>Open it. It&#8217;s already running.</h2>
          <p style={{
            margin: '20px 0 0', maxWidth: '42ch', font: '400 16px/1.6 Geist, sans-serif',
            color: `rgba(${INK},.6)`,
          }}>
            No card, no sales call, no onboarding sequence. Sign in &amp; the tape is live.
          </p>
        </div>

        <div data-reveal data-delay="80" style={{
          flex: '0 0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 22px',
        }}>
          <a href={SIGNIN_HREF} className="gv-link-quiet" style={{
            display: 'inline-flex', alignItems: 'center', minHeight: 52, padding: '0 4px',
            font: "500 15px/1 'Geist Mono', monospace",
          }}>Sign in</a>
          <a href={REGISTER_HREF} className="gv-btn-primary" style={{
            display: 'inline-flex', alignItems: 'center', gap: 14, minHeight: 52,
            font: "600 15px/1 'Geist Mono', monospace", padding: '0 26px',
            boxShadow: '0 1px 1px rgba(0,0,0,.5), 0 14px 30px -12px rgba(201,138,75,.5)',
          }}>Get started <span aria-hidden="true">&#8594;</span></a>
        </div>
      </div>
    </section>
  )
}
