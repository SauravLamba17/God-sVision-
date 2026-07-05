'use client'
import { useState, useEffect } from 'react'

export function useBeginnerMode(): [boolean, (val: boolean) => void] {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gv_beginner_mode')
      if (saved === 'true') setEnabled(true)
    } catch { /* ignore */ }

    const handler = (e: Event) => {
      setEnabled((e as CustomEvent<{ enabled: boolean }>).detail.enabled)
    }
    window.addEventListener('beginnerModeChanged', handler)
    return () => window.removeEventListener('beginnerModeChanged', handler)
  }, [])

  const toggle = (val: boolean) => {
    setEnabled(val)
    try { localStorage.setItem('gv_beginner_mode', val ? 'true' : 'false') } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('beginnerModeChanged', { detail: { enabled: val } }))
  }

  return [enabled, toggle]
}
