'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useMode } from '@/lib/context/ModeContext'
import { sharedFetch } from '@/lib/sharedFetch'
const SoundControl = dynamic(() => import('./SoundControl'), { ssr: false })

interface ApiStatus { name: string; status: 'live' | 'delayed' | 'down' }

const INITIAL_STATUSES: ApiStatus[] = [
  { name: 'STOCKS',  status: 'live' },
  { name: 'CRYPTO',  status: 'live' },
  { name: 'FOREX',   status: 'live' },
  { name: 'NEWS',    status: 'live' },
  { name: 'FLIGHTS', status: 'live' },
  { name: 'WEATHER', status: 'live' },
]

const DOT_COLORS = {
  live:    'var(--text-positive)',
  delayed: 'var(--text-warning)',
  down:    'var(--text-negative)',
}

export default function StatusBar() {
  const { isIndia, exchangeRate } = useMode()
  const [statuses, setStatuses] = useState<ApiStatus[]>(INITIAL_STATUSES)
  // Time of the last real health check. This used to be a 30s countdown that
  // refreshed nothing — the checks below run every 5 minutes.
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)

  useEffect(() => {
    const checks = [
      { name: 'STOCKS',  url: '/api/stocks?tickers=SPY' },
      { name: 'CRYPTO',  url: '/api/crypto?type=top100' },
      { name: 'FOREX',   url: '/api/forex?type=rates' },
      { name: 'NEWS',    url: '/api/news' },
      { name: 'FLIGHTS', url: '/api/flights' },
      { name: 'WEATHER', url: '/api/weather' },
    ]
    const checkApis = async () => {
      const results = await Promise.allSettled(
        // Shared with the panels polling the same URLs; still "down" after 5 s.
        checks.map(c => Promise.race([
          sharedFetch(c.url),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
        ]))
      )
      setStatuses(checks.map((c, i) => ({
        name: c.name,
        status: results[i].status === 'fulfilled'
          ? (results[i].value as Response).ok ? 'live' : 'delayed'
          : 'down',
      })))
      setCheckedAt(new Date())
    }
    checkApis()
    const id = setInterval(checkApis, 300000) // 5 min — 6 full payloads per tick, on every page; dots do not need 60s
    return () => clearInterval(id)
  }, [])

  const liveCount = statuses.filter(s => s.status === 'live').length

  return (
    <footer style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      height: 26,
      background: 'var(--surface)',
      borderTop: 'var(--bw) solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 12px',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* API Status Dots */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {statuses.map(s => (
          <div key={s.name} title={`${s.name}: ${s.status}`} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
              background: DOT_COLORS[s.status], flexShrink: 0,
            }} />
            {/* Below 1280px only the dots show (name in the tooltip), so the bar never wraps. */}
            <span className="gv-hide-narrow" style={{
              fontSize: 'var(--fs-meta)',
              color: s.status === 'live' ? 'var(--text-muted)' : DOT_COLORS[s.status],
              letterSpacing: '0.05em',
            }}>
              {s.name}
            </span>
          </div>
        ))}
      </div>

      {/* Center: feed health + time of last check */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-meta)', whiteSpace: 'nowrap' }}>
        <span style={{
          color: liveCount === 6 ? 'var(--text-positive)' : liveCount >= 4 ? 'var(--text-warning)' : 'var(--text-negative)',
          letterSpacing: '0.06em',
        }}>
          {/* Counts endpoints that answered OK — reachability, not data freshness. */}
          {checkedAt ? `${liveCount}/${statuses.length} FEEDS UP` : 'CHECKING FEEDS…'}
        </span>
        <span aria-hidden="true" style={{ color: 'var(--muted)' }}>│</span>
        <span style={{ color: 'var(--text-muted)' }}>
          CHECKED <span className="gv-num" style={{ color: 'var(--text-accent)' }}>{checkedAt ? checkedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}</span>
        </span>
      </div>

      {/* Right: version + mode + sound */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-meta)', whiteSpace: 'nowrap' }}>
        <span className="gv-hide-narrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--text)', fontWeight: 'var(--fw-bold)' }}>GOD&apos;s <span style={{ color: 'var(--accent-text)' }}>Vision</span></span>
          <span className="gv-num" style={{ color: 'var(--muted)' }}>v1.0</span>
          <span aria-hidden="true" style={{ color: 'var(--muted)' }}>│</span>
          <span style={{ color: 'var(--text-muted)' }}>:3001</span>
          <span aria-hidden="true" style={{ color: 'var(--muted)' }}>│</span>
        </span>
        {isIndia ? (
          <>
            <span style={{ color: 'var(--saffron)' }}>🇮🇳 IN MARKETS</span>
            <span aria-hidden="true" style={{ color: 'var(--muted)' }}>│</span>
            <span suppressHydrationWarning className="gv-num" style={{ color: 'var(--text-muted)' }}>
              1 USD = ₹{exchangeRate?.toFixed(2) ?? '—'}
            </span>
            <span aria-hidden="true" style={{ color: 'var(--muted)' }}>│</span>
          </>
        ) : (
          <>
            <span style={{ color: 'var(--text-secondary)' }}>🇺🇸 US MARKETS</span>
            <span aria-hidden="true" style={{ color: 'var(--muted)' }}>│</span>
          </>
        )}
        <Link href="/glossary" className="gv-seg-single" style={{ padding: '0 8px' }}>
          📚 LEARN
        </Link>
        <span aria-hidden="true" style={{ color: 'var(--muted)' }}>│</span>
        <SoundControl />
      </div>
    </footer>
  )
}
