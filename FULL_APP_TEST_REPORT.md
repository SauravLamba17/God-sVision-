# GOD's Vision — Full App E2E Test Report

**Date:** 2026-10-04 · **Env:** local dev (`next dev -p 3001`) against the real Neon DB · **Browser:** built-in browser pane at 1280 / 1440 / 1920 px
**Not committed / not pushed.** `C:\Users\Saurav\healthiq` not touched.

**Final status:** `npx tsc --noEmit` ✅ PASS · `npm run build` ✅ PASS (baseline before changes was also clean)
**Test account:** `gv-e2e-throwaway-20261004@example.com` — created, used, **deleted** (see §6).

---

## 0. Headline findings

1. **🔴 NEEDS APPROVAL — 20 API routes are frozen at build time in production** (static prerender + Next.js Data Cache with 1-year TTL). ISS, India crypto prices, USD/INR, Fed/BOE speeches, AI narratives, India indices, Nifty movers, news, fear radar, heatmap, correlation… all serve whatever existed at build/first-fetch. Proven locally (details §3, NA-1).
2. **Fabricated data found and removed:** random-number FX "CHG%" (`Math.random()`), invented bid/ask/spread, AI brief inventing index levels ("S&P holding 4,500" with SPY at $769), AI narratives generated from 5 hardcoded headlines, 2024 central-bank rates / macro mocks / economic calendar labelled LIVE, July-2026 hand-curated earnings with invented EPS, hardcoded hero-card and ticker-tape prices, fake breadth counts, fabricated 68°F, 83.5 USD/INR fallback (~15% off).
3. **Broken features fixed:** Sign Out did nothing (menu closed before click); backtest 500; Sheets API 500; `/yield-curve` white-screened every 2nd load; `/api/search` broken on cache hits; alert delete button covered by the watchlist handle; Fed/ECB/BoC speech feeds dropped; nav controls unreachable at 1280–1440 px.
4. **Wrong numbers fixed:** "daily" change was actually a 5-day change (Dow −1.26% vs real +0.49%) on the Global Market Monitor, Commodities page and all India indices/stocks; Sharpe 6.53 → 0.69; correlation BTC↔SPY ≈0 (date misalignment) → 0.36; grain futures cents shown as dollars; NYC sunrise "04:24 PM"; R:R "1:-4071".

---

## 1. Summary table

Legend: **WORKING** · **FIXED** · **NEEDS APPROVAL** · **BROKEN-EXTERNAL** · **UNAVAILABLE-HONEST**

### Public & auth
| Item | Status | Notes |
|---|---|---|
| `/` landing — loads, wheel scroll, globe canvases, reveals, button contrast, no console errors | WORKING | Marketing tape/cards are illustrative under a "Live" badge → NA-7 |
| Sign in / Get started links | WORKING | `/auth/signin`, `?tab=register` |
| `/dashboard` logged out → sign-in redirect | WORKING | 307 with callbackUrl |
| `/auth/forgot-password`, `/auth/reset-password` public | WORKING | |
| `/api/public/ticker` no auth | WORKING | static at build → NA-1 |
| `/api/public/gv`, `/gv-history` | FIXED | were 500 (Yahoo query2 429); own-key auth works; key exposure → NA-4 |
| Register → auto-login → /dashboard | WORKING | |
| Sign out | FIXED | was silently broken for all users (F-1) |
| Sign in again (+ callbackUrl honoured) | WORKING | landed on /portfolio |
| `/` while logged in → /dashboard | WORKING | |
| Forgot → reset → old pw rejected → new pw works → token reuse rejected | WORKING | |
| Forgot-password rate limit (3/h) | WORKING | 4th → 429 `Retry-After`; but enumeration oracle → NA-3 |
| Sign-in "← Back to Terminal" | FIXED | looped back to sign-in when logged out (F-30) |

