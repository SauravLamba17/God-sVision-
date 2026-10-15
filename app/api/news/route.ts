import { NextResponse } from 'next/server'
import { getAllNewsCached } from '@/lib/apis/news'
import { newsCacheHeaders } from '@/lib/cache'

// Dynamic, not ISR (see /api/india/news): a non-empty feed is shared by the CDN for
// 5 min and never stores an empty one; the loader retries an outage at most once a minute.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, source } = await getAllNewsCached()
    return NextResponse.json({ data: data.items, source, meta: data.meta }, { headers: newsCacheHeaders(data.items.length) })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg, data: [], source: 'unavailable', meta: { total: 0, sources: 0, lastUpdated: new Date().toISOString(), feedNames: [] } }, { headers: newsCacheHeaders(0) })
  }
}
