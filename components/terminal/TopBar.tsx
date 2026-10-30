'use client'
import { useEffect, useRef, useState } from 'react'
import { getMarketStatus } from '@/lib/utils'
import { getIndianMarketStatus } from '@/lib/utils'
import { useMode } from '@/lib/context/ModeContext'
import TickerTape from './TickerTape'
import dynamic from 'next/dynamic'
const SearchBar = dynamic(() => import('./SearchBar'), { ssr: false })
const UserMenu   = dynamic(() => import('./UserMenu'),   { ssr: false })
const ThemeToggles = dynamic(() => import('./ThemeToggles'), { ssr: false })

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
      background: 'var(--surface-2)',
      border: 'var(--bw) solid var(--border)',
      borderRadius: 'var(--radius-inner)',
      padding: '1px 8px',
      minWidth: 70,
    }}>
      <span className="gv-label" style={{ lineHeight: 1.2 }}>
        {label}
      </span>
      <span className="gv-num" style={{ fontSize: 'var(--fs-body)', color: 'var(--text)', lineHeight: 1.2 }}>
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

  const config: Record<StatusType, { color: string; bg: string; label: string }> = {
    'OPEN':        { color: 'var(--up)',      bg: 'var(--up-soft)',      label: isIndia ? 'NSE OPEN' : 'OPEN' },
    'CLOSED':      { color: 'var(--down)',    bg: 'var(--down-soft)',    label: 'CLOSED' },
    'PRE-MARKET':  { color: 'var(--warning)', bg: 'var(--warning-soft)', label: 'PRE-MKT' },
    'PRE-OPEN':    { color: 'var(--warning)', bg: 'var(--warning-soft)', label: 'PRE-OPEN' },
    'AFTER-HOURS': { color: 'var(--warning)', bg: 'var(--warning-soft)', label: 'AFT-HRS' },
  }
  const c = config[status] ?? config['CLOSED']
  const isOpen = status === 'OPEN'

  return (
    <div style={{
      background: c.bg,
      border: `var(--bw) solid ${c.color}`,
      borderRadius: 20,
      padding: '2px 10px',
      display: 'flex', alignItems: 'center', gap: 5,
    }}>
      {isOpen && <span className="live-dot" style={{ width: 5, height: 5 }} />}
      <span style={{
        fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-meta)', fontWeight: 'var(--fw-bold)',
        color: c.color, letterSpacing: '0.06em', whiteSpace: 'nowrap',
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
      height: 'calc(44px + var(--stripe))',
      background: 'var(--surface)',
      borderTop: 'var(--stripe) solid var(--stripe-color)',
      borderBottom: 'var(--bw) solid var(--border)',
      display: 'flex', alignItems: 'center',
    }}>
      {/* Brand */}
      <div style={{ flexShrink: 0, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 8, borderRight: 'var(--bw) solid var(--border)', height: '100%' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', fontSize: 17,
              color: 'var(--text)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', lineHeight: 1,
            }}>
              GOD&apos;s <span style={{ color: 'var(--accent-text)' }}>Vision</span>
            </span>
            <span style={{ fontSize: 13 }}>{isIndia ? '🇮🇳' : '🇺🇸'}</span>
          </div>
          <div className="gv-label" style={{ fontSize: 10, marginTop: 2 }}>
            {isIndia ? 'INDIA MARKETS' : 'FINANCIAL INTELLIGENCE'}
          </div>
        </div>
      </div>

      {/* Global Search */}
      <div style={{ flexShrink: 0, padding: '0 10px', borderRight: 'var(--bw) solid var(--border)', height: '100%', display: 'flex', alignItems: 'center' }}>
        <SearchBar />
      </div>

      {/* Ticker Tape */}
      <div style={{ flex: 1, overflow: 'hidden', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent)' }}>
        <TickerTape />
      </div>

      {/* Clocks + Status */}
      <div style={{ flexShrink: 0, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 6, borderLeft: 'var(--bw) solid var(--border)', height: '100%' }}>
        {isIndia ? (
          <>
            <LiveClock tz="Asia/Kolkata"      label="IST" />
            <LiveClock tz="America/New_York"  label="ET" />
            <span className="gv-hide-narrow"><LiveClock tz="UTC" label="UTC" /></span>
          </>
        ) : (
          <>
            <LiveClock tz="America/New_York"  label="ET" />
            <span className="gv-hide-narrow"><LiveClock tz="UTC" label="UTC" /></span>
            <LiveClock tz="Asia/Kolkata"      label="IST" />
          </>
        )}
        <MarketStatusBadge />
        <ThemeToggles />
        <UserMenu />
      </div>
    </header>
  )
}
