/**
 * Where to send the user after sign-in: the same-origin path (+ query + hash) from
 * ?callbackUrl, else the fallback. Parsed with URL rather than string checks, so
 * "//evil.com", "/\evil.com" (browsers read "\" as "/"), tab/newline tricks and
 * "javascript:" all resolve to another origin or scheme and are rejected.
 */
export function safeCallbackUrl(raw: string | null | undefined, origin: string, fallback = '/dashboard'): string {
  if (!raw || !raw.startsWith('/')) return fallback
  try {
    const u = new URL(raw, origin)
    return u.origin === origin ? u.pathname + u.search + u.hash : fallback
  } catch {
    return fallback
  }
}
