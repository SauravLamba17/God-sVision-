'use client'
import { useEffect, useRef, useState } from 'react'
import { getMarketStatus } from '@/lib/utils'
import { getIndianMarketStatus } from '@/lib/apis/india'
import { useMode } from '@/lib/context/ModeContext'
import TickerTape from './TickerTape'
import dynamic from 'next/dynamic'
const SearchBar = dynamic(() => import('./SearchBar'), { ssr: false })
const UserMenu   = dynamic(() => import('./UserMenu'),   { ssr: false })

function useMarketBell() {
  const lastFiredRef = useRef('')
  useEffect(() => {
    const check = () => {
      const now = new Date()
      const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
      const day = et.getDay()
      if (day === 0 || day === 6) return
      const h = et.getHours(), m = et.getMinutes()
      const key930 = `open-${et.toDateString()}`
      const key400 = `close-${et.toDateString()}`
      if (h === 9 && m === 30 && lastFiredRef.current !== key930) {
        lastFiredRef.current = key930
        import('@/lib/sounds').then(s => s.playMarketOpen())
      }
      if (h === 16 && m === 0 && lastFiredRef.current !== key400) {
        lastFiredRef.current = key400
        import('@/lib/sounds').then(s => s.playMarketClose())
      }
    }
    check()
    const id = setInterval(check, 30000)
    return () => clearInterval(id)
  }, [])
}

function LiveClock({ tz, label }: { tz: string; label: string }) {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => {
      setTime(new Date().toLocaleTimeString('en-US', {
        timeZone: tz, hour12: false,
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [tz])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: 'var(--bg-header)',
      border: '1px solid var(--border-color)',
      borderRadius: 3,
      padding: '2px 8px',
      minWidth: 70,
    }}>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-secondary)', letterSpacing: '0.05em', lineHeight: 1.2 }}>
        {time || '--:--:--'}
      </span>
    </div>
  )
}

function MarketStatusBadge() {
  type StatusType = 'OPEN' | 'CLOSED' | 'PRE-MARKET' | 'AFTER-HOURS' | 'PRE-OPEN'
  const { isIndia } = useMode()
  const [status, setStatus] = useState<StatusType>('CLOSED')

  useEffect(() => {
    const update = () => setStatus(isIndia ? getIndianMarketStatus() as StatusType : getMarketStatus())
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [isIndia])

  const config: Record<StatusType, { color: string; bg: string; border: string; label: string }> = {
    'OPEN':        { color: 'var(--text-positive)',  bg: 'var(--bg-live)',               border: 'rgba(0,230,118,0.35)',     label: isIndia ? 'NSE OPEN' : 'OPEN' },
    'CLOSED':      { color: 'var(--text-negative)',  bg: 'rgba(255,23,68,0.08)',          border: 'rgba(255,23,68,0.3)',       label: 'CLOSED' },
    'PRE-MARKET':  { color: 'var(--text-warning)',   bg: 'rgba(255,152,0,0.08)',          border: 'rgba(255,152,0,0.3)',       label: 'PRE-MKT' },
    'PRE-OPEN':    { color: 'var(--text-warning)',   bg: 'rgba(255,152,0,0.08)',          border: 'rgba(255,152,0,0.3)',       label: 'PRE-OPEN' },
    'AFTER-HOURS': { color: 'var(--text-warning)',   bg: 'rgba(255,152,0,0.08)',          border: 'rgba(255,152,0,0.3)',       label: 'AFT-HRS' },
  }
  const c = config[status] ?? config['CLOSED']
  const isOpen = status === 'OPEN'

  return (
    <div style={{
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 20,
      padding: '2px 10px',
      display: 'flex', alignItems: 'center', gap: 5,
    }}>
      {isOpen && <span className="live-dot" style={{ width: 5, height: 5 }} />}
      <span style={{
        fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 700,
        color: c.color, letterSpacing: '0.08em',
      }}>
        {c.label}
      </span>
    </div>
  )
}

export default function TopBar() {
  const { isIndia } = useMode()
  useMarketBell()

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      height: 44,
      background: 'var(--bg-terminal)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex', alignItems: 'center',
    }}>
      {/* Brand */}
      <div style={{ flexShrink: 0, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 8, borderRight: '1px solid var(--border-color)', height: '100%' }}>
        <span style={{ fontSize: 16, lineHeight: 1 }}>⚡</span>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              fontFamily: 'IBM Plex Mono', fontWeight: 700, fontSize: 13,
              color: 'var(--text-accent)',
              letterSpacing: '0.1em', whiteSpace: 'nowrap', lineHeight: 1,
            }}>
              GOD&apos;S VISION
            </span>
            <span style={{ fontSize: 13 }}>{isIndia ? '🇮🇳' : '🇺🇸'}</span>
          </div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, letterSpacing: '0.15em', marginTop: 1, color: 'var(--text-muted)' }}>
            {isIndia ? 'INDIA MARKETS' : 'FINANCIAL INTELLIGENCE'}
          </div>
        </div>
      </div>

      {/* Global Search */}
      <div style={{ flexShrink: 0, padding: '0 10px', borderRight: '1px solid var(--border-color)', height: '100%', display: 'flex', alignItems: 'center' }}>
        <SearchBar />
      </div>

      {/* Ticker Tape */}
      <div style={{ flex: 1, overflow: 'hidden', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent)' }}>
        <TickerTape />
      </div>

      {/* Clocks + Status */}
      <div style={{ flexShrink: 0, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 6, borderLeft: '1px solid var(--border-color)', height: '100%' }}>
        {isIndia ? (
          <>
            <LiveClock tz="Asia/Kolkata"      label="IST" />
            <LiveClock tz="America/New_York"  label="ET" />
            <LiveClock tz="UTC"               label="UTC" />
          </>
        ) : (
          <>
            <LiveClock tz="America/New_York"  label="ET" />
            <LiveClock tz="UTC"               label="UTC" />
            <LiveClock tz="Asia/Kolkata"      label="IST" />
          </>
        )}
        <div style={{ width: 1, height: 28, background: 'var(--border-color)' }} />
        <MarketStatusBadge />
        <div style={{ width: 1, height: 28, background: 'var(--border-color)' }} />
        <UserMenu />
      </div>
    </header>
  )
}
