# Production Verification Report

**Target:** https://god-s-vision.vercel.app (LIVE production, not localhost)
**Date:** 2026-08-30 ~01:45–02:00 UTC
**Deployed commit:** `b3a11037` — built **2026-08-28T14:26Z** (~35.5 h before this audit)
**Method:** Two real accounts registered on the live site, real NextAuth credential sign-in,
session cookie jar, direct HTTP against production. No minted tokens, no auth bypass.

> **Timing caveat that affects several verdicts:** this audit ran on a **Sunday**. US and
> Indian equity markets were closed. Equity prices legitimately equal Friday's close, so for
> stock/index endpoints I could **not** distinguish "live" from "frozen at Friday" on price
> alone. Where liveness mattered I used 24/7 sources (crypto, earthquakes, forex) or embedded
> server timestamps instead. Verdicts below say which evidence was used.

---

## 1. Summary Table

### Phase 1 — Auth & Account

| Feature | Status | Note |
|---|---|---|
| Register new account (live) | **WORKING** | `POST /api/auth/register` → 200, user row created in Neon |
| Credential sign-in | **WORKING** | CSRF + callback → valid JWT session cookie |
| Session persists across requests | **WORKING** | `/api/auth/session` returns user on every subsequent call |
| Second independent account | **WORKING** | Registered + signed in cleanly |
| `/alerts` page + `/api/alerts` | **WORKING** | 200, `{priceAlerts:[],newsAlerts:[]}` — no connection error |
| `/portfolio` page + `/api/portfolio` GET | **WORKING** | 200, no Neon pool error |
| Neon connection health overall | **WORKING** | ~15 DB-backed calls, zero pool-exhaustion errors |

### Phase 2 — Dashboard & Market Data

| Feature | Status | Note |
|---|---|---|
| `/api/dashboard/overview` | **WORKING** | CDN HIT age 390s (normal), real index values |
| Hero sparklines | **DEGRADED** | Real data but only **5 points per curve** — a 5-point "sparkline" is a coarse zigzag, not a curve |
| Standalone `/api/sparkline` | **BROKEN** | `{"prices":[],"error":"no data available"}` for every ticker |
| AI Narratives panel | **BROKEN** | `generatedAt` = **2026-08-28T14:27:39Z — 35.5 h old**, frozen at build. Survives cache-busting |
| Nifty heatmap / India indices | **COULD NOT FULLY VERIFY** | Real INR values, but weekend — cannot prove liveness from price alone |
| FII/DII flows | **BROKEN (fabricated)** | Hardcoded constants in `lib/apis/india.ts:103`, `lastUpdated:'2026-06-27'` — 2 months stale, never fetched |
| Seismic activity | **WORKING** | Newest quake 2.6 h old, real USGS ids |
| World weather | **WORKING** | Real OpenWeather conditions, live sunrise/sunset epochs |
| ISS tracker | **BROKEN** | `lat:0, lng:0` (Null Island fallback), timestamp frozen at build; astronaut roster is the 2024 hardcoded fallback |
| India ↔ USA currency | **WORKING (data layer)** | India APIs return `currency:"INR"`, `₹/10g` units. Visual toggle not pixel-verified |

### Phase 3 — Markets, Crypto, Forex, Bonds, Backtest

| Feature | Status | Note |
|---|---|---|
| `/api/stocks?ticker=AAPL` | **WORKING** | Real quote, `source:"live"`, correct USD |
| `/api/technicals?ticker=AAPL` | **WORKING** | 64 candles + full RSI/MACD/BB/ATR series, real values |
| `/api/search` | **WORKING** | Real Yahoo symbol search |
| India `RELIANCE.NS` | **WORKING** | ₹1287, `currency:"INR"` present |
| `/api/crypto` | **WORKING** | BTC `last_updated` 2026-08-30T01:55:30Z — genuinely live |
| Crypto WebSocket flash animation | **COULD NOT TEST** | Requires a real browser session; REST layer confirmed live |
| `/api/forex` | **WORKING** | `time_last_updated` today, 160+ pairs |
| **`/api/bonds?type=yields`** | **BROKEN** | **Every maturity returns `yield:0, change:0`** — 3M/5Y/10Y/30Y all zero |
| **`/api/bonds?type=etfs`** | **BROKEN** | **All 8 ETFs return `price:0, volume:0`** |
| `/api/bonds?type=spread` | **DEGRADED (fabricated)** | Static estimates, `date:"N/A"` — FRED key missing so fallback fired |
| `/api/yield-curve` | **BROKEN (intermittent)** | Data is real, but a **cache-shape bug** breaks the page — see CRITICAL #3 |
| `/backtest` | **BROKEN** | Yahoo `Too Many Requests` → HTTP 500. Reproduced twice with different date ranges |

