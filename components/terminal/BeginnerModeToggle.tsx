'use client'
import Link from 'next/link'
import { useBeginnerMode } from '@/lib/hooks/useBeginnerMode'

export default function BeginnerModeToggle() {
  const [enabled, setEnabled] = useBeginnerMode()

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button
        onClick={() => setEnabled(!enabled)}
        title={enabled ? 'Turn off Beginner Mode' : 'Turn on Beginner Mode â€” adds tooltips and plain-English explanations'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: enabled ? 'rgba(245,158,11,0.15)' : 'transparent',
          border: `1px solid ${enabled ? '#f59e0b60' : 'var(--border-color)'}`,
          borderRadius: 3,
          padding: '2px 8px',
          fontFamily: 'IBM Plex Mono',
          fontSize: 9,
          color: enabled ? 'var(--text-warning)' : 'var(--text-muted)',
          cursor: 'pointer',
          letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
        }}
      >
        ðŸ“š {enabled ? 'LEARN: ON' : 'LEARN'}
      </button>
      {enabled && (
        <Link
          href="/glossary"
          title="Open full glossary"
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid #f59e0b40',
            borderRadius: 3,
            padding: '2px 6px',
            fontFamily: 'IBM Plex Mono',
            fontSize: 9,
            color: 'var(--text-warning)',
            textDecoration: 'none',
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
          }}
        >
          GLOSSARY â†’
        </Link>
      )}
    </div>
  )
}
