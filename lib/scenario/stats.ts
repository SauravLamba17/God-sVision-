// Pure statistics for the sensitivity build (scripts/build-sensitivities.ts) and its tests.
import { move, type Unit } from './factors.ts'

/** A daily series: ascending exchange-local dates (YYYY-MM-DD) with their closes (no nulls). */
export interface Series { dates: string[]; closes: number[] }

/** Moves keyed by period: each entry's close vs the previous entry's close. */
export function dailyMoves(s: Series, unit: Unit): Map<string, number> {
  const out = new Map<string, number>()
  for (let i = 1; i < s.dates.length; i++) out.set(s.dates[i], move(s.closes[i - 1], s.closes[i], unit))
  return out
}

/**
 * The factor move to pair with a stock's move on `date`.
 *  'same'     — the factor's move on the same date (US stocks; factors trading in the stock's hours)
 *  'previous' — the factor's move on its latest date BEFORE `date`: an Indian close (15:30 IST) comes
 *               before that day's US session, so the US move it can reflect is the previous session's.
 * `factorDates` must be ascending.
 */
export function alignedMove(date: string, factorDates: string[], factorMoves: Map<string, number>, mode: 'same' | 'previous'): number | undefined {
  if (mode === 'same') return factorMoves.get(date)
  let lo = 0, hi = factorDates.length - 1, best = -1
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (factorDates[mid] < date) { best = mid; lo = mid + 1 } else hi = mid - 1 }
  return best >= 0 ? factorMoves.get(factorDates[best]) : undefined
}

/** ISO week ("2026-W42") of a YYYY-MM-DD date. */
export function isoWeek(date: string): string {
  const d = new Date(`${date}T00:00:00Z`), day = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - day + 3) // Thursday of this week decides the year
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Non-overlapping weekly series: the last close of each ISO week, keyed by week. */
export function weekly(s: Series): Series {
  const out: Series = { dates: [], closes: [] }
  s.dates.forEach((d, i) => {
    const w = isoWeek(d)
    if (out.dates.at(-1) === w) out.closes[out.closes.length - 1] = s.closes[i]
    else { out.dates.push(w); out.closes.push(s.closes[i]) }
  })
  return out
}

export interface Coef { b: number; se: number; t: number }

/** Reliability rule (approved 2026-10-15). */
export const RULE = { minN: 250, minT: 2.5, minTNoPath: 3 }
/** n ≥ 250, |t| ≥ 2.5, same sign in both halves of the window; |t| ≥ 3 without a graph business link. */
export function isReliable(f: { n: number; t: number; b: number; halves: readonly [number, number] | null }, hasPath: boolean): boolean {
  const sameSign = !!f.halves && f.halves.every(h => Math.sign(h) === Math.sign(f.b))
  return f.n >= RULE.minN && Math.abs(f.t) >= RULE.minT && sameSign && (hasPath || Math.abs(f.t) >= RULE.minTNoPath)
}

/**
 * OLS y = X·β (X includes the intercept column) with heteroskedasticity-robust
 * (HC1) standard errors: (X'X)⁻¹ X' diag(e²) X (X'X)⁻¹ × n / (n − k).
 * Returns null when X'X is singular.
 */
export function olsHC1(y: number[], X: number[][]): { coefs: Coef[]; r2: number; n: number } | null {
  const n = y.length, k = X[0]?.length ?? 0
  if (n <= k) return null
  const XtX = Array.from({ length: k }, () => new Array(k).fill(0)), Xty = new Array(k).fill(0)
  for (let t = 0; t < n; t++) { const r = X[t]; for (let i = 0; i < k; i++) { Xty[i] += r[i] * y[t]; for (let j = 0; j < k; j++) XtX[i][j] += r[i] * r[j] } }
  const inv = invert(XtX)
  if (!inv) return null
  const beta = inv.map(row => row.reduce((s, v, j) => s + v * Xty[j], 0))
  const meat = Array.from({ length: k }, () => new Array(k).fill(0))
  let sse = 0, sst = 0
  const my = y.reduce((a, b) => a + b, 0) / n
  for (let t = 0; t < n; t++) {
    const r = X[t], e = y[t] - r.reduce((s, x, j) => s + x * beta[j], 0)
    sse += e * e; sst += (y[t] - my) ** 2
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) meat[i][j] += r[i] * r[j] * e * e
  }
  const scale = n / (n - k)
  const coefs = beta.map((b, c) => {
    // c-th diagonal element of inv · meat · inv
    let v = 0
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) v += inv[c][i] * meat[i][j] * inv[j][c]
    const se = Math.sqrt(v * scale)
    return { b, se, t: b / se }
  })
  return { coefs, r2: sst ? 1 - sse / sst : 0, n }
}

function invert(A: number[][]): number[][] | null {
  const k = A.length, M = A.map((r, i) => [...r, ...Array.from({ length: k }, (_, j) => +(i === j))])
  for (let c = 0; c < k; c++) {
    let p = c
    for (let r = c + 1; r < k; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    if (Math.abs(M[p][c]) < 1e-12) return null
    ;[M[c], M[p]] = [M[p], M[c]]
    const v = M[c][c]
    for (let j = 0; j < 2 * k; j++) M[c][j] /= v
    for (let r = 0; r < k; r++) if (r !== c) { const f = M[r][c]; if (f) for (let j = 0; j < 2 * k; j++) M[r][j] -= f * M[c][j] }
  }
  return M.map(r => r.slice(k))
}

/** Moves over `k` trading days (overlapping windows), in the series' unit. */
export function rollingMoves(s: Series, unit: Unit, k = 20): number[] {
  const out: number[] = []
  for (let i = k; i < s.closes.length; i++) out.push(move(s.closes[i - k], s.closes[i], unit))
  return out
}

/** Linear-interpolated percentile (p in 0–100) of an unsorted list. */
export function percentile(xs: number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b), i = (p / 100) * (s.length - 1), lo = Math.floor(i)
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo)
}

/** Deterministic PRNG (mulberry32) for permutation tests. */
export function rng(seed: number): () => number {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