### Phase 4 — News, Insiders, Health

| Feature | Status | Note |
|---|---|---|
| `/api/news` | **BROKEN** | Newest article **2026-08-28T14:26Z = 35.4 h old**. CDN `age=127159`. Frozen at build |
| `/api/india/news` | **WORKING** | Real Economic Times articles |
| `/api/insiders` | **DEGRADED** | Honest-nulls fix confirmed. But `ticker` empty on **all 40 rows**, each filing duplicated (Reporting + Issuer), filer name lands in `company` |
| `/api/disease` + flag rendering | **WORKING** | `updated` 4 min old; `<img src={countryInfo.flag}>` at `app/disease/page.tsx:135`; flag URL returns 200 `image/png` |

### Phase 5 — Map & Live Feeds

| Feature | Status | Note |
|---|---|---|
| `/api/flights` (map layer + page) | **BROKEN** | `{"error":"timeout of 15000ms exceeded","aircraft":[],"counts":{total:0}}` — OpenSky dead |
| Earthquake layer | **WORKING** | Same live USGS feed as dashboard |
| `/api/webcams` (`/cameras`) | **WORKING** | Real Windy feeds, `status:"active"`, live preview URLs |
| `/api/ships` | **BROKEN** | `{"data":[],"count":0,"connected":false}` — empty, not connected |
| All page routes load | **WORKING** | 22/22 pages HTTP 200 with real titles + content (the "page could not be found" string in HTML is Next.js's inlined not-found boundary, **not** a real 404 — verified) |

### Phase 6 — AI

| Feature | Status | Note |
|---|---|---|
| `POST /api/ai/analyze` | **WORKING** | Real streaming Gemini prose, ticker-specific and coherent |
| `/api/analyst/stock` | **WORKING (with caveats)** | Real snapshot + real Gemini analysis. But `news:[]` empty and `fundamentals:null` |
| Analyst options chain | **DEGRADED (honest)** | Model-derived, **and the UI renders the warning** `⚠ Indicative model-derived chain — not live exchange data` (`StockDeepDive.tsx:227`). Correctly labelled |
| AI Narratives currency | **BROKEN** | 35.5 h stale (see Phase 2) |
| **`/api/cache-status` → Redis** | **BROKEN** | **`"redis":"not configured (using in-memory fallback only)"`** — Upstash env vars are NOT live in production |

### Phase 7 — Chat

| Feature | Status | Note |
|---|---|---|
| CHAT link removed from nav | **WORKING** | No `href="/chat"` in production nav markup |
| `/chat` shows Coming Soon | **WORKING** | 200, renders "coming soon. We're upgrading the infrastructure…" |

### Phase 8 — Secondary

| Feature | Status | Note |
|---|---|---|
| `/api/correlation` | **WORKING** | Full 10×10 matrix, plausible coefficients |
| `/api/calendar` | **WORKING** | Real events; note earliest rows are past-dated (2026-08-23) with blank `actual` |
| `/api/sports` | **WORKING** | Real EPL fixtures, 2026-08-29 timestamps |
| `/api/weather` | **WORKING** | Real multi-city conditions |
| `/api/screener` | **WORKING** | Real quotes |
| `/api/earnings` | **DEGRADED** | Only **1** upcoming event returned — suspiciously thin |
| `/api/heatmap` | **WORKING** | Real sector + constituent data |
| `/api/centralbanks` | **DEGRADED** | Newest speech dated **2026-07-21** — 5+ weeks old |
| `/api/macro` | **BROKEN (fabricated)** | Serving `MACRO_MOCK` — GDP dated **2024-10-01**, CPI **2024-12-01**. `FRED_API_KEY` missing/invalid |
| `/api/reddit` | **BROKEN (fabricated)** | Serving `MOCK_MENTIONS` while the route reports `source:"live"` |
| `/api/options` | **DEGRADED (honest)** | Empty chain but says so: "Yahoo Finance auth required" |
| `/api/financials` | **BROKEN** | HTTP 429 Yahoo rate limit, reproduced 3× |
| **Watchlist persistence** | **BROKEN** | **Write succeeds, read returns `[]`** — see CRITICAL #2 |
| Portfolio write | **DEGRADED** | No input validation — bad body leaks a raw Prisma stack trace to the client |
| Sheets `/api/public/gv` | **BROKEN** | Key auth works (401/400 correct), but data fetch → 500 Yahoo `Too Many Requests` |

### Phase 9 — Performance

| Feature | Status | Note |
|---|---|---|
| Vercel Fluid Active CPU trend | **COULD NOT TEST** | Vercel CLI not installed and no dashboard auth in this environment. Needs `npm i -g vercel` + `vercel login` |
| Usage vs free tier | **COULD NOT TEST** | Same reason |

---

## 2. CRITICAL — New findings not known from today's session

### CRITICAL #1 — Authenticated per-user API responses are cached in the shared CDN (cross-user data leak)

`next.config.js:65` applies a catch-all cache header to **every** API route:

```js
{ source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 's-maxage=60, stale-while-revalidate=120' }] }
```

Vercel's edge cache keys on **URL only** — it does not vary on the session cookie. So a
signed-in user's private response is stored at the edge and served to the next signed-in user
who requests the same path.

**Reproduced with two real accounts on production:**

```
User A → GET /api/watchlist?xleak=1034614888   X-Vercel-Cache: MISS
         {"data":[{"id":1,"userId":"cmtf5f9qs0000u0v43xg50yxa","ticker":"AAPL",...}]}

User B → GET /api/watchlist?xleak=1034614888   X-Vercel-Cache: HIT
         {"data":[{"id":1,"userId":"cmtf5f9qs0000u0v43xg50yxa","ticker":"AAPL",...}]}
```

**User B received User A's watchlist, including User A's `userId`.**

Anonymous requests are *not* affected — middleware 307s them to sign-in before the cache is
consulted. The leak is **between authenticated users**, which is the population that matters.

Exposed routes (all authenticated, all under the catch-all): `/api/watchlist`,
`/api/watchlists`, `/api/portfolio`, `/api/alerts`, `/api/transactions`.

> **Explicitly ruled out:** `/api/user/gv-key` returns `process.env.GV_SHEETS_API_KEY`, a
> **shared app-wide key by design** (`app/api/user/gv-key/route.ts`). Both users receiving the
> same key is correct behaviour, not a leak. I checked this before reporting it.

This is the highest-severity finding in the audit and is a genuine privacy bug, not just a
correctness one.

### CRITICAL #2 — Same cache bug silently breaks watchlist persistence

The exact test requested ("add a ticker, confirm it persists after refresh") **fails**:

```
POST /api/watchlist {"ticker":"AAPL"}  → 200 {"data":{"id":1,...}}   (DB write OK)
GET  /api/watchlist                    → {"data":[]}                  (X-Vercel-Cache: HIT, Age: 35)
GET  /api/watchlist?cb=<random>        → {"data":[{...AAPL...}]}      (MISS — data was there all along)
```

The row is in Neon. The user just never sees it, for up to 180 s. Same root cause as #1.

### CRITICAL #3 — Several API routes are statically prerendered and frozen at build time

Routes declaring `export async function GET()` with **no** request argument and no
`export const dynamic` were prerendered at build and are now served as **static assets that
never re-execute**. Their payload timestamps all cluster at the build moment:

| Route | Embedded timestamp | Age |
|---|---|---|
| `/api/iss` | 2026-08-28T14:27:38Z | 35.5 h |
| `/api/narratives` | 2026-08-28T14:27:39Z | 35.5 h |
| `/api/fear-radar` | 2026-08-28T14:27:35Z | 35.5 h |
| `/api/cache-status` | 2026-08-28T14:27:33Z | 35.5 h |
| `/api/news` | newest article 2026-08-28T14:26Z | 35.4 h |

Build time was 2026-08-28T14:26Z. The correlation is exact, and it **survives cache-busting
query strings**, which rules out ordinary CDN staleness.

**This means the news-recency fix from earlier today is not actually reaching users** — the
route never runs. `/api/iss` compounds it by falling back to `lat:0, lng:0`, so the tracker
plots the ISS off the coast of Africa.

23 routes match this structural pattern; 5 are confirmed frozen by timestamp evidence above.

### CRITICAL #4 — `/api/yield-curve` returns a double-nested payload on every cache hit

`app/api/yield-curve/route.ts` does:

```js
const cached = await getCache(cacheKey)
if (cached) return NextResponse.json({ data: cached, source: 'cache' })
```

but `getCache()` returns an envelope `{ data, stale }` (`lib/cache.ts:41`). So a cache hit emits:

```json
{"data":{"data":{"curve":[...]},"stale":false},"source":"cache"}
```

while `app/yield-curve/page.tsx:55` reads `json.data.curve` → **undefined**. The page works
only on a cold cache and breaks for the following 15 minutes (900 s TTL). Confirmed live —
production is currently serving the broken shape. The cache-miss branch is correct; only the
hit branch is wrong.

### CRITICAL #5 — Bonds page renders an all-zeros table

`/api/bonds?type=yields` and `?type=etfs` return `200 OK` with every numeric field `0`.
`app/api/bonds/route.ts` imports `yahoo-finance2` directly and catches per-symbol failures into
a zero-filled object, so the failure is completely silent — 200, well-formed JSON, no error
field. Meanwhile `/api/stocks` (which uses `lib/apis/yahoo`) works fine, so this is specific to
the bonds route's direct Yahoo usage, not a global Yahoo outage.

### CRITICAL #6 — Three data sources are serving fabricated data as if real

| Source | Evidence | Severity |
|---|---|---|
| `/api/macro` | `KEY_VALID` false → `MACRO_MOCK`; GDP dated **2024-10-01**, Fed Funds 5.33% | High — presented as current US macro |
| `/api/reddit` | `MOCK_MENTIONS`; post "NVDA calls printing — Jensen is a god", `created_utc: Date.now()/1000-3600` **manufactures a fresh-looking timestamp**, and the route wraps it in `source:"live"` | High |
| FII/DII flows | Hardcoded object, `lastUpdated:'2026-06-27'`, never fetched | High |

The Reddit case is the worst of the three: the mock actively disguises itself as live by
back-dating to "one hour ago" and being labelled `source: "live"`.

### CRITICAL #7 — Upstash Redis is not configured in production

`/api/cache-status` → `"redis":"not configured (using in-memory fallback only)"`.

The Upstash env vars from the caching work are **not applied to the production deployment**.
Every Fluid instance falls back to per-instance in-memory cache, which is exactly the cold-start
rate-limit problem that work was meant to solve. (Note: this endpoint is itself frozen per
CRITICAL #3, so the reading is from build time — but a build-time read of "not configured"
still means the vars were absent at build, and nothing since has proven otherwise.)

### CRITICAL #8 — Yahoo Finance rate limiting is persistent, not transient

`Too Many Requests` reproduced across three endpoints and multiple retries several minutes apart:
`/api/backtest` (500), `/api/financials` (429), `/api/public/gv` (500), `/api/sparkline` (empty).

The Google Sheets integration is user-facing and currently returns a **500 with a raw upstream
error string** to the spreadsheet.

### Lower severity, still new

- **Portfolio POST has no input validation** — a malformed body produces `NaN`/`Invalid Date`
  passed straight to Prisma, and the raw Prisma error (including the query shape) is returned
  to the client.
- **Insiders `ticker` field empty on all 40 rows** — `parseFormTitle` never matches, so no row
  can be attributed to a company, and each filing appears twice.
- **`/api/centralbanks`** newest speech is 5+ weeks old.
- **`/api/earnings`** returns a single event.

---

## 3. CONFIRMED FIXED — re-verification of today's six fixes

| # | Fix | Live status | Evidence |
|---|---|---|---|
| 1 | Neon connection leak | ✅ **CONFIRMED LIVE** | ~15 authenticated DB calls + 2 registrations + writes, zero pool errors |
| 2 | India currency symbols | ✅ **CONFIRMED LIVE** | `RELIANCE.NS` → `currency:"INR"`; india/commodities → `₹/10g`, `₹/kg`; india/crypto → `priceINR` |
| 3 | News recency filter | ❌ **NOT LIVE** | Code is correct, but `/api/news` is build-frozen (CRITICAL #3). Newest article is **35.4 h old** in production. The fix is committed but users are not receiving it |
| 4 | Insiders honesty (real filers, nulls) | ⚠️ **PARTIALLY LIVE** | Honest part confirmed — real SEC EDGAR ids, real 2026-08-28 dates, `shares/pricePerShare/totalValue` all `null`, **zero fabricated numbers**. But `ticker` is empty on every row and filings are duplicated |
| 5 | Disease flag rendering | ✅ **CONFIRMED LIVE** | `<img src={c.countryInfo.flag}>` at `app/disease/page.tsx:135`; API returns real URLs; `https://disease.sh/assets/img/flags/us.png` → 200 `image/png`. No raw URL text |
| 6 | Chat hidden on production | ✅ **CONFIRMED LIVE** | No `/chat` href in nav; `/chat` renders "Coming Soon"; no error |

**4 of 6 fully live, 1 partial, 1 not reaching users at all.**

Fix #3 is the important lesson: it was committed, it deployed, and it still does nothing,
because the route it lives in never executes in production. This is the same class of failure
as chat — "the code is correct" and "the feature works for users" were not the same thing.

---

## 4. Overall Assessment

Scored over **56 distinct checks**:

| Category | Count | Share |
|---|---|---|
| ✅ Confirmed genuinely working in production | 28 | **50%** |
| ⚠️ Degraded (loads, but stale / thin / mislabelled / partial) | 10 | **18%** |
| ❌ Confirmed broken or serving fabricated data | 14 | **25%** |
| ❓ Could not test (browser-only, weekend, or no Vercel auth) | 4 | **7%** |

**Roughly half the platform is verified genuinely working. A quarter is broken — and almost all
of that quarter fails *silently*, returning HTTP 200 with zeros, empty arrays, mock data, or
35-hour-old content.** Not one of the broken features surfaces an error to the user. That is
the same signature chat had.

**The findings collapse into five root causes, not fourteen independent bugs:**

1. **One line in `next.config.js`** (the `/api/:path*` catch-all) causes both the cross-user
   data leak and the watchlist persistence failure.
2. **Missing `export const dynamic = 'force-dynamic'`** freezes news, narratives, ISS,
   fear-radar and cache-status at build time — and silently nullified today's news fix.
3. **Missing/invalid environment variables** on the production deployment: `FRED_API_KEY`
   (macro + bond spreads → 2024 mock data) and the Upstash Redis vars (no distributed cache).
4. **Upstream providers failing without surfacing**: Yahoo rate limits (backtest, financials,
   Sheets, sparkline), OpenSky timeout (flights), open-notify down (ISS), Reddit blocked, ships
   never connected.
5. **Mock-data fallbacks that impersonate live data** — the Reddit mock is the clearest case,
   manufacturing a "1 hour ago" timestamp and shipping under `source: "live"`.

**Suggested priority when we decide fixes:** CRITICAL #1 first — it is a live cross-user privacy
leak and the fix is a scoped cache header. Then #3 (one export line restores news + narratives +
ISS). Then #7/#6 (env vars restore macro and caching). Then the honest-labelling work on mock
fallbacks.

---

## Test artifacts left on production

I created real data during this audit and did **not** remove it (no fixes/changes this pass):

- Account A: `verify.prod.1788054402@example.com` (id `cmtf5f9qs0000u0v43xg50yxa`) — has one watchlist row, `AAPL`
- Account B: `verify.prod.b.1788054949@example.com` (id `cmtf5qzbn0000rfcuuvr1boek`)

Say the word and I'll delete both users and the watchlist row.

## Not verified — needs a real browser or Vercel access

- Vercel Fluid Active CPU trend and free-tier usage % (Phase 9) — Vercel CLI not installed
- Crypto WebSocket flash animation (REST layer confirmed live)
- Visual rendering: chart paint, currency glyphs on hero cards, flag images on screen
  (all verified at data + component-code level, not pixel level)
- Weekend limitation: equity/index liveness could not be separated from Friday's close
