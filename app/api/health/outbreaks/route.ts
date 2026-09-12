import { NextRequest, NextResponse } from 'next/server'
import { fetchOutbreaks } from '@/lib/apis/whoOutbreaks'

export async function GET(req: NextRequest) {
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '10', 10) || 10, 25)

  try {
    const data = await fetchOutbreaks(limit)
    return NextResponse.json({ data, source: 'live' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg, data: [], source: 'unavailable' }, { status: 200 })
  }
}
