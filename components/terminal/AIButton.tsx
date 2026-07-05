'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'

const AIPanel = dynamic(() => import('./AIPanel'), { ssr: false })

interface AIButtonProps {
  panelData: unknown
  panelName: string
  context?: string
  style?: React.CSSProperties
}

export default function AIButton({ panelData, panelName, context, style }: AIButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="AI Analysis"
        style={{
          display: 'flex', alignItems: 'center', gap: 3,
          background: 'rgba(56,189,248,0.08)',
          border: '1px solid rgba(56,189,248,0.25)',
          borderRadius: 2,
          padding: '2px 7px',
          cursor: 'pointer',
          fontFamily: 'IBM Plex Mono', fontSize: 9, fontWeight: 600,
          color: 'var(--text-accent)',
          letterSpacing: '0.06em',
          transition: 'all 0.15s',
          ...style,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(56,189,248,0.18)'
          e.currentTarget.style.borderColor = 'var(--text-accent)'
          e.currentTarget.style.boxShadow = '0 0 12px rgba(56,189,248,0.25)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(56,189,248,0.08)'
          e.currentTarget.style.borderColor = 'rgba(56,189,248,0.25)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        âš¡ AI
      </button>
      {open && (
        <AIPanel
          panelData={panelData}
          panelName={panelName}
          context={context}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
