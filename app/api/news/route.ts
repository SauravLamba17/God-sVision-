import { NextResponse } from 'next/server'
import { getAllNewsCached } from '@/lib/apis/news'

export const revalidate = 300

export async function GET() {
  try {
    const { data, source } = await getAllNewsCached()
    return NextResponse.json({ data: data.items, source, meta: data.meta })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg, data: [], source: 'unavailable', meta: { total: 0, sources: 0, lastUpdated: new Date().toISOString(), feedNames: [] } })
  }
}
