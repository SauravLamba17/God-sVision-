// One vocabulary for how fresh / how real a piece of data is. The API decides
// the status; the UI only displays it (DataStatusBadge) — never infers "live"
// from how recently the browser fetched.

export type DataStatus =
  | 'live'              // fetched from the upstream for this response (or within its short revalidate window)
  | 'delayed'           // real data the provider itself delays (e.g. exchange 15-min delay)
  | 'cached'            // served from our cache within its intended TTL
  | 'stale'             // cache past its TTL, served because the upstream failed
  | 'estimate'          // model- or rule-derived, not observed (synthetic chains, rules fallback)
  | 'static-reference'  // hand-maintained reference values, not a feed
  | 'unavailable'       // no data — upstream failed and nothing cached

export interface DataStatusInfo {
  status: DataStatus
  /** When the data was produced upstream (ISO string or epoch ms), if known. */
  asOf?: string | number | null
  /** Provider name shown in the tooltip, e.g. "Yahoo Finance". */
  source?: string
}

const LEGACY: Record<string, DataStatus> = {
  live: 'live',
  delayed: 'delayed',
  cache: 'cached', cached: 'cached',
  stale: 'stale', 'ai-stale': 'stale',
  estimate: 'estimate', rules: 'estimate', model: 'estimate',
  static: 'static-reference', 'static-reference': 'static-reference',
  empty: 'unavailable', unavailable: 'unavailable', error: 'unavailable',
}

/**
 * Maps a route's `source`/`status` string to a DataStatus. Unknown or missing
 * values return null — the UI then shows NO badge rather than guessing "live".
 */
export function toDataStatus(raw: string | null | undefined): DataStatus | null {
  return raw ? LEGACY[raw] ?? null : null
}