### Pages (USA + India where mode-aware — only the dashboard and a few panels are India-aware)
| Page | Status | Notes |
|---|---|---|
| Dashboard (USA) | FIXED | brief, 5-day-as-daily change, hero defaults, breadth, DXY "$", failed rows as 0, ticker tape fallback |
| Dashboard (India) | FIXED | NSE 0.00% (holiday bar), ₹ on index points, MPC "-123d", 83.5 FX, "MCX" label, SHIB ₹0.00, R:R, USA brief in India mode. India crypto INR prices still frozen → NA-1 |
| Markets | WORKING | fundamentals N/A for ETFs is correct |
| Crypto | WORKING | |
| Forex | FIXED | random CHG%, invented bid/ask, static CB rates, carry calc |
| Macro | FIXED | 2024 mocks labelled LIVE, CPI index-as-YoY, units, static calendar, fake 20% recession prob — now real FRED data |
| Calendar | WORKING | feed has no "actual" values (upstream) |
| News | WORKING | |
| Map | WORKING / UNAVAILABLE-HONEST | weather layer honestly "(unavailable)" |
| Cameras | WORKING | 26/26 images load |
| Flights | WORKING | OpenSky occasionally >3 s |
| Weather | FIXED | sunrise TZ, forecast day off-by-one, open-meteo visibility |
| Sports | WORKING | all 4 tabs |
| Commodities | FIXED | 5-day-as-daily, grains in cents |
| Bonds | FIXED | credit spreads were "unavailable" (placeholder key) → keyless FRED; all 4 tabs work |
| Backtest | FIXED | 500 → works; Sharpe fixed; SMA/RSI/Buy&Hold all run |
| Sheets | WORKING | shows global API key to every user → NA-4 |
| Portfolio | WORKING | add / P&L / delete; **no edit feature exists** (UI or API) |
| Alerts | FIXED | delete ✕ was unclickable (overlap); "30 s" label was 60 s |
| Screener | WORKING | MKT CAP/P/E "N/A"/"—" — upstream lacks fields |
| Options | BROKEN-EXTERNAL | Yahoo crumb + 429; Greeks honestly labelled |
| Heatmap | WORKING | |
| Earnings | FIXED | hand-curated July list with invented EPS → Nasdaq live calendar |
| Insiders | FIXED | company/insider columns were wrong; tx details UNAVAILABLE-HONEST (Atom feed has none) |
| Correlation | FIXED | crypto/equity date misalignment |
| Health (`/disease`) | WORKING / UNAVAILABLE-HONEST | daily counts greyed with explanation |
| Banks (`/centralbanks`) | FIXED | 2023 rate cards → FRED (Fed, ECB); feed parser fixes. FED/BOE speeches still July → NA-1 |
| Financials | BROKEN-EXTERNAL | Yahoo quoteSummary 429; envelope bug fixed |
| Yield Curve | FIXED | white-screen crash on cached loads |
| Glossary, Pricing, God Mode | WORKING | pricing copy inconsistent → NA-8 |
| Nav at 1280 / 1440 / 1920 | FIXED | THEME/LEARN/SPLIT/GOD were off-screen at ≤1440 |
| No page-level horizontal overflow at 1280/1440/1920 | WORKING | |

### User-data & interactions
| Feature | Status |
|---|---|
| Watchlist add → reload persists → remove → persists | WORKING (+ mojibake "Ã—" fixed) |
| Portfolio holding add → P&L (10×($333.69−$300)=+$336.90 ✓) → delete | WORKING (edit not implemented) |
| Price alert create → appears → delete | FIXED (overlap) |
| Transaction create → appears → delete | WORKING |
| Backtest end-to-end | FIXED |
| Theme switcher (persists `gv_theme`) | WORKING (+ mojibake icon fixed) |
| India/USA toggle | WORKING |
| Ctrl+K palette — type, ↑/↓, Enter navigates | WORKING (first keystrokes typed <~1 s after Ctrl+K are lost — minor) |
| Split view / linked panels | WORKING |

