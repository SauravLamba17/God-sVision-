// Sign-in redirect checks.   npm run test:redirect
//  1. safeCallbackUrl: same-origin paths kept with their query; anything that can
//     leave the site (other host, protocol-relative, backslash, whitespace, javascript:) → /dashboard.
//  2. If a local server is running: a signed-out deep link redirects to sign-in with
//     path + query in callbackUrl (and APIs still get 401, not a redirect).
import { safeCallbackUrl } from '../lib/safeRedirect.ts'

const ORIGIN = 'http://localhost:3001'
const BASE = process.env.BASE_URL ?? ORIGIN
let failed = 0, total = 0
const check = (ok: boolean, label: string) => { total++; if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`) }

const cases: [string | null, string][] = [
  ['/portfolio', '/portfolio'],
  ['/markets?ticker=TCS.NS&period=1y', '/markets?ticker=TCS.NS&period=1y'],
  ['/research?q=why%20is%20oil%20up#answer', '/research?q=why%20is%20oil%20up#answer'],
  [null, '/dashboard'],
  ['', '/dashboard'],
  ['https://evil.com/x', '/dashboard'],
  ['http://localhost:3001/portfolio', '/dashboard'],   // absolute URLs are never followed, even our own
  ['//evil.com', '/dashboard'],
  ['/\\evil.com', '/dashboard'],
  ['/\\/evil.com', '/dashboard'],
  ['/\t/evil.com', '/dashboard'],
  ['/\n/evil.com', '/dashboard'],
  ['javascript:alert(1)', '/dashboard'],
  ['JaVaScRiPt:alert(1)', '/dashboard'],
  ['data:text/html,hi', '/dashboard'],
  ['evil.com', '/dashboard'],
  ['/%2F%2Fevil.com', '/%2F%2Fevil.com'],               // encoded slashes stay a local path
]
for (const [raw, want] of cases) {
  const got = safeCallbackUrl(raw, ORIGIN)
  check(got === want, `${JSON.stringify(raw)} → ${got}${got === want ? '' : `  (want ${want})`}`)
}

let server = false
try { await fetch(BASE + '/auth/signin'); server = true } catch { console.log(`\n(no server at ${BASE} — middleware checks skipped)`) }
if (server) {
  // Same path and same decoded query (Next normalises a%20b to a+b before middleware; both mean "a b").
  const same = (a: string | null, b: string) => { if (!a) return false; const x = new URL(a, ORIGIN), y = new URL(b, ORIGIN); return x.pathname === y.pathname && JSON.stringify([...x.searchParams]) === JSON.stringify([...y.searchParams]) }
  const deep = '/markets?ticker=TCS.NS&note=a%20b'
  const r = await fetch(BASE + deep, { redirect: 'manual' })
  const loc = new URL(r.headers.get('location') ?? '', BASE)
  const cb = loc.searchParams.get('callbackUrl')
  check(r.status === 307 && loc.pathname === '/auth/signin', `signed-out ${deep} → ${r.status} ${loc.pathname}`)
  check(same(cb, deep), `callbackUrl keeps path + query: ${cb}`)
  check(same(safeCallbackUrl(cb, ORIGIN), deep), 'sign-in page would follow it')
  const rsc = await fetch(BASE + '/portfolio?x=1&_rsc=abc&y=a%20b', { redirect: 'manual', headers: { RSC: '1' } })
  const rscCb = new URL(rsc.headers.get('location') ?? '', BASE).searchParams.get('callbackUrl')
  check(same(rscCb, '/portfolio?x=1&y=a%20b') && !rscCb?.includes('_rsc'), `RSC marker dropped, rest kept: ${rscCb}`)
  const plain = await fetch(BASE + '/portfolio', { redirect: 'manual' })
  check(new URL(plain.headers.get('location') ?? '', BASE).searchParams.get('callbackUrl') === '/portfolio', 'no query → path only')
  const api = await fetch(BASE + '/api/portfolio?x=1', { redirect: 'manual' })
  check(api.status === 401, `API still 401 (got ${api.status})`)
}
console.log(`\n${total - failed}/${total} passed`)
process.exitCode = failed ? 1 : 0   // not process.exit(): it can abort mid-socket-close on Windows
