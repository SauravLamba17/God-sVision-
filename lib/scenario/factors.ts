// Scenario Engine factors — pure, usable from client and server.
// Each factor is one Yahoo series; its daily "move" is measured in the factor's
// own unit. Units were checked against live Yahoo data (Oct 2026):
//   ^TNX     quoted as the yield in percent (5.19 = 5.19%), so a move is Δ × 100 bp
//   ^VIX     index points; a move is Δ in points (not a percent return)
//   futures  CL=F (WTI), BZ=F (Brent), GC=F (gold) in USD; the latest bar can be a
//            partial session with a null close — callers skip nulls
//   DX-Y.NYB ICE US dollar index; USDINR=X rupees per US dollar (up = weaker rupee)

export type Market = 'US' | 'IN'
export type FactorId = 'wti' | 'brent' | 'gold' | 'dxy' | 'us10y' | 'usdinr' | 'vix'
export type Unit = 'pct' | 'bp' | 'pt'

export interface Factor {
  id: FactorId
  name: string
  symbol: string
  unit: Unit
  /** Graph entity the factor is (for paths like "oil → refining → Reliance"). */
  entity?: string
  /** Largest custom shock accepted, in the factor's unit (both directions). */
  maxShock: number
  /** Trades during US hours: an Indian close sees only the previous US session's move. */
  usHours: boolean
}

export const FACTORS: Record<FactorId, Factor> = {
  wti:    { id: 'wti',    name: 'WTI crude',       symbol: 'CL=F',     unit: 'pct', entity: 'commodity:crude-oil', maxShock: 60,  usHours: true },
  brent:  { id: 'brent',  name: 'Brent crude',     symbol: 'BZ=F',     unit: 'pct', entity: 'commodity:crude-oil', maxShock: 60,  usHours: true },
  gold:   { id: 'gold',   name: 'Gold',            symbol: 'GC=F',     unit: 'pct', entity: 'commodity:gold',      maxShock: 40,  usHours: true },
  dxy:    { id: 'dxy',    name: 'US dollar index', symbol: 'DX-Y.NYB', unit: 'pct', entity: 'currency:usd',        maxShock: 15,  usHours: true },
  us10y:  { id: 'us10y',  name: 'US 10-year yield', symbol: '^TNX',    unit: 'bp',                                 maxShock: 300, usHours: true },
  // USD/INR's daily bar (London date) spans the Indian session, so it is used same-day.
  usdinr: { id: 'usdinr', name: 'USD/INR',         symbol: 'USDINR=X', unit: 'pct', entity: 'currency:inr',        maxShock: 15,  usHours: false },
  vix:    { id: 'vix',    name: 'VIX',             symbol: '^VIX',     unit: 'pt',  entity: 'index:vix',           maxShock: 40,  usHours: true },
}
export const FACTOR_IDS = Object.keys(FACTORS) as FactorId[]

/** Market controls: a stock's return is regressed on its own market as well as the factor. */
export const MARKET_CONTROL: Record<Market, { symbol: string; name: string }> = {
  US: { symbol: '^GSPC', name: 'S&P 500' },
  IN: { symbol: '^NSEI', name: 'Nifty 50' },
}

/** One move of a series in its unit: percent return, basis points (yields) or points (VIX). */
export function move(prev: number, cur: number, unit: Unit): number {
  return unit === 'pct' ? (cur / prev - 1) * 100 : unit === 'bp' ? (cur - prev) * 100 : cur - prev
}

/** "+20%", "+100bp", "+10 pts" (signed, unit-aware). */
export function shockLabel(shock: number, unit: Unit): string {
  const s = `${shock > 0 ? '+' : shock < 0 ? '−' : ''}${Math.abs(shock)}`
  return unit === 'pct' ? `${s}%` : unit === 'bp' ? `${s}bp` : `${s} pts`
}

/** Factors estimated per market: one oil benchmark each (WTI for US stocks, Brent for India), never both. */
export const MARKET_FACTORS: Record<Market, FactorId[]> = {
  US: ['wti', 'gold', 'dxy', 'us10y', 'usdinr', 'vix'],
  IN: ['brent', 'gold', 'dxy', 'us10y', 'usdinr', 'vix'],
}
/** USD/INR is estimated on weekly non-overlapping returns over 5 years; the rest on 2 years of daily moves. */
export const WEEKLY_FACTORS: ReadonlySet<FactorId> = new Set<FactorId>(['usdinr'])

/** Sector funds / indices with sensitivities of their own (checked on Yahoo for 2 years of clean data, Oct 2026).
 *  Nifty Auto, Metal, Energy and FMCG (^CNXAUTO, ^CNXMETAL, ^CNXENERGY, ^CNXFMCG) return no history, so those
 *  sectors — and US communication services / real estate — use the median of their reliable constituents. */
export interface SectorFund { symbol: string; name: string; market: Market; sector?: string; members?: string[] }
export const SECTOR_FUNDS: SectorFund[] = [
  { symbol: 'XLE', name: 'Energy', market: 'US', sector: 'sector:energy' },
  { symbol: 'XLF', name: 'Financials', market: 'US', sector: 'sector:financials' },
  { symbol: 'XLK', name: 'Information Technology', market: 'US', sector: 'sector:information-technology' },
  { symbol: 'XLU', name: 'Utilities', market: 'US', sector: 'sector:utilities' },
  { symbol: 'XLB', name: 'Materials', market: 'US', sector: 'sector:materials' },
  { symbol: 'XLI', name: 'Industrials', market: 'US', sector: 'sector:industrials' },
  { symbol: 'XLV', name: 'Health Care', market: 'US', sector: 'sector:health-care' },
  { symbol: 'XLY', name: 'Consumer Discretionary', market: 'US', sector: 'sector:consumer-discretionary' },
  { symbol: 'XLP', name: 'Consumer Staples', market: 'US', sector: 'sector:consumer-staples' },
  { symbol: 'JETS', name: 'US airlines (JETS)', market: 'US', members: ['DAL', 'UAL', 'LUV'] },
  { symbol: 'GDX', name: 'Gold miners (GDX)', market: 'US', members: ['NEM'] },
  { symbol: '^CNXIT', name: 'Nifty IT', market: 'IN', sector: 'sector:information-technology' },
  { symbol: '^NSEBANK', name: 'Nifty Bank', market: 'IN', sector: 'sector:financials' },
  { symbol: '^CNXPHARMA', name: 'Nifty Pharma', market: 'IN', sector: 'sector:health-care' },
]
