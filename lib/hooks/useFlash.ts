'use client';
import { useEffect, useRef, useState } from 'react'

export type FlashState = 'up' | 'down' | null

export function useFlash(value: number | null | undefined, duration = 400): FlashState {
  const [flash, setFlash] = useState<FlashState>(null)
  const prev = useRef<number | null | undefined>(undefined)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (
      prev.current !== undefined &&
      prev.current !== null &&
      value !== null &&
      value !== undefined &&
      value !== prev.current
    ) {
      if (timer.current) clearTimeout(timer.current)
      setFlash(value > prev.current ? 'up' : 'down')
      timer.current = setTimeout(() => setFlash(null), duration)
    }
    prev.current = value
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [value, duration])

  return flash
}
