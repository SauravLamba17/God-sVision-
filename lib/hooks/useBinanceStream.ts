'use client'
import { useEffect, useRef, useState } from 'react'

export interface BinanceTicker {
  symbol: string
  price: number
  change: number
  changePct: number
  volume: number
  high: number
  low: number
}

export function useBinanceStream(): Map<string, BinanceTicker> {
  const [tickers, setTickers] = useState<Map<string, BinanceTicker>>(new Map())
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let unmounted = false

    const connect = () => {
      if (unmounted) return
      try {
        const ws = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr')
        wsRef.current = ws

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data as string)
            if (!Array.isArray(data)) return
            setTickers(prev => {
              const next = new Map(prev)
              for (const t of data) {
                const c = parseFloat(t.c)
                const o = parseFloat(t.o)
                const change = c - o
                next.set(t.s, {
                  symbol: t.s,
                  price: c,
                  change,
                  changePct: o > 0 ? (change / o) * 100 : 0,
                  volume: parseFloat(t.v),
                  high: parseFloat(t.h),
                  low: parseFloat(t.l),
                })
              }
              return next
            })
          } catch { /* ignore parse errors */ }
        }

        ws.onclose = () => {
          if (!unmounted) {
            reconnectRef.current = setTimeout(connect, 5000)
          }
        }

        ws.onerror = () => {
          ws.close()
        }
      } catch { /* ignore connection errors */ }
    }

    connect()

    return () => {
      unmounted = true
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [])

  return tickers
}
