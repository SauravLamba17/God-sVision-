'use client'
import { useState, useRef, useEffect } from 'react'
import { GLOSSARY } from '@/lib/glossary'
import { useBeginnerMode } from '@/lib/hooks/useBeginnerMode'
import { tint } from '@/lib/context/ThemeContext'

interface GlossaryTooltipProps {
  term: string
  children: React.ReactNode
  showIcon?: boolean
}

const CATEGORY_COLOR: Record<string, string> = {
  BASIC: 'var(--text-2)',
  TECHNICAL: 'var(--info)',
  OPTIONS: 'var(--warning)',
  MACRO: 'var(--up)',
  INDIA: 'var(--accent-text)',
  CRYPTO: 'var(--down)',
}

export function GlossaryTooltip({ term, children, showIcon = true }: GlossaryTooltipProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<'top' | 'bottom'>('top')
  const [hAlign, setHAlign] = useState<'center' | 'left' | 'right'>('center')
  const ref = useRef<HTMLSpanElement>(null)
  const [isBeginnerMode] = useBeginnerMode()
  const entry = GLOSSARY[term]

  useEffect(() => {
    if (visible && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setPosition(rect.top < 220 ? 'bottom' : 'top')
      // Prevent tooltip from going off screen edges
      if (rect.left < 150) setHAlign('left')
      else if (rect.right > window.innerWidth - 150) setHAlign('right')
      else setHAlign('center')
    }
  }, [visible])

  if (!entry) return <>{children}</>

  const iconSize = isBeginnerMode ? 14 : 11
  const iconColor = isBeginnerMode ? 'var(--text-warning)' : 'var(--text-muted)'

  const tooltipLeft =
    hAlign === 'left' ? '0%' :
    hAlign === 'right' ? 'auto' : '50%'
  const tooltipRight = hAlign === 'right' ? '0%' : 'auto'
  const tooltipTransform = hAlign === 'center' ? 'translateX(-50%)' : 'none'

  return (
    <span
      ref={ref}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        cursor: 'help',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {showIcon && (
        <span style={{
          color: iconColor,
          fontSize: `${iconSize - 3}px`,
          border: `1px solid ${iconColor}`,
          borderRadius: '50%',
          width: `${iconSize}px`,
          height: `${iconSize}px`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          lineHeight: 1,
          fontWeight: 700,
          transition: 'all 0.15s',
        }}>ℹ</span>
      )}
      {visible && (
        <div style={{
          position: 'absolute',
          [position === 'top' ? 'bottom' : 'top']: 'calc(100% + 6px)',
          left: tooltipLeft,
          right: tooltipRight,
          transform: tooltipTransform,
          width: '300px',
          background: 'var(--surface-2)',
          border: '1px solid var(--accent)',
          borderRadius: '4px',
          padding: '10px 12px',
          zIndex: 9999,
          pointerEvents: 'none',
          boxShadow: 'var(--shadow)',
          fontFamily: 'var(--font-sans)',
        }}>
          {/* Category badge */}
          <div style={{ marginBottom: '6px' }}>
            <span style={{
              fontSize: '8px',
              fontWeight: 700,
              padding: '1px 6px',
              background: tint(CATEGORY_COLOR[entry.category] || 'var(--text-accent)', 9),
              color: CATEGORY_COLOR[entry.category] || 'var(--text-accent)',
              border: `1px solid ${CATEGORY_COLOR[entry.category] || 'var(--text-accent)'}`,
              borderRadius: '2px',
              letterSpacing: '1px',
            }}>{entry.category}</span>
          </div>

          {/* Term name */}
          <div style={{
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--accent-text)',
            marginBottom: '5px',
          }}>{entry.term}</div>

          {/* Simple definition */}
          <div style={{
            fontSize: '11px',
            color: 'var(--text-primary)',
            lineHeight: 1.5,
            marginBottom: '7px',
          }}>{entry.simpleDefinition}</div>

          {/* Example */}
          <div style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            lineHeight: 1.4,
            borderTop: '1px solid var(--divider)',
            paddingTop: '6px',
          }}>
            <span style={{ color: 'var(--text-warning)' }}>Example: </span>
            {entry.example}
          </div>

          {/* Arrow */}
          <div style={{
            position: 'absolute',
            [position === 'top' ? 'bottom' : 'top']: '-5px',
            left: hAlign === 'center' ? '50%' : hAlign === 'left' ? '20px' : 'auto',
            right: hAlign === 'right' ? '20px' : 'auto',
            transform: hAlign === 'center' ? 'translateX(-50%)' : 'none',
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            ...(position === 'top'
              ? { borderTop: '5px solid var(--accent)' }
              : { borderBottom: '5px solid var(--accent)' }),
          }} />
        </div>
      )}
    </span>
  )
}
