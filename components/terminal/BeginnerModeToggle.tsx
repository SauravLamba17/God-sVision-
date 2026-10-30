'use client'
import Link from 'next/link'
import { useBeginnerMode } from '@/lib/hooks/useBeginnerMode'

export default function BeginnerModeToggle() {
  const [enabled, setEnabled] = useBeginnerMode()

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button
        type="button"
        className="gv-seg-single"
        aria-pressed={enabled}
        onClick={() => setEnabled(!enabled)}
        title={enabled ? 'Turn off Beginner Mode' : 'Turn on Beginner Mode — adds tooltips and plain-English explanations'}
      >
        📚 {enabled ? 'LEARN: ON' : 'LEARN'}
      </button>
      {enabled && (
        <Link href="/glossary" title="Open full glossary" className="gv-seg-single" style={{ color: 'var(--accent-text)' }}>
          GLOSSARY →
        </Link>
      )}
    </div>
  )
}
