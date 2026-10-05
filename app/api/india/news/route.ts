import { NextResponse } from 'next/server'
import { getIndiaNewsCached } from '@/lib/apis/indiaNews'

export const revalidate = 300

export async function GET() {
  try {
    const { data, source } = await getIndiaNewsCached()
    const articles = data.articles.slice(0, 40) // the panel's page; the cache keeps 48h for the evidence engine
    return NextResponse.json({ data: { ...data, articles, total: articles.length }, source })
  } catch (err) {
    return NextResponse.json({ error: String(err), data: { articles: [], total: 0, fetchedAt: Date.now() }, source: 'unavailable' })
  }
}
