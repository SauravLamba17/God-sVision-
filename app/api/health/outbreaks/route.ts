import { NextRequest, NextResponse } from 'next/server'
import { fetchOutbreaks } from '@/lib/apis/whoOutbreaks'
import { z } from 'zod'
import { parseQuery, intParam } from '@/lib/validation'

const Query = z.object({ limit: intParam(1, 25).default(10) })

export async function GET(req: NextRequest) {
  const q = parseQuery(req, Query)
  if (q.error) return q.error
  const { limit } = q.data

  try {
    const data = await fetchOutbreaks(limit)
    return NextResponse.json({ data, source: 'live' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg, data: [], source: 'unavailable' }, { status: 200 })
  }
}
