'use client'
import { useEffect, useState } from 'react'
import { sharedFetch } from '@/lib/sharedFetch'
import type { TickerStatus } from '@/lib/tickerStatus'

/** One row of /api/public/ticker: a real quote with its last-trade time and status. */
export interface TickerQuote { symbol: string; price: number; changePercent: number; time: number; status: TickerStatus }

const REFRESH_MS = 60_000

/** The landing page's quotes. Every section shares one request a minute (sharedFetch),
 *  refreshed only while the tab is visible. null until the first answer. */
export function useTickerFeed(): Record<string, TickerQuote> | null {
  const [rows, setRows] = useState<Record<string, TickerQuote> | null>(null)
  useEffect(() => {
    let alive = true
    const load = () => {
      if (document.visibilityState !== 'visible') return
      sharedFetch('/api/public/ticker', 30_000)
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((live: TickerQuote[]) => {
          if (alive && Array.isArray(live)) setRows(Object.fromEntries(live.map(q => [q.symbol, q])))
        })
        // Keep the last good quotes; each still carries its own time and status.
        .catch(() => { if (alive) setRows(r => r ?? {}) })
    }
    load()
    const id = setInterval(load, REFRESH_MS)
    document.addEventListener('visibilitychange', load)
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', load) }
  }, [])
  return rows
}

/** Small tag after a quote: nothing when live. */
export const statusTag = (q: TickerQuote) => (q.status === 'live' ? '' : q.status === 'delayed' ? 'delayed' : 'close')

/** Tooltip text: status and last-trade time in the viewer's locale. */
export const quoteTitle = (q: TickerQuote) =>
  `${q.symbol} · ${q.status === 'closed' ? 'last close' : q.status} · last trade ${new Date(q.time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`

export const fmtPrice = (n: number) =>
  n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
  : n < 10 ? n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