---

## 2. Bugs fixed (what · root cause · fix · re-test evidence)

| # | Bug | Root cause | Fix | Re-test |
|---|---|---|---|---|
| F-1 | **Sign Out did nothing** | UserMenu closes on `mousedown` outside the trigger button; the menu is portalled, so mousedown on SIGN OUT unmounted it before `click` | exempt the portal (`menuRef`) | session `{}` after click, landed on `/` |
| F-2 | AI brief invented levels ("S&P 4,500", SPY $769); India mode got USA brief | prompt had no data + "be specific with levels"; component never sent `mode` | ground prompt in live quotes (`getQuotes`), no quotes → no brief; pass `mode` | both modes quoted real levels (S&P 7722.72, Nifty 22421.95) |
| F-3 | "Daily" change was 5-day change (Dow −1.26% vs +0.49%), then 0.00% for all NSE | `chartPreviousClose` on `range=5d` is the close before the window; Oct 2 Indian holiday bar has null close | `priorSessionClose()` in `lib/apis/yahoo.ts` (date-based walk) used by overview, commodities, India | Dow +0.49%, Nifty −0.88%, INFY +4.11% |
| F-4 | Forex CHG% was **`Math.random()`**; bid/ask/spread invented | fabricated in page | real 1-D change from Yahoo FX quotes; show mid only | EUR/USD +0.11%, USD/JPY −0.14% |
| F-5 | AI narratives analysed 5 hardcoded headlines | server self-fetch of `/api/news` redirected by middleware → HTML → fallback headlines (+ hardcoded narratives w/o key) | read news cache / RSS directly; honest empty state | real narratives from live headlines |
| F-6 | Central-bank rates 2023/24 (Fed 5.33% vs real 4.00%, BOJ −0.10%) on Forex, Macro, Banks + carry calc | static arrays | `getPolicyRates()` from FRED (Fed `DFEDTARU`, ECB `ECBDFR`; others omitted — OECD series ended 2023, never shown stale) | Fed 4.00%, ECB 2.50% |
| F-7 | Macro page: 2024 mocks labelled LIVE; CPI would show ~310% with a key; units wrong ($0.0B, 1K, 0.00T, −0.18bps) | mock fallback when key is placeholder; index level used as YoY; unit math | keyless FRED CSV fallback; YoY calc; unit formatting for value and change | CPI 3.35%, Retail $737.8B, Fed BS $6.74T, spread 45bps |
| F-8 | Macro static 2024 economic calendar; recession prob defaulted to 20% | hardcoded | live `/api/calendar` (USD high-impact); `—` when no spread | |
| F-9 | `/yield-curve` white screen on every cached load; `/api/search` & `/api/financials` broken on cache hits | returned cache envelope `{data, stale}` as data | return `cached.data` + added `app/error.tsx` boundary | reloaded twice OK; search identical on 2nd call |
| F-10 | Backtest 500 | yahoo-finance2 `chart()` → query2 429 | `getChartRange()` query1-first (also behind `getChartData`) | all 3 strategies 200 |
| F-11 | Sharpe 6.53 for a 66%/6-yr run | per-trade returns annualised with √252 | daily equity returns | 0.69 / 0.47 / 0.74 |
| F-12 | `/api/public/gv` & `gv-history` 500 | query2 429 | query1 via `getQuotes` / `getChartRange` | AAPL 333.69; history rows |
| F-13 | Earnings: July-2026 curated dates + invented EPS/revenue | static list | Nasdaq public earnings calendar (≥$10B mkt cap, 14 days) | JPM, ASML, TSM… real dates/EPS |
| F-14 | Correlation crypto↔equity ≈0 | returns paired by array index (7-day vs 5-day weeks) | align closes on shared dates | BTC↔SPY 0.36 |
| F-15 | Insiders: people in COMPANY, "Issuer"/"Reporting" in INSIDER | EDGAR lists each Form 4 twice | pair by accession number | "Natera, Inc. — Chapman Steven Leonard" |
| F-16 | CB speeches: Fed dropped, BoC missing/future holidays, ECB 404 | CDATA pubDate → Invalid Date throw; `<item rdf:about>` regex; dead URL | strip CDATA, skip undated/future, new ECB/BoC feeds | FED/ECB/BOE/BOC all present |
| F-17 | Hero cards started at 2024 prices (SPY 543, NIFTY 24000, USD/INR 83.50) with arrows; ₹ on index points, $ on DXY | hardcoded defaults & `?? 24000` fallbacks | null → "—"/"awaiting quote"; currency only on priced instruments; separators | "NIFTY 50 22,421.95", "USD INDEX 101.92" |
| F-18 | 83.5 USD/INR fallback (India forex/commodities/macro, StatusBar, toggle) | hardcoded | `getUsdInr()` (exchangerate-api → Yahoo `INR=X`) or null/unavailable | ₹96.30 |
| F-19 | "GOLD MCX" etc. on COMEX × FX | mislabel (MCX includes duty) | label "GOLD ₹" | |
| F-20 | Breadth "405 ADV 0 DEC" | 11 sector ETFs × 45 shown as stock counts | count sectors ("9 / 0 / 2 of 11 SPDR ETFs") | |
| F-21 | Failed quotes rendered "0 +0.00% DELAYED" | failures returned as zero rows | drop failures | |
| F-22 | Terminal ticker tape showed 2024 prices until/if fetch | `FALLBACK_TICKERS` | empty until live | |
| F-23 | Weather NYC sunrise "04:24 PM"; forecast weekday off-by-one west of UTC; open-meteo visibility hardcoded 10 | browser TZ; `new Date('YYYY-MM-DD')` UTC; constant | city `tzOffset`; `timeZone:'UTC'`; Open-Meteo `timezone:auto` + real visibility | |
| F-24 | Grains "$497.75/bu" | Yahoo quotes ZC/ZW/ZS in cents (`USX`) | scale 0.01 | Corn ≈ $4.98 |
| F-25 | Analyst R:R "1:-4071" on SELL picks | signed reward/risk | magnitudes | 1:1.0 |
| F-26 | RBI tracker "-123d away" (and my interim regression → "unavailable") | static schedule ran out | `nextMPC: null` → "Schedule not available"; guard fixed | renders |
| F-27 | "● LIVE" above "DATA UNAVAILABLE" | PanelWrapper badge used client fetch time only | no badge on error/static/empty; "STALE" for stale | |
| F-28 | StatusBar "REFRESH 15s" countdown refreshed nothing | cosmetic timer | show time of last real check | "CHECKED 08:14" |
| F-29 | Alert delete ✕ unclickable | fixed ★ watchlist handle (22×56px) over right edge | `main` right offset 22px | elementFromPoint = button; alert deleted |
| F-30 | Nav THEME/LEARN/SPLIT/GOD off-screen at 1280 (and SPLIT/GOD at 1440) | row overflowed hidden-scrollbar container | hide F-key hints <1600px, tighter padding | max right 1268 @1280 |
| F-31 | Watchlist/portfolio/alerts: no session fell through to shared `userId:null` rows | `?? null` | 401 (same pattern as transactions) | |
| F-32 | Fear Radar "2Y-10Y Spread +1.28%" (FRED: +0.45%) | value is ^TNX−^IRX | relabel "10Y-3M Spread" | |
| F-33 | Mojibake "Ã—", "âˆž", "â¬›" | CP1252 leftovers | ×, ∞, ⬛ (full-repo scan now clean) | |
| F-34 | "LINKED PANELS → AAPL" toast on every load incl. sign-in | fired on initial default | only on real changes | |
| F-35 | Split-view weather showed 68°F when missing; SHIB ₹0.00; alerts "every 30 s" (is 60 s) | fallbacks/precision/label | "—", toPrecision, 60 s | |

