'use client'

// Route-level error boundary. Without one, any render crash on a page (e.g.
// /yield-curve's cached-response bug) blanked the whole document to white.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ padding: 24, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-muted)' }}>
      <div style={{ color: 'var(--text-warning)', fontWeight: 700, marginBottom: 8 }}>⚠ THIS PAGE FAILED TO RENDER</div>
      <div style={{ fontSize: 12, marginBottom: 12 }}>{error.message || 'Unexpected error'}</div>
      <button
        onClick={reset}
        style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-accent)', padding: '4px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        RETRY
      </button>
    </div>
  )
}
