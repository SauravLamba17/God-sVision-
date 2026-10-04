import axios, { type InternalAxiosRequestConfig } from 'axios'

// Passive, in-memory record of upstream feed outcomes for /admin/health.
// Records only calls the app already makes — no extra upstream requests, no DB
// writes. Per server instance: it starts empty on a cold start and each
// instance sees only its own traffic (the health page says so).
//
// Cost: one Map write + performance.now() per upstream call (microseconds).

export interface FeedStats {
  feed: string
  calls: number
  failures: number
  lastOkAt: number | null
  lastErrorAt: number | null
  lastError: string | null
  lastMs: number | null
  lastStatus: number | null
}

const feeds = new Map<string, FeedStats>()
export const instanceStartedAt = Date.now()
export const instanceId = Math.random().toString(36).slice(2, 10)

// Cross-instance view: every 5 minutes at most, an instance's summary rides
// along in a DB write that request is ALREADY making (lib/rateLimit's counter
// statement — write/auth/AI/Sheets routes only). Never its own round trip,
// never on read paths. Rows expire after an hour of silence.
export const SUMMARY_EVERY_MS = 5 * 60_000
export const SUMMARY_TTL_MS = 60 * 60_000
let lastSummaryAt = 0

export interface InstanceSummary { instanceId: string; startedAt: number; reportedAt: number; feeds: FeedStats[] }

/** The summary to persist now, or null if one was written < 5 min ago (or nothing recorded yet). */
export function takeSummaryIfDue(): { key: string; value: string } | null {
  const now = Date.now()
  if (feeds.size === 0 || now - lastSummaryAt < SUMMARY_EVERY_MS) return null
  lastSummaryAt = now
  const summary: InstanceSummary = { instanceId, startedAt: instanceStartedAt, reportedAt: now, feeds: feedSnapshot() }
  return { key: `health:${instanceId}`, value: JSON.stringify(summary) }
}

/** Merge per-feed stats from several instances: counts add up, latest events win. */
export function mergeFeeds(lists: FeedStats[][]): FeedStats[] {
  const out = new Map<string, FeedStats>()
  for (const list of lists) for (const f of list) {
    const m = out.get(f.feed)
    if (!m) { out.set(f.feed, { ...f }); continue }
    const fLast = Math.max(f.lastOkAt ?? 0, f.lastErrorAt ?? 0), mLast = Math.max(m.lastOkAt ?? 0, m.lastErrorAt ?? 0)
    m.calls += f.calls
    m.failures += f.failures
    m.lastOkAt = Math.max(m.lastOkAt ?? 0, f.lastOkAt ?? 0) || null
    if ((f.lastErrorAt ?? 0) > (m.lastErrorAt ?? 0)) { m.lastErrorAt = f.lastErrorAt; m.lastError = f.lastError }
    if (fLast > mLast) { m.lastMs = f.lastMs; m.lastStatus = f.lastStatus }
  }
  return [...out.values()].sort((a, b) => a.feed.localeCompare(b.feed))
}

// Hostname → feed name. Unlisted hosts are recorded under their hostname
// (e.g. individual RSS publishers).
const HOSTS: [RegExp, string][] = [
  [/(^|\.)finance\.yahoo\.com$/, 'Yahoo Finance'],
  [/^data\.alpaca\.markets$/, 'Alpaca (IEX)'],
  [/(^|\.)coingecko\.com$/, 'CoinGecko'],
  [/(^|\.)nseindia\.com$/, 'NSE India'],
  [/(^|\.)stlouisfed\.org$/, 'FRED'],
  [/(^|\.)opensky-network\.org$/, 'OpenSky'],
  [/^earthquake\.usgs\.gov$/, 'USGS'],
  [/(^|\.)who\.int$/, 'WHO'],
  [/open-meteo\.com$/, 'Open-Meteo'],
  [/(^|\.)openweathermap\.org$/, 'OpenWeather'],
  [/(^|\.)newsapi\.org$/, 'NewsAPI'],
  [/^api\.nasdaq\.com$/, 'Nasdaq'],
  [/(^|\.)disease\.sh$/, 'disease.sh'],
  [/wheretheiss\.at$|open-notify\.org$/, 'ISS position'],
  [/corquaid\.github\.io$/, 'ISS crew'],
  [/(^|\.)reddit\.com$/, 'Reddit'],
  [/(^|\.)thesportsdb\.com$/, 'TheSportsDB'],
  [/(^|\.)windy\.com$/, 'Windy'],
  [/(^|\.)alternative\.me$/, 'Fear & Greed (alternative.me)'],
  [/(^|\.)llama\.fi$/, 'DefiLlama'],
  [/(^|\.)sec\.gov$/, 'SEC EDGAR'],
  [/(^|\.)weather\.gov$/, 'NOAA'],
]