---

## 3. NEEDS APPROVAL (ranked, security first)

**NA-1 — 🔴 Production serves frozen data (static API routes + 1-year Data Cache).** *Severity: critical data integrity.*
These GET routes have no request dependency and no `dynamic`/`revalidate`, so `next build` prerenders them (○): `cache-status, centralbanks, correlation, dashboard/overview, fear-radar, heatmap, india/{commodities,crypto,fii-dii,forex,indices,macro,news,stocks,stocks/movers}, iss, narratives, news, public/ticker, ships`. Evidence: `next start` → `x-nextjs-cache: HIT`; `.next/cache/fetch-cache` holds upstream responses with `revalidate: 31536000` dated **18 Jul 2026** (ISS, astronauts, Fear&Greed, CoinGecko INR, exchangerate-api, India RSS, Fed/BoE/BoC feeds, NSE FII/DII, and a cached **Gemini** call). Visible now: India BTC ₹61.78 L (live ≈ ₹81.7 L), FED/BOE speeches stuck in July. Every build also calls Gemini while prerendering `/api/narratives`.
*Proposed fix:* add `export const dynamic = 'force-dynamic'` to each of the 20 route files (their own `lib/cache` TTLs already govern freshness; fetches then default to no-store). After deploy, **purge the Vercel Data Cache** (Project → Settings → Data Cache) since it persists across deployments.

