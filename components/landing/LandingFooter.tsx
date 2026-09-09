import { INK } from '@/lib/canvas/globe'

export default function LandingFooter() {
  return (
    <footer style={{ borderTop: `1px solid rgba(${INK},.1)` }}>
      <div style={{
        maxWidth: 1440, margin: '0 auto', padding: '18px 24px', display: 'flex',
        flexWrap: 'wrap', justifyContent: 'space-between', gap: '12px 24px',
        font: "500 10px/1.6 'Geist Mono', monospace", color: `rgba(${INK},.35)`,
      }}>
        <span translate="no">GOD&#8217;s Vision &#183; built by one person &#183; 2026</span>
        <span>Data: exchange &amp; crypto feeds, news wires, USGS, OpenSky, NORAD</span>
      </div>
    </footer>
  )
}
