// Several panels poll the same GET routes (the dashboard, CryptoPanel and the status
// bar all ask for /api/crypto?type=top100). sharedFetch lets callers asking for the
// same URL within `maxAgeMs` share one request; each gets its own clone of the
// Response, so it is a drop-in for fetch(url). Polling intervals are unchanged, and
// 30 s matches the routes' CDN s-maxage, so nobody sees data older than before.
// ponytail: one module-level map per tab; a network error drops the entry so the next caller retries.
const recent = new Map<string, { at: number; res: Promise<Response> }>()

export function sharedFetch(url: string, maxAgeMs = 30_000): Promise<Response> {
  const hit = recent.get(url)
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.res.then(r => r.clone())
  const res = fetch(url)
  recent.set(url, { at: Date.now(), res })
  res.catch(() => { if (recent.get(url)?.res === res) recent.delete(url) })
  return res.then(r => r.clone())
}