**NA-2 — Middleware.** Unauthenticated API calls get a 307 to the HTML sign-in page instead of `401` JSON (this is what broke narratives' self-fetch); `callbackUrl` drops the query string. *Fix:* for `/api/*` return `NextResponse.json({error:'Sign in required'},{status:401})`; use `pathname + search` for callbackUrl.

**NA-3 — Password-reset account enumeration.** Registered emails return 429 after 3 requests; unregistered emails always 200 (verified). Reset tokens are stored in plaintext (`PasswordResetToken.token`). *Fix:* rate-limit by email regardless of existence (count attempts in a separate table/Redis) and store `sha256(token)` (schema change).

**NA-4 — Sheets API key is a global shared secret.** `/sheets` shows `GV_SHEETS_API_KEY` to every registered user (open registration ⇒ effectively public); code falls back to `'godsvision-demo-key'` if the env var is unset. *Fix:* per-user keys (schema) and remove the fallback.

**NA-5 — Gemini quota.** Free tier is 20 requests/day; it was exhausted during testing (my test runs consumed some). If the local key is the production key, AI brief/narratives/analyst-AI are unavailable until reset (~21 h). *Fix:* paid tier or a different key (env var).

**NA-6 — Insider transaction details.** Atom feed carries no shares/price/type. Needs per-filing Form 4 XML parsing (new feature) — currently honest "—".

**NA-7 — Landing page marketing data.** "● Live · equities, crypto & FX streaming" sits above a tape where 12/15 rows and the AAPL "Healthy · real-time" card are illustrative constants. Product decision: label "illustrative", or show live-only rows.

**NA-8 — Pricing inconsistency.** Landing: "$0 per seat"; `/pricing`: "free during launch, paid plans coming soon"; sign-in page: "PRO — $29/mo", "Watchlist (10)", "Basic Alerts (2)" (limits not enforced). Also `/pricing` is behind login.

**NA-9 — Feature gaps (not built, by rule):** portfolio holding edit (no UI/API); the India mode only affects the dashboard and a few panels.

---

## 4. BROKEN-EXTERNAL

| Item | Cause | Needed |
|---|---|---|
| Options chain | Yahoo `v7/options` needs crumb; yahoo-finance2 path 429s | paid options data source, or retry/backoff with a warmed crumb |
| Financial statements | Yahoo quoteSummary 429 | same |
| AI brief / narratives / analyst AI | Gemini free tier 20/day exhausted | billing / higher quota |
| ISS astronauts | open-notify `astros.json` is a stale upstream (+ NA-1 freeze) | different crew source |
| Economic calendar "ACTUAL" column | ForexFactory feed has no actuals | different feed |
| Insider tx details | not in EDGAR Atom | Form 4 XML parsing |
| `FRED_API_KEY` | placeholder locally; now not required (keyless CSV) | optional real key for API rate limits |

---

## 5. Files modified (59 + 2 new)

New: `app/error.tsx`, `lib/hooks/usePolicyRates.ts`
API: `app/api/{ai/brief, alerts, backtest, bonds, centralbanks, commodities, dashboard/overview, earnings, financials, forex, india/commodities, india/forex, india/macro, portfolio, public/gv, public/gv-history, search, watchlist, yield-curve}/route.ts`
Pages: `app/{alerts, auth/signin, bonds, centralbanks, dashboard, forex, macro, portfolio, weather}/page.tsx`, `app/globals.css`
Components: `components/charts/YieldCurve.tsx`, `components/modules/WeatherModule.tsx`, `components/panels/{AnalystPanel, MacroPanel, MarketOverviewStrip, NarrativeDetector, PanelWrapper, RBIPolicyTracker}.tsx`, `components/terminal/{ClientLayout, DailyBrief, ModeToggle, NavBar, StatusBar, ThemeSwitcher, TickerBroadcast, TickerTape, UserMenu, WatchlistSidebar}.tsx`
Lib: `lib/apis/{centralBanks, correlation, fearRadar, forex, fred, india, insiders, narratives, openweather, yahoo}.ts`, `lib/context/ModeContext.tsx`
Artifact: `tsconfig.tsbuildinfo`

**Not touched:** `middleware.ts`, `lib/auth.ts`, `prisma/schema.prisma`, migrations, `next.config.js`, Stripe code, env vars, route static/dynamic classification (build still lists the same 20 static routes — left for NA-1).

---

## 6. Test accounts / data cleanup

- Created: 1 user `gv-e2e-throwaway-20261004@example.com` (password stored only in a scratch file, since deleted).
- Watchlist item, portfolio holding, transaction, price alert: created and deleted through the UI.
- Deleted from Neon by script (scoped to that email): **1 user, 3 password-reset tokens**. Post-check: users 0, accounts 0, sessions 0, watchlist 0, holdings 0, alerts 0, transactions 0, push 0, reset tokens 0 ✅
- 3 reset emails were attempted to the `example.com` address (non-deliverable reserved domain).

---

## 7. Final build status

| Check | Baseline | Checkpoint 1 | Checkpoint 2 | Final |
|---|---|---|---|---|
| `npx tsc --noEmit` | ✅ | ✅ | ✅ | ✅ |
| `npm run build` | ✅ | ✅ | ✅ | ✅ |

---

## 8. Other observations (low severity, not changed)

- Dev showed paired identical polls per 60 s cycle (e.g. 2× `/api/stocks?type=movers`) despite single instances with cleanup — likely dev StrictMode/HMR; verify on a production build.
- StatusBar health check downloads full payloads (incl. up to 3,000 flights) on every full page load just to colour a dot.
- `/api/watchlist` takes 1.5–3 s locally (session + Neon round-trip from India); likely faster on Vercel.
- One-click deletes with no confirmation (holdings, transactions, alerts).
- India/USA toggle shortcut `Ctrl+Shift+I` collides with browser DevTools (landing advertises ⌘J).
- Theme options are `div`s (not keyboard-focusable); some top-nav links have no accessible name.
- Watchlist sidebar sums prices/changes of unrelated tickers ("TOTAL PRICES").
- Open watchlist drawer overlays the right 220 px of content (drawer by design).
- Sports panels show "● LIVE" on finished matches (badge reflects fetch time).
