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
        type="button"
        className="gv-seg-single"
        style={{ color: 'var(--text-accent)', ...style }}
      >
        ⚡ AI
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
