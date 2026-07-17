'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useMode } from '@/lib/context/ModeContext'

const SplitLayout          = dynamic(() => import('./SplitLayout'),          { ssr: false })
const ModeToggle           = dynamic(() => import('./ModeToggle'),           { ssr: false })
const ThemeSwitcher        = dynamic(() => import('./ThemeSwitcher'),        { ssr: false })
const BeginnerModeToggle   = dynamic(() => import('./BeginnerModeToggle'),   { ssr: false })

const NAV_F_ITEMS = [
  { key: 'F1',  label: 'DASH',     href: '/',          icon: '◈' },
  { key: 'F2',  label: 'MARKETS',  href: '/markets',   icon: '📈' },
  { key: 'F3',  label: 'CRYPTO',   href: '/crypto',    icon: '₿' },
  { key: 'F4',  label: 'FOREX',    href: '/forex',     icon: '💱' },
  { key: 'F5',  label: 'MACRO',    href: '/macro',     icon: '🏦' },
  { key: 'F6',  label: 'CALENDAR', href: '/calendar',  icon: '📅' },
  { key: 'F7',  label: 'NEWS',     href: '/news',      icon: '📡' },
  { key: 'F8',  label: 'MAP',      href: '/map',       icon: '🌍' },
  { key: 'F9',  label: 'CAM',      href: '/cameras',   icon: '📷' },
  { key: 'F10', label: 'FLIGHTS',  href: '/flights',   icon: '✈' },
  { key: 'F11', label: 'WEATHER',  href: '/weather',   icon: '🌤' },
  { key: 'F12', label: 'SPORTS',   href: '/sports',    icon: '⚽' },
]

const NAV_EXTRA = [
  { label: 'COMMODITIES', href: '/commodities' },
  { label: 'BONDS',       href: '/bonds' },
  { label: 'BACKTEST',    href: '/backtest' },
  { label: 'CHAT',        href: '/chat' },
  { label: 'SHEETS',      href: '/sheets' },
  { label: 'PORTFOLIO',   href: '/portfolio' },
  { label: 'ALERTS',      href: '/alerts' },
  { label: 'SCREENER',    href: '/screener' },
  { label: 'OPTIONS',     href: '/options' },
  { label: 'HEATMAP',     href: '/heatmap' },
  { label: 'EARNINGS',    href: '/earnings' },
  { label: 'INSIDERS',    href: '/insiders' },
  { label: 'CORRELATION', href: '/correlation' },
  { label: 'HEALTH',      href: '/disease' },
  { label: 'BANKS',       href: '/centralbanks' },
  { label: 'WATCHLISTS',  href: '/watchlists' },
  { label: 'FINANCIALS',  href: '/financials' },
  { label: 'YIELD CURVE', href: '/yield-curve' },
]

