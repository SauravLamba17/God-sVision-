'use client'
import { useState, useEffect } from 'react'
import { useMode } from '@/lib/context/ModeContext'
import { getIndianMarketStatus } from '@/lib/apis/india'
import { getMarketStatus } from '@/lib/utils'

function ModeOverlay({ mode, rate, onDone }: { mode: 'USA' | 'INDIA'; rate: number; onDone: () => void }) {
  const [visible, setVisible] = useState(false)
  const [istTime, setIstTime] = useState('')
  const [etTime,  setEtTime]  = useState('')

  useEffect(() => {
    setIstTime(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    setEtTime(new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    setVisible(true)
    const t = setTimeout(() => { setVisible(false); setTimeout(onDone, 300) }, 1800)
    return () => clearTimeout(t)
  }, [onDone])

  const isIndia       = mode === 'INDIA'
  const marketStatus  = isIndia ? getIndianMarketStatus() : getMarketStatus()
  const exchange      = isIndia ? 'NSE/BSE' : 'NYSE/NASDAQ'
  const statusDot     = marketStatus === 'OPEN' ? '● OPEN' : '○ CLOSED'
  const statusColor   = marketStatus === 'OPEN' ? (isIndia ? '#FF9933' : 'var(--text-positive)') : 'var(--text-negative)'
  const accentColor   = isIndia ? '#FF9933' : 'var(--text-accent)'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(2,8,23,0.88)',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.3s ease',
      pointerEvents: 'none',
    }}>
      <div style={{
        border: `1px solid ${accentColor}`,
        background: 'linear-gradient(180deg, #060d1a 0%, #020817 100%)',
        padding: '24px 36px',
        borderRadius: 6,
        fontFamily: 'IBM Plex Mono',
        minWidth: 320,
        boxShadow: `0 0 40px ${accentColor}30`,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: accentColor, letterSpacing: '0.1em', marginBottom: 16 }}>
          {isIndia ? '🇮🇳 SWITCHING TO INDIA MODE' : '🇺🇸 SWITCHING TO USA MODE'}
        </div>
        {isIndia && (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-primary)', marginBottom: 6 }}>
              1 USD = <span style={{ color: '#FF9933', fontWeight: 700 }}>₹{rate.toFixed(2)}</span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 12 }}>Exchange rate updated · {istTime} IST</div>
          </>
        )}
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
          {exchange} Status: <span style={{ color: statusColor, fontWeight: 700 }}>{statusDot}</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {isIndia ? `IST Time: ${istTime}` : `ET Time: ${etTime}`}
        </div>
        <div style={{ marginTop: 16, height: 2, background: `linear-gradient(90deg, ${accentColor} 0%, transparent 100%)`, borderRadius: 1 }} />
      </div>
    </div>
  )
}

export default function ModeToggle() {
  const { mode, toggleMode, isIndia, exchangeRate } = useMode()
  const [showOverlay, setShowOverlay] = useState(false)
  const [overlayMode, setOverlayMode] = useState<'USA' | 'INDIA'>('INDIA')

  // Ctrl+Shift+I keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault()
        handleToggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const handleToggle = () => {
    const next = mode === 'USA' ? 'INDIA' : 'USA'
    setOverlayMode(next)
    setShowOverlay(true)
    toggleMode()
  }

  const borderColor = isIndia ? '#FF9933' : 'var(--border-color)'
  const bg          = isIndia ? 'rgba(255,153,51,0.08)' : 'var(--bg-input)'
  const textActive  = isIndia ? '#FF9933'  : 'var(--text-accent)'
  const textSecond  = 'var(--text-muted)'

  return (
    <>
      <button
        onClick={handleToggle}
        title="Ctrl+Shift+I — Toggle India/USA Mode"
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: bg,
          border: `1px solid ${borderColor}`,
          borderRadius: 3, padding: '3px 10px',
          fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 700,
          cursor: 'pointer', letterSpacing: '0.04em',
          transition: 'all 200ms ease',
          boxShadow: isIndia ? `0 0 12px rgba(255,153,51,0.25)` : 'none',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = textActive; e.currentTarget.style.boxShadow = `0 0 12px ${textActive}30` }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = borderColor; e.currentTarget.style.boxShadow = isIndia ? '0 0 12px rgba(255,153,51,0.25)' : 'none' }}
      >
        {isIndia ? (
          <>
            <span style={{ color: textActive }}>🇮🇳 INDIA MODE</span>
            <span style={{ color: textSecond, fontSize: 9 }}>→ 🇺🇸 USA</span>
          </>
        ) : (
          <>
            <span style={{ color: 'var(--text-primary)' }}>🇺🇸 USA MODE</span>
            <span style={{ color: textActive, fontSize: 9 }}>→ 🇮🇳 INDIA</span>
          </>
        )}
      </button>

      {showOverlay && (
        <ModeOverlay
          mode={overlayMode}
          rate={exchangeRate}
          onDone={() => setShowOverlay(false)}
        />
      )}
    </>
  )
}
