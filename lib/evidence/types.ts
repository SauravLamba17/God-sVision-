// Evidence Engine types. Evidence = candidate drivers computed in code from data
// the app already fetches. It shows correlation and coincidence, never proof of
// cause (see WORDING in summary.ts).

export type Market = 'US' | 'IN'

export type DriverType =
  | 'market'         // moved with the benchmark index
  | 'sector'         // moved with its sector (ETF or average of sector constituents)
  | 'peers'          // graph-linked companies moved the same way
  | 'news'           // a headline names this stock/index
  | 'related_news'   // a headline names a directly linked entity (supplier, competitor…)
  | 'linked_event'   // earthquake / outbreak in a country linked to it via the graph
  | 'commodity'      // a commodity it's exposed to moved
  | 'currency'       // a currency it's exposed to moved
  | 'scheduled'      // earnings / high-impact macro release
  | 'volume'         // unusual volume vs its average
  | 'breadth'        // (indices) how many sectors/constituents moved the same way
  | 'global'         // (indices) other markets moved the same way
  | 'no_clear_driver'

export interface Driver {
  type: DriverType
  /** 0–1; how much of the move this plausibly accounts for. Formula per type in engine.ts. */
  score: number
  /** Short clause for the one-line summary, e.g. "moved with Nasdaq (−2.4%)". */
  label: string
  /** Fuller evidence for the expanded view. */
  evidence: string
  source: { name: string; url?: string }
  /** When the underlying data was produced (epoch ms). */
  timestamp: number
}

/** The live move an explanation was computed against. */
export interface Snapshot { symbol: string; price: number | null; changePct: number; at: number; marketTime?: number | null }

export interface Narration { text: string; provider: string; generatedAt: number; snapshot: Snapshot }

export interface Explanation {
  id: string                // the symbol the UI keys on (AAPL, RELIANCE.NS, ^GSPC)
  name: string
  kind: 'stock' | 'index'
  market: Market
  snapshot: Snapshot
  drivers: Driver[]         // sorted by score, highest first
  /** Deterministic one-line body WITHOUT the symbol/% head — the UI prefixes the LIVE move. */
  summary: string
  generatedAt: number
  narration?: Narration     // optional AI rewrite of the same evidence (labelled AI)
}

// ── Inputs (built by context.ts from the app's cached data) ─────────────────

// at = when the app fetched it; marketTime = the exchange time of the last trade
// (bounds which headlines may attach to this move).
export interface Quote { symbol: string; name: string; price: number | null; changePct: number; volume?: number | null; avgVolume?: number | null; at: number; marketTime?: number | null; change?: number | null }

export interface Headline {
  id: number
  title: string
  url?: string
  source: string
  publishedAt: number
  entities: string[]        // graph entity ids matched in the title
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'   // keyword estimate
  /** 'ticker' = from a per-ticker search for a mover (biased toward movers; not used for themes). */
  via?: 'ticker'
}

export interface LinkedEventInput { kind: 'earthquake' | 'outbreak'; title: string; url?: string; at: number; countries: string[]; magnitude?: number }
export interface EarningsInput { symbol: string; date: string; timing: string }
export interface MacroEventInput { title: string; currency: string; date: string; time: string; impact: 'high' | 'medium' | 'low' }

export interface MarketContext {
  market: Market
  builtAt: number
  /** Benchmark indices and other index moves, by symbol (^GSPC, ^IXIC, ^NSEI, ^NSEBANK…). */
  indices: Record<string, Quote>
  /** Sector moves by sector entity id (US: sector ETFs). India sectors are averaged from `quotes` in the engine. */
  sectorEtfs: Record<string, Quote & { etf: string }>
  /** Every stock quote the app has (US movers + defaults; all Nifty 50), by symbol. */
  quotes: Record<string, Quote>
  /** Commodity moves by commodity entity id; currency moves by currency entity id. */
  commodities: Record<string, Quote>
  currencies: Record<string, Quote>
  headlines: Headline[]
  events: LinkedEventInput[]
  earnings: EarningsInput[]
  macro: MacroEventInput[]
  /** Other markets for index explanations (Nikkei, DAX…), by symbol. */
  globalIndices: Record<string, Quote>
  /** Treasury yields (US only), by symbol; `change` is in percentage points. */
  rates?: Record<string, Quote>
  /** Which inputs loaded, for transparency ("news: unavailable"). */
  inputs?: Record<string, 'ok' | 'stale' | 'unavailable'>
}
