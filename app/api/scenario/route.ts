import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseQuery } from '@/lib/validation'
import { scenarioCached } from '@/lib/scenario/data'
import { marketParam, ScenarioParams } from '@/lib/scenario/schema'
import type { ScenarioInput } from '@/lib/scenario/engine'

// Scenario results from the precomputed sensitivity file: no user data, no upstream
// calls. Memoised per parameter set on the instance and shared by the CDN for an hour.
const Query = z.object({ market: marketParam }).and(ScenarioParams)

export async function GET(req: NextRequest) {
  const q = parseQuery(req, Query)
  if (q.error) return q.error
  try {
    const data = scenarioCached(q.data as ScenarioInput)
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=600' } })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
