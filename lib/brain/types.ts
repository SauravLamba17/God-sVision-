// Market Brain — one structured picture of a market, built in code from data
// the app already has. Every item carries its source, time and score.
import type { Market } from '../evidence/types.ts'

export type { Market }

export interface Source { name: string; url?: string }

/** A number shown on screen. `changePct` is replaced with the live value at render time. */
export interface BrainQuote {
  symbol: string
  name: string
  changePct: number
  /** Absolute change (yields: percentage points). */
  change?: number | null
  source: Source
  at: number            // exchange time of the last trade, else fetch time
  score: number         // notability 0–1 (see engine.ts)
}

export interface BrainMover extends BrainQuote {
  summary: string       // evidence-engine why line (strong drivers only)
  drivers: { type: string; label: string; score: number; source: Source; at: number }[]
}

export interface BrainEvent {
  kind: 'earthquake' | 'outbreak'
  title: string
  source: Source
  at: number
  score: number
  /** Graph entities the event touches, with how. */
  touches: { id: string; name: string; type: string; via: string }[]
}

export interface ThemeHeadline { title: string; source: Source; at: number; tone: 'BULLISH' | 'BEARISH' | 'NEUTRAL' }

export interface Theme {
  id: string            // graph entity id the theme is grouped on (cluster: "cluster:<company>"; country/region: "<id>#<topic>")
  kind: 'sector' | 'commodity' | 'country' | 'region' | 'currency' | 'cluster'
  /** Country/region themes are split by topic ("rates", "tariffs / trade"…); never titled by the place alone. */
  topic?: string
  title: string
  score: number
  stories: number       // distinct stories (near-duplicates merged)
  sources: number       // distinct outlets
  headlines: ThemeHeadline[]
  moves: BrainQuote[]   // related price moves (≥1 required)
  tone: { positive: number; negative: number; neutral: number } // keyword estimate
}

export interface Upcoming {
  kind: 'earnings' | 'macro'
  title: string
  at: number            // scheduled time (date-only items: 00:00 market time)
  dateLabel: string     // as published, e.g. "2026-10-07 08:30 ET"
  impact?: 'high' | 'medium' | 'low'
  source: Source
  score: number
}

export interface BrainSnapshot {
  at: number
  /** Index % moves the brain was built from — drives flip/drift recompute. */
  indices: Record<string, number>
}

export interface Brain {
  market: Market
  builtAt: number
  session: { status: string; date: string; lastTrade: number | null }
  snapshot: BrainSnapshot
  state: {
    indices: BrainQuote[]
    breadth: { advancing: number; declining: number; unchanged: number; universe: string; source: Source; at: number; score: number } | null
    /** Evidence-engine line for the main index (strong drivers only). */
    indexWhy: string | null
  }
  sectors: { strongest: BrainQuote[]; weakest: BrainQuote[]; basis: string }
  movers: BrainMover[]
  crossAsset: BrainQuote[]          // notable only
  crossAssetChecked: string[]       // what was looked at, for "nothing notable"
  events: BrainEvent[]
  themes: Theme[]
  upcoming: Upcoming[]
  inputs?: Record<string, 'ok' | 'stale' | 'unavailable'>
  narration?: { text: string; provider: string; generatedAt: number; snapshot: BrainSnapshot }
}
