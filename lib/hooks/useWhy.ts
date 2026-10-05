'use client'
import { useEffect, useSyncExternalStore } from 'react'
import type { Explanation, Market } from '@/lib/evidence/types'
import { isCurrent, needsRecompute } from '@/lib/evidence/freshness'

// One store per market, shared by every "why" line on the page.
//  - Loads /api/why/<market> ONCE per page load (no polling).
//  - When a line's LIVE move flips or drifts >1.5pt from its explanation's
//    snapshot (or the explanation is from another day, or missing), the symbol
//    is queued for /api/why/recompute. Until fresh evidence arrives the line
//    shows "updating" — an outdated explanation is never shown as current.
//  - Each symbol is recomputed at most once a minute.
type Store = { explanations: Record<string, Explanation>; loaded: boolean; loading: boolean; lastTry: Record<string, number>; queue: Set<string>; timer: ReturnType<typeof setTimeout> | null; listeners: Set<() => void>; version: number }
const stores: Partial<Record<Market, Store>> = {}
const store = (m: Market): Store => (stores[m] ??= { explanations: {}, loaded: false, loading: false, lastTry: {}, queue: new Set(), timer: null, listeners: new Set(), version: 0 })
const emit = (s: Store) => { s.version++; s.listeners.forEach(l => l()) }

async function load(market: Market) {
  const s = store(market)
  if (s.loaded || s.loading) return
  s.loading = true
  try {
    const j = await (await fetch(`/api/why/${market.toLowerCase()}`)).json()
    Object.assign(s.explanations, j.data?.explanations ?? {})
  } catch { /* lines fall back to on-demand recompute */ }
  s.loaded = true; s.loading = false
  emit(s)
}

function requestRecompute(market: Market, symbol: string) {
  const s = store(market)
  if (Date.now() - (s.lastTry[symbol] ?? 0) < 60_000) return
  s.lastTry[symbol] = Date.now()
  s.queue.add(symbol)
  s.timer ??= setTimeout(async () => {
    const symbols = [...s.queue].slice(0, 10)
    s.queue.clear(); s.timer = null
    try {
      const res = await fetch('/api/why/recompute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ market, symbols }) })
      const j = await res.json()
      Object.assign(s.explanations, j.data?.explanations ?? {})
    } catch { /* keep "updating"; retried after a minute */ }
    emit(s)
  }, 300)
}

export type WhyState = { explanation: Explanation | null; status: 'current' | 'updating' | 'none'; showNarration: boolean }

export function useWhy(market: Market, symbol: string, liveChangePct: number | null | undefined): WhyState {
  const s = store(market)
  useSyncExternalStore(cb => { s.listeners.add(cb); return () => { s.listeners.delete(cb) } }, () => s.version, () => 0)
  const e = s.explanations[symbol] ?? null
  const hasLive = typeof liveChangePct === 'number' && Number.isFinite(liveChangePct)
  const current = !!e && hasLive && isCurrent(e, liveChangePct!, Date.now())

  useEffect(() => { load(market) }, [market])
  useEffect(() => {
    if (!s.loaded || !hasLive) return
    if (!current) requestRecompute(market, symbol)
  }, [market, symbol, s.loaded, hasLive, current, s])

  if (!hasLive) return { explanation: null, status: 'none', showNarration: false }
  if (!e) return { explanation: null, status: s.loaded ? 'updating' : 'none', showNarration: false }
  if (!current) return { explanation: null, status: 'updating', showNarration: false }
  const showNarration = !!e.narration && !needsRecompute(e.narration.snapshot, liveChangePct!)
  return { explanation: e, status: 'current', showNarration }
}
