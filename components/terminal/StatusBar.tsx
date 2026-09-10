'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useMode } from '@/lib/context/ModeContext'
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
  const [refresh, setRefresh] = useState(30)

  useEffect(() => {
    const id = setInterval(() => setRefresh(r => (r <= 1 ? 30 : r - 1)), 1000)
    return () => clearInterval(id)
  }, [])

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
        checks.map(c => fetch(c.url, { signal: AbortSignal.timeout(5000) }))
      )
      setStatuses(checks.map((c, i) => ({
        name: c.name,
        status: results[i].status === 'fulfilled'
          ? (results[i].value as Response).ok ? 'live' : 'delayed'
          : 'down',
      })))
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
      background: 'var(--bg-terminal)',
      borderTop: '1px solid var(--border-color)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 12px',
    }}>
      {/* API Status Dots */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {statuses.map(s => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
              background: DOT_COLORS[s.status], flexShrink: 0,
            }} />
            <span style={{
              fontFamily: 'IBM Plex Mono', fontSize: 'var(--fs-meta)',
              color: s.status === 'live' ? 'var(--text-muted)' : DOT_COLORS[s.status],
              letterSpacing: '0.05em',
            }}>
              {s.name}
            </span>
          </div>
        ))}
      </div>

      {/* Center: feed health + refresh countdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'IBM Plex Mono', fontSize: 'var(--fs-meta)' }}>
        <span style={{
          color: liveCount === 6 ? 'var(--text-positive)' : liveCount >= 4 ? 'var(--text-warning)' : 'var(--text-negative)',
          letterSpacing: '0.06em',
        }}>
          {liveCount}/{statuses.length} FEEDS LIVE
        </span>
        <span style={{ color: 'var(--border-bright)' }}>│</span>
        <span style={{ color: 'var(--text-muted)' }}>
          REFRESH <span style={{ color: 'var(--text-accent)' }}>{String(refresh).padStart(2, '0')}s</span>
        </span>
      </div>

      {/* Right: version + mode + sound */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'IBM Plex Mono', fontSize: 'var(--fs-meta)' }}>
        <span style={{ color: 'var(--text-accent)', letterSpacing: '0.06em' }}>GOD'S VISION</span>
        <span style={{ color: 'var(--border-color)' }}>v1.0</span>
        <span style={{ color: 'var(--border-bright)' }}>│</span>
        <span style={{ color: 'var(--text-muted)' }}>:3001</span>
        <span style={{ color: 'var(--border-bright)' }}>│</span>
        {isIndia ? (
          <>
            <span style={{ color: '#FF9933' }}>🇮🇳 IN MARKETS</span>
            <span style={{ color: 'var(--border-bright)' }}>│</span>
            <span suppressHydrationWarning style={{ color: 'var(--text-muted)' }}>
              1 USD = ₹{exchangeRate.toFixed(2)}
            </span>
            <span style={{ color: 'var(--border-bright)' }}>│</span>
          </>
        ) : (
          <>
            <span style={{ color: 'var(--text-secondary)' }}>🇺🇸 US MARKETS</span>
            <span style={{ color: 'var(--border-bright)' }}>│</span>
          </>
        )}
        <Link href="/glossary" style={{
          fontFamily: 'IBM Plex Mono', fontSize: 'var(--fs-meta)',
          color: 'var(--text-muted)', textDecoration: 'none',
          padding: '1px 6px',
          border: '1px solid var(--border-color)',
          borderRadius: 2, letterSpacing: '0.05em',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-accent)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border-accent)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border-color)' }}
        >
          📚 LEARN
        </Link>
        <span style={{ color: 'var(--border-bright)' }}>│</span>
        <SoundControl />
      </div>
    </footer>
  )
}
