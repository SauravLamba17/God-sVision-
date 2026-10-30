'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

const SplitLayout          = dynamic(() => import('./SplitLayout'),          { ssr: false })
const ModeToggle           = dynamic(() => import('./ModeToggle'),           { ssr: false })
const BeginnerModeToggle   = dynamic(() => import('./BeginnerModeToggle'),   { ssr: false })

const NAV_F_ITEMS = [
  { key: 'F1',  label: 'DASH',     href: '/dashboard', icon: '◈' },
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
  { label: 'SCENARIOS',   href: '/scenarios' },
  { label: 'RESEARCH',    href: '/research' },
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
  { label: 'FINANCIALS',  href: '/financials' },
  { label: 'YIELD CURVE', href: '/yield-curve' },
]

export default function NavBar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [splitMode, setSplitMode] = useState(false)
  const [showSplit, setShowSplit] = useState(false)
  const navRef = useRef<HTMLElement>(null)

  // The nav rows wrap, so their height varies with width, text size and contrast;
  // publish it for <main>, the split view and the watchlist (top: … var(--nav-h)).
  useEffect(() => {
    const el = navRef.current
    if (!el) return
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--nav-h', `${el.offsetHeight}px`))
    ro.observe(el)
    return () => { ro.disconnect(); document.documentElement.style.removeProperty('--nav-h') }
  }, [])

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
      // Typing targets keep their keys (a focused <select> uses letters to jump to options: "g" → Gold).
      const t = e.target as HTMLElement
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || t?.isContentEditable) return

      // F-key navigation
      const fKeys = ['F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12']
      if (fKeys.includes(e.key)) {
        e.preventDefault()
        const idx = fKeys.indexOf(e.key)
        if (idx < NAV_F_ITEMS.length) router.push(NAV_F_ITEMS[idx].href)
        return
      }

      // Ctrl+Shift+S = toggle split
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') { // Caps Lock + Shift gives 's'
        e.preventDefault()
        toggleSplit()
        return
      }

      // G = GOD MODE
      if ((e.key === 'g' || e.key === 'G') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        router.push('/godmode')
      }

      // W = watchlist (handled in WatchlistSidebar)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router, splitMode])

  return (
    <>
      <nav ref={navRef} style={{
        position: 'fixed', top: 'calc(44px + var(--stripe))', left: 0, right: 0, zIndex: 40,
        background: 'var(--surface)',
        borderBottom: 'var(--bw) solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Row 1: F-key navigation. Rows wrap (never scroll), so every link stays visible
            at any width or text size; the page below follows the measured height (--nav-h). */}
        <div style={{
          minHeight: 34, display: 'flex', alignItems: 'center', flexWrap: 'wrap',
          borderBottom: 'var(--bw) solid var(--divider)',
          padding: '0 4px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            {NAV_F_ITEMS.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
              return (
                <Link key={item.key} href={item.href} className="gv-nav" aria-current={isActive ? 'page' : undefined}>
                  <span className="gv-fkey gv-num" style={{ fontSize: 'var(--fs-meta)', color: 'var(--muted)' }}>{item.key}</span>
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>

          {/* Right controls */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, padding: '4px 8px 4px 0' }}>
            {/* India/USA Mode Toggle */}
            <ModeToggle />

            {/* Beginner Mode Toggle */}
            <BeginnerModeToggle />

            {/* Single/Split toggle */}
            <button
              type="button"
              className="gv-seg-single"
              aria-pressed={splitMode}
              onClick={toggleSplit}
              title="Ctrl+Shift+S — Toggle Split View"
            >
              {splitMode ? '⊞ SPLIT' : '⊡ SINGLE'}
            </button>

            {/* GOD MODE */}
            <Link href="/godmode" className="gv-seg-single" style={{
              background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--on-accent)',
              fontWeight: 'var(--fw-bold)', textDecoration: 'none',
            }}>
              ⚡ GOD
            </Link>
          </div>
        </div>

        {/* Row 2: Extra modules (smaller) */}
        <div style={{
          minHeight: 22, display: 'flex', alignItems: 'center', flexWrap: 'wrap',
          padding: '0 8px', gap: 3,
        }}>
          {NAV_EXTRA.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href} className="gv-nav gv-nav-sm" aria-current={isActive ? 'page' : undefined}>
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
