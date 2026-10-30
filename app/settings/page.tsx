'use client'
import ThemeToggles from '@/components/terminal/ThemeToggles'

// Linked from the user menu (it was a 404). Appearance only; the same toggles sit in the top bar.
export default function SettingsPage() {
  return (
    <div style={{ padding: 16, maxWidth: 720 }}>
      <h1 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text)', marginBottom: 12 }}>Settings</h1>
      <section className="gv-card" aria-labelledby="appearance">
        <div className="gv-card-head" id="appearance">Appearance</div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 'var(--fs-body)', color: 'var(--text-2)' }}>
          <ThemeToggles />
          <p style={{ color: 'var(--muted)', fontSize: 'var(--fs-meta)', lineHeight: 1.5 }}>
            Until you choose, the app follows your device&apos;s dark/light and contrast settings. Your choice is saved in this browser.
            High contrast uses pure black or white, bolder and larger text, underlined links and ▲/▼ on every move.
          </p>
        </div>
      </section>
    </div>
  )
}
