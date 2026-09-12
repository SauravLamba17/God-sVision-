import { getCache, setCache } from '@/lib/cache'

/**
 * WHO Disease Outbreak News.
 *
 * The old RSS feed (who.int/feeds/entity/csr/don/en/rss.xml) is gone — WHO's
 * site rewrite retired every /feeds/ path and it now 404s, as do the plausible
 * /rss-feeds/ successors. DON is published through WHO's own OData endpoint
 * instead, which is what the who.int outbreak-news page itself reads, so it is
 * the live source rather than a mirror of one.
 */
const DON_API =
  'https://www.who.int/api/news/diseaseoutbreaknews' +
  '?$orderby=PublicationDateAndTime%20desc' +
  '&$select=Title,PublicationDateAndTime,ItemDefaultUrl,Summary'

const DON_ITEM_BASE = 'https://www.who.int/emergencies/disease-outbreak-news/item'

export interface Outbreak {
  title: string
  link: string
  date: string      // ISO 8601
  summary: string
}

// WHO posts a handful of these a month, so an hour of cache is still fresh
// enough to catch a new entry the day it lands.
const TTL_SECONDS = 3600

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function fetchOutbreaks(limit = 10): Promise<Outbreak[]> {
  const cacheKey = `who_outbreaks_${limit}`
  const cached = await getCache<Outbreak[]>(cacheKey)
  if (cached && !cached.stale) return cached.data

  try {
    const res = await fetch(`${DON_API}&$top=${limit}`, {
      headers: { 'User-Agent': 'GodVision/1.0 (operations@myhealthiq.io)', Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`WHO DON responded ${res.status}`)

    const json = await res.json()
    const rows: any[] = Array.isArray(json?.value) ? json.value : []

    const outbreaks = rows
      .map(r => ({
        title: String(r?.Title ?? '').trim(),
        // ItemDefaultUrl arrives as a leading-slash slug, e.g. "/2026-DON617".
        link: r?.ItemDefaultUrl ? `${DON_ITEM_BASE}${r.ItemDefaultUrl}` : DON_ITEM_BASE,
        date: String(r?.PublicationDateAndTime ?? ''),
        summary: stripHtml(String(r?.Summary ?? '')),
      }))
      .filter(o => o.title)

    if (!outbreaks.length) throw new Error('WHO DON returned no entries')

    await setCache(cacheKey, outbreaks, TTL_SECONDS)
    return outbreaks
  } catch (err) {
    // Serve stale over empty — a WHO outage shouldn't blank a panel that was
    // showing real alerts a minute ago.
    if (cached) return cached.data
    throw err
  }
}
