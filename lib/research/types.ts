// Research Agent types — shared by the parser, fact gathering, the answer and the UI.
// Pure types only (usable from client and server).
import type { DataStatus } from '../dataStatus.ts'
import type { FactorId, Market } from '../scenario/factors.ts'
import type { PresetId } from '../scenario/presets.ts'

export type { Market }

export type Intent = 'WHY_MOVE' | 'WHAT_IF' | 'CONNECTIONS' | 'MARKET_TODAY' | 'NEWS' | 'PORTFOLIO' | 'ADVICE' | 'UNSUPPORTED'
export type WindowKey = 'today' | 'yesterday' | 'week' | 'month'

export interface EntityRef { id: string; name: string; type: string }

export interface Parsed {
  /** Sanitised question (trimmed, control characters removed). Never sent to an AI provider. */
  question: string
  intent: Intent
  market: Market
  /** Subjects named in the question (companies, sectors, indices, commodities…), in order of appearance. */
  entities: EntityRef[]
  window: { key: WindowKey; label: string }
  /** WHY_MOVE: the direction the question asserts ("why is X falling" is -1), checked against the data. */
  asserted?: 1 | -1
  /** WHAT_IF: the factor and direction asked about (size only when the question gives one), or an event preset. */
  shock?: { factor: FactorId; direction: 1 | -1; size?: number } | { preset: PresetId }
  /** Names that resolved to nothing (with the closest graph names) or to several companies. */
  unknown: { text: string; suggestions: string[]; ambiguous?: boolean }[]
  /** Things the parser decided that the answer should say ("Assuming you meant Nvidia", "clamped to 1 month"). */
  notes: string[]
}

export type Section = 'moved' | 'news' | 'connections' | 'pattern' | 'scenario' | 'market' | 'portfolio' | 'cant'

export interface Fact {
  id: number
  kind: string
  section: Section
  text: string
  value?: number
  unit?: '%' | 'bp' | 'pts' | 'pp'
  /** Third-party title quoted by this fact (headline), kept apart from our own wording. */
  quote?: string
  /** Short clause for composing a sentence ("moved with Nasdaq (+1.2%)"); evidence drivers only. */
  label?: string
  /** Evidence driver at or above the STRONG line (named in the line); weaker ones are context only. */
  strong?: boolean
  source: { name: string; url?: string; asOf: number | string | null }
  status: DataStatus
}

export interface FactSheet {
  parsed: Parsed
  facts: Fact[]
  /** The one status shown for the whole answer: the least fresh of the facts it relies on. */
  dataStatus: { status: DataStatus; asOf: number | null; note: string }
  /** Values the deterministic headline needs, by name (never shown without a cited fact). */
  key: Record<string, number | string | null>
  /** Holds private data (portfolio): never cached, never shared, never sent to AI. */
  private: boolean
}

export interface Sentence { text: string; cites: number[] }
export interface Answer {
  label: string
  /** 'fixed' = a set reply (advice, unsupported, unknown name) with no data behind it. */
  kind: 'answer' | 'fixed'
  headline: Sentence
  /** What the parser assumed or limited ("Assuming “nvdia” means Nvidia"). */
  notes: string[]
  sections: { key: Section; title: string; sentences: Sentence[] }[]
  sources: { n: number; name: string; url?: string; asOf: number | string | null; facts: number[] }[]
}

/** Example questions per market (page chips, set replies). */
export const EXAMPLES: Record<Market, string[]> = {
  US: ['Why is Nvidia up today?', 'Why is Tesla moving this week?', 'What if oil jumps 20%?', 'How is Nvidia connected to TSMC?', 'What’s driving the US market today?', 'Latest news on Apple'],
  IN: ['Why is Reliance falling this week?', 'What happens to Indian stocks if oil jumps 20%?', 'How is TCS connected to Infosys?', 'What’s driving the Indian market today?', 'Latest news on Infosys', 'Why is HDFC Bank moving this month?'],
}
