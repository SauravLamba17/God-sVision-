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
  '&$select=Title,PublicationDateAndTime,ItemDefaultUrl,Summary' +
  // EmergencyEvent.EventId is WHO's own identifier for the underlying outbreak,
  // shared across every DON posting about it — the key the dedupe below groups
  // on. The nested $select keeps the expansion to that one field instead of
  // pulling a full event object per row (~20KB saved on a 50-row fetch).
  '&$expand=EmergencyEvent($select=EventId)'

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

/**
 * Every identifier a DON posting can be grouped by. A posting is a duplicate if
 * it matches an already-kept posting on ANY of these:
 *
 *  - EventId — WHO's own id for the underlying outbreak, shared across all its
 *    postings. Catches the same event published under drifting titles ("… -
 *    Democratic Republic of the Congo" vs "… , Democratic Republic of the Congo
 *    & Uganda"), which title matching alone would miss.
 *  - the normalized full title — catches the reverse: WHO leaves EventId null on
 *    a minority of postings, so two postings about one outbreak can carry an id
 *    and no id respectively and never compare on that field.
 *
 * Normalizing the WHOLE title rather than just the disease prefix keeps genuinely
 * separate outbreaks of one disease apart — "Measles - Bangladesh" and
 * "Measles - India" stay two rows.
 */
function eventKeys(title: string, eventId: unknown): string[] {
  const keys = [title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()]
  if (typeof eventId === 'string' && eventId) keys.push(`id:${eventId}`)
  return keys
}

export async function fetchOutbreaks(limit = 10): Promise<Outbreak[]> {
  // Version the key on every change to the dedupe: an entry written by the
  // previous logic would otherwise keep serving its result for up to an hour.
  const cacheKey = `who_outbreaks_v3_${limit}`
  const cached = await getCache<Outbreak[]>(cacheKey)
  if (cached && !cached.stale) return cached.data

  try {
    // A single active outbreak gets a DON posting every couple of weeks, so the
    // newest `limit` rows can easily be one event repeated. Over-fetch, then
    // dedupe down to `limit` distinct events. 50 rows yields 20+ distinct
    // events at the time of writing, against 5 in the newest 20.
    const res = await fetch(`${DON_API}&$top=${Math.min(limit * 5, 60)}`, {
      headers: { 'User-Agent': 'GodVision/1.0 (operations@myhealthiq.io)', Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`WHO DON responded ${res.status}`)

    const json = await res.json()
    const rows: any[] = Array.isArray(json?.value) ? json.value : []

    // Rows arrive newest-first, so the first row seen for an event is its most
    // recent posting — keep that one and drop the superseded updates behind it.
    const seen = new Set<string>()
    const outbreaks: Outbreak[] = []
    for (const r of rows) {
      const title = String(r?.Title ?? '').trim()
      if (!title) continue
      const keys = eventKeys(title, r?.EmergencyEvent?.EventId)
      if (keys.some(k => seen.has(k))) continue
      for (const k of keys) seen.add(k)
      outbreaks.push({
        title,
        // ItemDefaultUrl arrives as a leading-slash slug, e.g. "/2026-DON617".
        link: r?.ItemDefaultUrl ? `${DON_ITEM_BASE}${r.ItemDefaultUrl}` : DON_ITEM_BASE,
        date: String(r?.PublicationDateAndTime ?? ''),
        summary: stripHtml(String(r?.Summary ?? '')),
      })
      if (outbreaks.length >= limit) break
    }

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
