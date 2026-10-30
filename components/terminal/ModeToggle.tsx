'use client'
import { useState, useEffect } from 'react'
import { useMode } from '@/lib/context/ModeContext'
import { getIndianMarketStatus } from '@/lib/utils'
import { getMarketStatus } from '@/lib/utils'

function ModeOverlay({ mode, rate, onDone }: { mode: 'USA' | 'INDIA'; rate: number | null; onDone: () => void }) {
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
  const statusColor   = marketStatus === 'OPEN' ? 'var(--up)' : 'var(--down)'
  const accentColor   = 'var(--accent-text)'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--overlay)',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.3s ease',
      pointerEvents: 'none',
    }}>
      <div style={{
        border: 'var(--bw) solid var(--border)',
        borderTop: 'var(--stripe) solid var(--stripe-color)',
        background: 'var(--surface)',
        padding: '24px 36px',
        borderRadius: 'var(--radius)',
        fontFamily: 'var(--font-sans)',
        minWidth: 320,
        boxShadow: 'var(--shadow)',
      }}>
        <div style={{ fontSize: 'var(--fs-header)', fontWeight: 'var(--fw-bold)', color: accentColor, letterSpacing: '0.06em', marginBottom: 16 }}>
          {isIndia ? '🇮🇳 SWITCHING TO INDIA MODE' : '🇺🇸 SWITCHING TO USA MODE'}
        </div>
        {isIndia && (
          <>
            <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-primary)', marginBottom: 6 }}>
              1 USD = <span className="gv-num" style={{ color: 'var(--accent-text)', fontWeight: 'var(--fw-bold)' }}>₹{rate?.toFixed(2) ?? '—'}</span>
            </div>
            <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', marginBottom: 12 }}>Exchange rate updated · {istTime} IST</div>
          </>
        )}
        <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)', marginBottom: 6 }}>
          {exchange} Status: <span style={{ color: statusColor, fontWeight: 700 }}>{statusDot}</span>
        </div>
        <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>
          {isIndia ? `IST Time: ${istTime}` : `ET Time: ${etTime}`}
        </div>
      </div>
    </div>
  )
}

export default function ModeToggle() {
  const { mode, toggleMode, exchangeRate } = useMode()
  const [showOverlay, setShowOverlay] = useState(false)
  const [overlayMode, setOverlayMode] = useState<'USA' | 'INDIA'>('INDIA')

  // Ctrl+Shift+I keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i') { // Caps Lock + Shift gives 'i'
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

  // Segmented USA | India: active = accent fill + on-accent text.
  return (
    <>
      <div role="group" aria-label="Market mode" className="gv-seg" title="Ctrl+Shift+I — Toggle India/USA Mode">
        <button type="button" aria-pressed={mode === 'USA'} onClick={() => { if (mode !== 'USA') handleToggle() }}>🇺🇸 USA</button>
        <button type="button" aria-pressed={mode === 'INDIA'} onClick={() => { if (mode !== 'INDIA') handleToggle() }}>🇮🇳 India</button>
      </div>

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
