import { NextRequest, NextResponse } from 'next/server'
import { z, type ZodTypeAny } from 'zod'

// Shared request validation. Invalid input → 400 { error } with the first
// problem spelled out, never a 500 from a downstream parseInt/toUpperCase/DB call.

// Yahoo-style symbols: AAPL, BRK-B, BRK.B, ^NSEI, BTC-USD, EURUSD=X, GC=F, RELIANCE.NS
export const TICKER_RE = /^[A-Z0-9^][A-Z0-9.\-=^&]{0,19}$/
export const ticker = z.string().trim().toUpperCase().regex(TICKER_RE, 'invalid ticker')

/** Comma-separated tickers, de-duplicated, at most `max`. */
export const tickerList = (max: number) =>
  z.string().trim().toUpperCase()
    .transform(s => [...new Set(s.split(',').map(t => t.trim()).filter(Boolean))])
    .pipe(z.array(z.string().regex(TICKER_RE, 'invalid ticker')).min(1, 'at least one ticker required').max(max, `at most ${max} tickers`))

/** Query-string integer with bounds (coerced from the string). */
export const intParam = (min: number, max: number) => z.coerce.number().int().min(min).max(max)
/** Query-string number with bounds. */
export const numParam = (min: number, max: number) => z.coerce.number().finite().min(min).max(max)

/** Positive DB id (Int autoincrement). */
export const id = z.coerce.number().int().positive().max(2_147_483_647)

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  .refine(s => !Number.isNaN(Date.parse(s)), 'invalid date')

/** A positive amount: quantities, prices, targets. */
export const positiveAmount = z.coerce.number().finite().positive().max(1e12)

export const shortText = (max: number) => z.string().trim().max(max)

// Custom messages are shown as written; zod's generic defaults ("Required",
// "Expected number…") get the field name so the caller knows which one.
const firstIssue = (e: z.ZodError) => {
  const i = e.issues[0]
  const generic = /^(Required|Expected|Invalid|Number must|String must|Array must)/.test(i.message)
  return i.path.length && generic ? `${i.path.join('.')}: ${i.message}` : i.message
}

type Parsed<S extends ZodTypeAny> = { data: z.infer<S>; error?: undefined } | { data?: undefined; error: NextResponse }

const bad = (message: string, headers?: Record<string, string>) =>
  NextResponse.json({ error: message }, { status: 400, headers })

/** Validate query params (each key read once; absent keys are undefined). */
export function parseQuery<S extends ZodTypeAny>(req: NextRequest | Request, schema: S, headers?: Record<string, string>): Parsed<S> {
  const params = req instanceof NextRequest ? req.nextUrl.searchParams : new URL(req.url).searchParams
  const raw: Record<string, string> = {}
  params.forEach((v, k) => { if (!(k in raw)) raw[k] = v })
  const r = schema.safeParse(raw)
  return r.success ? { data: r.data } : { error: bad(firstIssue(r.error), headers) }
}

/** Validate a JSON body; malformed JSON is a 400 too. */
export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S, headers?: Record<string, string>): Promise<Parsed<S>> {
  let json: unknown
  try { json = await req.json() } catch { return { error: bad('body must be valid JSON', headers) } }
  const r = schema.safeParse(json)
  return r.success ? { data: r.data } : { error: bad(firstIssue(r.error), headers) }
}
