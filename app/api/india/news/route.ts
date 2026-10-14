import { NextResponse } from 'next/server'
import { getIndiaNewsCached } from '@/lib/apis/indiaNews'
import { newsCacheHeaders } from '@/lib/cache'

// Dynamic, not ISR: ISR stored whatever the build (or a revalidation) returned —
// including an empty list — for 5 min. The CDN now shares a non-empty response for
// 5 min; an empty one is never cached, so the next request retries.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, source } = await getIndiaNewsCached()
    const articles = data.articles.slice(0, 40) // the panel's page; the cache keeps 48h for the evidence engine
    return NextResponse.json({ data: { ...data, articles, total: articles.length }, source }, { headers: newsCacheHeaders(articles.length) })
  } catch (err) {
    return NextResponse.json({ error: String(err), data: { articles: [], total: 0, fetchedAt: Date.now() }, source: 'unavailable' }, { headers: newsCacheHeaders(0) })
  }
}
