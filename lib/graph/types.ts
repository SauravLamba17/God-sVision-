// Entity Graph types. The graph is curated reference data: hand-maintained,
// code-only (no AI, no DB, no upstream calls), reviewed as of GRAPH_META.lastReviewed.

export type EntityType = 'company' | 'sector' | 'country' | 'commodity' | 'index' | 'currency' | 'region'

export interface Entity {
  /** Companies use the app's own symbol (AAPL, RELIANCE.NS); everything else is `<type>:<slug>`. */
  id: string
  type: EntityType
  name: string
  /** Market symbols the app shows for this entity (Yahoo style), e.g. ['^GSPC', 'SPY']. */
  symbols?: string[]
  /** Company fields. */
  sector?: string      // sector entity id, e.g. 'sector:information-technology'
  industry?: string    // free text, e.g. 'Semiconductors'
  country?: string     // country entity id
  exchange?: string    // e.g. 'NASDAQ', 'NYSE', 'NSE'
  /**
   * Phrases that name this entity in a headline. Matched as whole words,
   * case-insensitive — unless listed in `caseSensitive` (for words that are
   * also ordinary English: "Apple", "Meta", "Dow").
   */
  aliases?: string[]
  caseSensitive?: string[]
  /** Regex sources for tricky names, e.g. 'ITC(?= (shares|stock|Ltd|Limited))'. Case-sensitive. */
  patterns?: string[]
  /** A match is rejected if one of these words immediately follows it ("gold medal", "Amazon rainforest"). */
  notFollowedBy?: string[]
  /** …or immediately preceded by one of these ("Hong Kong dollar" is not the US dollar). */
  notPrecededBy?: string[]
}

export type LinkType =
  | 'supplier_of'       // A supplies B (B is A's customer)
  | 'competitor_of'     // symmetric
  | 'constituent_of'    // company → index
  | 'exposed_to'        // company → commodity / currency / country
  | 'headquartered_in'  // company → country
  | 'in_sector'         // company → sector
  | 'subsidiary_of'     // A is majority-owned by B
  | 'currency_of'       // currency → country / region
  | 'benchmark_of'      // index → country / region
  | 'major_producer_of' // country → commodity
  | 'part_of'           // country → region

export interface Link {
  from: string
  to: string
  type: LinkType
  /** One short, verifiable sentence. */
  reason: string
}

export const SYMMETRIC: ReadonlySet<LinkType> = new Set<LinkType>(['competitor_of'])