export default function NavBar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { isIndia } = useMode()
  const [splitMode, setSplitMode] = useState(false)
  const [showSplit, setShowSplit] = useState(false)

  // Restore layout mode from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gv_layout_mode')
      if (saved === 'split') { setSplitMode(true); setShowSplit(true) }
    } catch { /* ignore */ }
  }, [])

  const toggleSplit = () => {
    const next = !splitMode
    setSplitMode(next)
    setShowSplit(next)
    try { localStorage.setItem('gv_layout_mode', next ? 'split' : 'single') } catch { /* ignore */ }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // F-key navigation
      const fKeys = ['F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12']
      if (fKeys.includes(e.key)) {
        e.preventDefault()
        const idx = fKeys.indexOf(e.key)
        if (idx < NAV_F_ITEMS.length) router.push(NAV_F_ITEMS[idx].href)
        return
      }

      // Ctrl+Shift+S = toggle split
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        toggleSplit()
        return
      }

      // G = GOD MODE
      if (e.key === 'g' || e.key === 'G') {
        router.push('/godmode')
      }

      // W = watchlist (handled in WatchlistSidebar)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router, splitMode])

  const activeAccent = isIndia ? '#FF9933' : 'var(--text-accent)'
  const activeAccentBg = isIndia ? 'rgba(255,153,51,0.08)' : 'rgba(255,109,0,0.08)'

  const navItemStyle = (isActive: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 5,
    height: 34, padding: '0 8px',
    fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: isActive ? 600 : 400,
    textDecoration: 'none', whiteSpace: 'nowrap' as const,
    color: isActive ? activeAccent : 'var(--text-muted)',
    background: isActive ? activeAccentBg : 'transparent',
    borderBottom: isActive ? `2px solid ${activeAccent}` : '2px solid transparent',
    transition: 'all 0.15s',
    letterSpacing: '0.06em',
    cursor: 'pointer',
  })

  const extraItemStyle = (isActive: boolean) => ({
    display: 'flex', alignItems: 'center',
    height: 20, padding: '0 6px',
    fontFamily: 'IBM Plex Mono', fontSize: 9, fontWeight: isActive ? 600 : 400,
    textDecoration: 'none', whiteSpace: 'nowrap' as const,
    color: isActive ? 'var(--text-accent)' : 'var(--text-muted)',
    background: isActive ? 'rgba(255,109,0,0.08)' : 'transparent',
    border: isActive ? '1px solid rgba(255,109,0,0.3)' : '1px solid transparent',
    borderRadius: 2,
    transition: 'all 0.15s',
    letterSpacing: '0.04em',
    cursor: 'pointer',
  })

  return (
    <>
      <nav style={{
        position: 'fixed', top: 44, left: 0, right: 0, zIndex: 40,
        background: 'var(--bg-header)',
        borderBottom: '1px solid var(--border-dim)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Row 1: F-key navigation */}
        <div style={{
          height: 34, display: 'flex', alignItems: 'center',
          overflowX: 'auto', overflowY: 'hidden',
          borderBottom: '1px solid var(--border-dim)',
          padding: '0 4px',
        }} className="scrollbar-none">
          <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: 1 }}>
            {NAV_F_ITEMS.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
              return (
                <Link key={item.key} href={item.href} style={navItemStyle(isActive)}
                  onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)' } }}
                  onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)' } }}
                >
                  <span style={{ fontSize: 8, color: isActive ? (isIndia ? 'rgba(255,153,51,0.31)' : 'rgba(255,109,0,0.31)') : 'var(--border-bright)', fontWeight: 400 }}>{item.key}</span>
                  <span style={{ fontSize: 10, letterSpacing: '0.06em' }}>{item.label}</span>
                </Link>
              )
            })}
          </div>

          {/* Right controls */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, paddingRight: 8, flexShrink: 0 }}>
            {/* India/USA Mode Toggle */}
            <ModeToggle />

            {/* Divider */}
            <span style={{ width: 1, height: 20, background: 'var(--border-color)', display: 'inline-block' }} />

            {/* Theme Switcher */}
            <ThemeSwitcher />

            {/* Beginner Mode Toggle */}
            <BeginnerModeToggle />

            {/* Divider */}
            <span style={{ width: 1, height: 20, background: 'var(--border-color)', display: 'inline-block' }} />

            {/* Single/Split toggle */}
            <button
              onClick={toggleSplit}
              title="Ctrl+Shift+S — Toggle Split View"
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: splitMode ? 'rgba(255,109,0,0.12)' : 'transparent',
                border: `1px solid ${splitMode ? 'var(--text-accent)' : 'var(--border-color)'}`,
                borderRadius: 3, padding: '2px 8px',
                fontFamily: 'IBM Plex Mono', fontSize: 9, color: splitMode ? 'var(--text-accent)' : 'var(--text-muted)',
                cursor: 'pointer', letterSpacing: '0.06em',
              }}
            >
              {splitMode ? '⊞' : '⊡'} {splitMode ? 'SPLIT' : 'SINGLE'}
            </button>

            {/* GOD MODE */}
            <Link href="/godmode" style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'rgba(255,109,0,0.9)',
              border: '1px solid #ff6d00',
              borderRadius: 3, padding: '2px 10px',
              fontFamily: 'IBM Plex Mono', fontSize: 9, fontWeight: 700, color: '#000',
              textDecoration: 'none', letterSpacing: '0.08em',
            }}>
              ⚡ GOD
            </Link>
          </div>
        </div>

        {/* Row 2: Extra modules (smaller) */}
        <div style={{
          height: 22, display: 'flex', alignItems: 'center',
          overflowX: 'auto', overflowY: 'hidden',
          padding: '0 8px', gap: 3,
        }} className="scrollbar-none">
          {NAV_EXTRA.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href} style={extraItemStyle(isActive)}
                onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border-color)' } }}
                onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'transparent' } }}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {showSplit && (
        <SplitLayout onExit={() => { setSplitMode(false); setShowSplit(false); try { localStorage.setItem('gv_layout_mode', 'single') } catch { /* ignore */ } }} />
      )}
    </>
  )
}
