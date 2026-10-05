// Accuracy rules for explanations shown next to LIVE prices.
//  - An explanation is tied to the move it was computed for (its snapshot).
//  - If the live move flips direction or drifts more than DRIFT_POINTS from that
//    snapshot, it must be recomputed — never shown as current.
//  - An explanation from a previous trading day is never current.
import type { Market, Snapshot } from './types.ts'

export const DRIFT_POINTS = 1.5
const EPS = 0.05 // moves within ±0.05% are treated as flat (no direction to flip)

export function needsRecompute(snap: Pick<Snapshot, 'changePct'>, liveChangePct: number): boolean {
  const a = snap.changePct, b = liveChangePct
  const flipped = Math.abs(a) > EPS && Math.abs(b) > EPS && Math.sign(a) !== Math.sign(b)
  return flipped || Math.abs(b - a) > DRIFT_POINTS
}

const TZ: Record<Market, string> = { US: 'America/New_York', IN: 'Asia/Kolkata' }
const dayIn = (t: number, market: Market) => new Date(t).toLocaleDateString('en-CA', { timeZone: TZ[market] })

/** Same calendar day in the market's own time zone. */
export function isSameMarketDay(generatedAt: number, now: number, market: Market): boolean {
  return dayIn(generatedAt, market) === dayIn(now, market)
}

/** Usable as the current explanation for this live move right now? */
export function isCurrent(e: { snapshot: Snapshot; generatedAt: number; market: Market }, liveChangePct: number, now: number): boolean {
  return isSameMarketDay(e.generatedAt, now, e.market) && !needsRecompute(e.snapshot, liveChangePct)
}
