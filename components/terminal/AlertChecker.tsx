'use client'
import { useEffect, useRef } from 'react'

export default function AlertChecker() {
  const checkRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/alerts/check')
        const j = await res.json()
        if (j.triggered?.length > 0) {
          // Play sound
          import('@/lib/sounds').then(s => s.playAlertBeep())
          // Browser notification
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            for (const detail of (j.details ?? [])) {
              new Notification('GOD\'S VISION — ALERT TRIGGERED', {
                body: `${detail.ticker} hit ${detail.condition === 'above' ? '▲' : '▼'} $${detail.targetPrice} (now: $${detail.currentPrice?.toFixed(2)})`,
                icon: '/favicon.ico',
                tag: `gv-alert-${detail.ticker}`,
              })
            }
          }
        }
      } catch {}
    }

    // Check every 30 seconds
    checkRef.current = setInterval(check, 30000)
    return () => { if (checkRef.current) clearInterval(checkRef.current) }
  }, [])

  return null
}