export function feedForUrl(url: string): string {
  try {
    const host = new URL(url).hostname
    return HOSTS.find(([re]) => re.test(host))?.[1] ?? host
  } catch {
    return 'unknown'
  }
}

export function recordFeed(feed: string, ok: boolean, ms: number, error?: string, status?: number) {
  const s = feeds.get(feed) ?? { feed, calls: 0, failures: 0, lastOkAt: null, lastErrorAt: null, lastError: null, lastMs: null, lastStatus: null }
  s.calls++
  s.lastMs = Math.round(ms)
  s.lastStatus = status ?? null
  if (ok) s.lastOkAt = Date.now()
  else { s.failures++; s.lastErrorAt = Date.now(); s.lastError = (error ?? 'error').slice(0, 200) }
  feeds.set(feed, s)
}

/** Drop-in for fetch in server code: `import { trackedFetch as fetch } from '@/lib/feedHealth'`. */
export async function trackedFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const feed = feedForUrl(url)
  const t0 = performance.now()
  try {
    const res = await fetch(input, init)
    recordFeed(feed, res.ok, performance.now() - t0, res.ok ? undefined : `HTTP ${res.status}`, res.status)
    return res
  } catch (e) {
    recordFeed(feed, false, performance.now() - t0, (e as Error).message)
    throw e
  }
}

/** Times any promise-returning upstream call (yahoo-finance2, axios, Gemini). */
export async function track<T>(feed: string, call: () => Promise<T>): Promise<T> {
  const t0 = performance.now()
  try {
    const out = await call()
    recordFeed(feed, true, performance.now() - t0)
    return out
  } catch (e) {
    recordFeed(feed, false, performance.now() - t0, (e as Error).message)
    throw e
  }
}

// axios (most lib/apis modules) — one pair of interceptors on the shared default
// instance records every call. Registered once per module instance; files that
// use axios import this module for the side effect.
const ax = axios as typeof axios & { __gvTracked?: boolean }
if (!ax.__gvTracked) {
  ax.__gvTracked = true // flag on the instance: each axios copy is instrumented exactly once
  type Timed = InternalAxiosRequestConfig & { __t0?: number }
  const urlOf = (c?: Timed) => (c?.baseURL && c.url && !/^https?:/.test(c.url) ? c.baseURL + c.url : c?.url ?? '')
  axios.interceptors.request.use((c: Timed) => { c.__t0 = performance.now(); return c })
  axios.interceptors.response.use(
    res => { const c = res.config as Timed; recordFeed(feedForUrl(urlOf(c)), true, performance.now() - (c.__t0 ?? performance.now()), undefined, res.status); return res },
    err => {
      const c = err?.config as Timed | undefined
      recordFeed(feedForUrl(urlOf(c)), false, performance.now() - (c?.__t0 ?? performance.now()), err?.message, err?.response?.status)
      return Promise.reject(err)
    },
  )
}

export function feedSnapshot(): FeedStats[] {
  return [...feeds.values()].sort((a, b) => a.feed.localeCompare(b.feed))
}
