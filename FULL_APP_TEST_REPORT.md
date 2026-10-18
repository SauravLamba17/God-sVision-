# GOD's Vision — Full App E2E Test Report (October 2026)

**Dates:** 2026-10-17 → 2026-10-18 · **Build under test:** production build (`next build` + `next start`, port 3001) against the **production Neon database** · **Browser:** built-in browser pane, same-origin iframe sweeps + hand-driven interactions
**AI:** local server ran with `GEMINI_API_KEY=""` and `AI_PROVIDER` unset (launch config "God's Vision (prod, no AI)") — zero real AI calls. **Email:** forgot-password sent once, to the throwaway account. **Push:** none sent.
**Test accounts:** one throwaway (`gv-evidence-test-…@example.com`) + the isolation suite's own pair (created and deleted by the suite). Both deleted at the end — **15 users**, no orphaned rows (§12).
**Earlier pass:** the 2026-10-04 report (35 fixes) is in git history (`a5cb2580`).

---

## 1. Summary

| | |
|---|---|
| Phases | 0 inventory · 1 static health · 2 suites · 3 API sweep · 4 security & isolation · 5 UI (both modes) · 6 data accuracy · 7 performance · 8 fix loop · 9 final verification |
| Bugs found & fixed | **24 fix groups (F1–F24)** — 2 × P0/P1 "wrong number shown as fact" in user-facing figures (Sheets `open`, portfolio risk/P&L), support/resistance mislabelled, 5 forms that silently dropped server errors, raw DB errors returned by user routes, a password-reset race, light-theme unreadable text, India mode showing US/stale data |
| Suites | all green before and after: isolation 56 → **62** (6 new checks), graph 31, sentiment 6, evidence 59, brain 38, scenario 50, research 96 |
| UI | 420 signed-in loads (35 pages × 6 viewports × 2 modes) + 40 public loads (5 pages × 8 viewports incl. 768 and 390) + final regression sweep (§7) |
| Dependencies | `next` 14.2.5 → **14.2.35**, `next-auth` 4.24.15, `axios` 1.20.0, in-range transitive fixes; prod advisories 19 → 9 (critical 2 → 1, needs a major) |
| Needs your decision | §11 — buy/sell picks & targets in the Analyst panel (wording rule), security headers (high-risk file), Next 16 / Tailwind 4 majors |

## 2. Inventory coverage

| Area | Count | Covered by |
|---|---|---|
| Pages | 35 signed-in + 5 public (`/`, sign-in, register tab, forgot, reset) | UI matrix (§7), interactions (§7.3) |
| API routes | 71 | API sweep 211 checks (§5), suites, UI network checks |
| Engines | Evidence/Why, Market Brain, Entity Graph, Scenario, Research Agent, sentiment, alerts, backtest, portfolio analytics, Sheets key, feed health, rate limits | suites + targeted checks |
| User actions | mode toggle (button + Ctrl+Shift+I), theme ×4, beginner mode, sound, user menu sign-out, command palette, search, F1–F12, G/Esc God mode, Ctrl+Shift+S split, W watchlist, deep dive, all forms (auth ×4, portfolio, trades, alerts ×2, watchlist, backtest, scenarios, research, Sheets key) | §7.3 — every one exercised |
| External feeds | ~45 sources (Yahoo, RSS, USGS, CoinGecko, open-meteo, NSE, FRED, …) | API sweep "dead upstream → honest state" |

## 3. Static health

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors (before and after) |
| Lint | 16 errors, all style (10 `react/no-unescaped-entities`, 6 disable-comments naming an unloaded rule) — no bugs; not changed |
| Build | OK; largest first-load JS `/weather` 238 kB → **233 kB** after upgrades; shared 88.5 kB |
| npm audit (prod) | before: 2 critical, 11 high, 6 moderate · after: **1 critical, 6 high, 2 moderate** — remaining need Next 16 or Tailwind 4 (majors, §11) |
| Secret scan | no keys/tokens/connection strings in tracked or untracked files; `.env*` git-ignored |
| Unimported files (report only) | `components/panels/MarketPanel.tsx`, `components/terminal/AlertBanner.tsx`, `components/ui/ProGate.tsx`, `components/weather/TempToggle.tsx`, `lib/alertChecker.ts`, `lib/flights.check.ts`, `lib/planGate.ts` |
| Server-only code in client bundles | none |

## 4. Suite results

| Suite | Before (Phase 2) | After (Phase 9, upgraded deps) |
|---|---|---|
| isolation | 56/56 | **62/62** (+ mass-assignment ×4 routes, Sheets key hashed/not re-shown/regenerate revokes, sign-out → 401, deleted user's cookie → 401) |
| graph | 31/31 | 31/31 |
| sentiment | 6/6 | 6/6 |
| evidence | 59/59 | 59/59 |
| brain | 38/38 | 38/38 |
| scenario | 50/50 | 50/50 |
| research (`--live --api`) | 96/96 | 96/96 |

## 5. API sweep (temporary script, deleted)

| Category | Checks | Result |
|---|---|---|
| Signed-out access to every gated route | all gated routes | 401 JSON, `private, no-store` on user routes |
| Valid inputs | per route | 200, sane shapes |
| Invalid inputs (XSS, SQL, emoji, 10 kB strings, bad enums, negative/huge numbers) | 49 | 400 with a clear message — after F3/F6 |
| Dead or rate-limited upstream | per feed | honest "unavailable"/429 state, never a 500 or a fabricated value — after F2/F4/F8/F10 |
| Warm latency > 2 s | all | none |
| Rate limits | research | 429 at the 31st request/hour with `Retry-After` |
| **Total** | **211** | pass after fixes |

## 6. Security results

| Area | Result |
|---|---|
| Auth flows | register (invalid email/weak password → 400, duplicate → 409, race → 409 after F18); wrong password and unknown email return the **same** 401 (no account enumeration) |
| Password reset | one email (throwaway); generic 200; links single-use; expired → 400; **3 parallel uses → exactly 1 succeeds** (F7, was a race) |
| Isolation | 62/62 — no cross-user reads/writes, body `userId` ignored, deleted user's cookie dead |
| Admin | `/admin/health` → 404 for non-admins, sign-in redirect when signed out |
| Error leakage | API and 404 bodies leak no stack/DB/upstream URL — **after F18** (user routes returned raw Prisma messages with status 200) and F4/F5/F8/F10 |
| Sheets API key | stored hashed, shown once, regenerate revokes old key |
| Security headers | **none** (no CSP, frame-ancestors/X-Frame-Options, Referrer-Policy, nosniff, Permissions-Policy) → §11 NA-SEC-1 (next.config.js is a high-risk file) |
| Dependencies | middleware-bypass-class advisories closed by Next 14.2.35 |

## 7. UI matrix

**7.1 Signed-in matrix (Phase 5):** 35 pages × {1920, 1536, 1440, 1366, 1280, 1024} × {USA, INDIA} = **420 loads**. Final state: 0 horizontal overflow, 0 spill, 0 bad values (NaN/undefined/null/Infinity/Invalid Date/[object Object]/−0.00%), 0 overlaps, 0 failed requests, 0 broken images, 0 console errors (except the noted `/admin/health` P3). Clipped text without a tooltip and unlabeled inputs were found and fixed (F12/F13). Tiny 7–10 px fonts are design-wide (§11).

**7.2 Public pages (signed out):** `/`, `/auth/signin`, `?tab=register`, `/auth/forgot-password`, `/auth/reset-password` × {1920, 1536, 1440, 1366, 1280, 1024, 768×1024, 390×844} = **40 loads, 0 issues**.

**7.3 Interactions (all pass after fixes):** mode toggle both ways (tape, cards, ₹/$); command palette (Ctrl+K, type, Enter, Esc); search; F2/G/Esc; split view; beginner mode; sound; theme ×4 (light contrast: F23); deep dive (tabs, Esc, support/resistance F15, news F16); Why line + "Research this"; Research typed questions (advice refused, typo "infosis" → Infosys, premise "down" corrected to "up", gibberish → help text); Scenarios (presets, custom valid / empty / out of range, beyond-historical warning, portfolio stress "not estimated"); Portfolio (invalid, valid, double-click, delete, mixed ₹+$, unpriced ticker); Trades; Alerts price+news (invalid, double-click, back-to-back, delete); Watchlist (W, invalid, TCS.NS ₹, remove); Backtest (run, verified numbers, empty field, TCS.NS in ₹); Sheets key display; 404 (real 404 + nav); back/forward; live resize 1920 → 1366 → 1024; sign-out → `/` + 401; signed-out deep link → sign-in with `callbackUrl` → returns after sign-in.

**7.4 Final regression sweep (Phase 9, upgraded deps):** 33 signed-in pages × {1440, 1024} × {USA, INDIA} = **132 loads, 0 issues** (no overflow, spill, clipped text, bad values, overlaps, failed requests, console errors, unnamed controls or unlabeled inputs).

**Screenshots (1440 × 900):** `docs/e2e-2026-10/dashboard-usa-1440.jpg`, `docs/e2e-2026-10/dashboard-india-1440.jpg`.

## 8. Data accuracy (Phase 6; weekend, both markets closed — UI correctly showed CLOSED)

| Check | App | Source | Δ |
|---|---|---|---|
| AAPL, MSFT, NVDA, TSLA, JPM price & % | app quotes | Yahoo chart API | 0.00 |
| RELIANCE, TCS, HDFCBANK, INFY, ITC | app quotes | Yahoo chart API | 0.00 |
| NIFTY 50, SENSEX, BANK NIFTY | app | Yahoo | 0.00 |
| Scenario XOM @ WTI +10% | 3.2270 | data file | 0 |
| Backtest SPY SMA 20/50 since 2020 | $16,471 | cash 442.55 + 21 × 763.25 (Yahoo close) | 0 |
| Backtest buy-and-hold | +134.94% | 763.25 / 324.87 | 0 |
| Portfolio AAPL/MSFT correlation (1y) | 0.120 | computed from raw Yahoo closes | 0 |
| Portfolio totals | $2,274.07, day −$28.25 | hand sum | 0 |
| Support / resistance | after F15: every resistance > price, every support < price (TCS, RELIANCE, AAPL, NVDA) | — | — |
| Sheets `open` field | after F9: session open (was the current price) | Yahoo | — |

## 9. Performance & cost

| Measure | Result |
|---|---|
| Cold / warm (local server, Neon far from the test machine) | why/us 2447/66 ms · brain/us 3482/5 · brain/in 1483/4 · scenario 8/3 · research 3144 · user routes ~2.8 s (session + DB round trips) · no route > 2 s warm |
| Dashboard idle, 5 min, USA | 88 requests (18/min) — stocks 22, crypto 19, earthquakes 10, alerts/check 5, overview 5, iss 5, sparkline 5, watchlist 5, news 4, … |
| Dashboard idle, 5 min, INDIA | 77 requests (15.3/min) — india/* 5 each, stocks 8, earthquakes 8, … |
| Polling added in this pass | none; India ticker tape replaces the US one (same 1 request/min); the frozen bottom tape in India mode was removed |
| Caching | not loosened; user routes stay `private, no-store` |
| Possible saving (not changed) | several panels poll `/api/crypto` and `/api/stocks` separately every 60 s (cached server-side, but each is a function invocation) — could share one fetch |
| Page load (dashboard, local) | DOMContentLoaded 17 ms, load 78 ms after cache warm |

## 10. Every fix

| ID | Sev | What was wrong | Fix | Files | Verified |
|---|---|---|---|---|---|
| F1 | P1 | `/api/why/<anything>` built a full evidence context, returned 200 with an internal message and created an ISR entry per path | explicit US/IN check → 404 | `app/api/why/[market]/route.ts` | API sweep |
| F2 | P1 | Yahoo-sourced sparklines empty (yahoo-finance2 query2 429) | use `getChartRange` (query1 first) | `app/api/sparkline/route.ts` | Gold/DXY 30 pts, NSEI/BSESN 14, AAPL 19 |
| F3 | P3 | `/api/bonds` default type had no handler → 400 | default `yields` | `app/api/bonds/route.ts` | sweep |
| F4 | P3 | raw upstream error text (Yahoo URL, axios message) to the browser | plain messages, logged | `app/api/stocks`, `app/api/crypto` | sweep |
| F5 | P3 | AI route told users to "add GEMINI_API_KEY to .env.local" | "AI analysis is not available right now." | `app/api/ai/analyze/route.ts` | sweep |
| F6 | P3 | bad scenario preset → zod "Invalid input" | message lists presets/factors | `lib/scenario/schema.ts` | sweep |
| F7 | P2 | password reset: check-then-mark race → two resets from one link | atomic claim before changing the password | `app/api/auth/reset-password/route.ts` | 3 parallel → 200/400/400 |
| F8 | P1 | Sheets `=GV()` name/exchange/prev_close → 500 with raw Yahoo error | from the query1 chart quote; upstream down → 503 + Retry-After | `app/api/public/gv/route.ts`, `lib/apis/yahoo.ts` | live check |
| F9 | P0 | quote fallback set **open = current price** and day high/low = price — Sheets `open` was always wrong | session bar open / null | `lib/apis/yahoo.ts`, `lib/apis/india.ts` | open 346.09 vs price |
| F10 | P1 | `/api/public/gv-history` returned the close under the requested field name when missing | null; upstream failure → 503 | `app/api/public/gv-history/route.ts` | sweep |
| F11 | P2 | `/sheets` "Loading…" forever for older keys | `hasKey` state | `app/sheets/page.tsx` | UI |
| F12 | P2 | 26 form controls without accessible names | `aria-label`s | auth pages, markets, forex, news, flights, weather, backtest, alerts, options, insiders, financials, glossary | sweep: 0 unlabeled |
| F13 | P2 | truncated text with no way to read it; India news rows click-only divs | `title`s; rows are real links | dashboard, disease, insiders, news, screener, MarketBrain, WeatherPanel | sweep: 0 clipped |
| F14 | P2 | God-mode scene dots unnamed | `aria-label`, `aria-current` | `app/godmode/page.tsx` | sweep |
| F15 | P1 | "Resistance" levels below the price; "nearest" was the farthest | levels split around the last close, nearest first; empty side "—" | `lib/utils/technicals.ts`, `StockDeepDive.tsx` | TCS/RELIANCE/AAPL/NVDA |
| F16 | P2 | India headlines showed "F&amp;O" | decode entities | `lib/apis/indiaNews.ts` | 0 entities in 40 |
| F17 | P2 | 5 forms ignored the server: a 400/429/500 cleared the form as if saved; double-click saved twice | `postJson` helper, per-form saving flag, message shown, input kept | `lib/utils.ts`, portfolio, alerts, WatchlistSidebar | invalid → message; double-click → 1 row; two forms at once both save |
| F18 | P2 sec | user routes returned raw exception text (Prisma can include DB host/query) with status 200 | logged server-side, generic 500; register race → 409 | portfolio, alerts, alerts/check, transactions, watchlist, register | — |
| F19 | P1 | portfolio: missing quote → price = buy price (fake P&L 0); losses shown without minus; ₹ added to $; risk metrics pooled unweighted returns, MAX DD was SPY's, series paired by position not date, missing data → beta 1 | honest "—"/"n priced"; signed values; per-row currency, no mixed totals; quantity-weighted portfolio series on shared dates (`alignCloses`) | `app/portfolio/page.tsx`, `lib/portfolio-analytics.ts` | hand sums, corr = raw Yahoo |
| F20 | P2 | watchlist "$" for NSE tickers | currency by ticker | `WatchlistSidebar.tsx` | ₹2465.00 |
| F21 | P2 | backtest "$" for NSE tickers | currency by ticker | `app/backtest/page.tsx` | TCS.NS all ₹ |
| F22 | P2 | "g" on a focused dropdown jumped to God mode (also Ctrl+G); W same; Ctrl+Shift+S/I failed with Caps Lock | ignore selects/contentEditable/modifiers; case-insensitive | `NavBar.tsx`, `WatchlistSidebar.tsx`, `ModeToggle.tsx` | "g" → Gold, stays |
| F23 | P2 | light theme: ~55 dashboard texts below 2:1 contrast (Tailwind `text-primary` fixed near-white in 65 files, hardcoded panel colours) | light-theme override + theme vars; heatmap tiles keyboard-reachable | `globals.css`, MarketOverviewStrip, NiftyHeatmap, AnalystPanel, ThemeSwitcher | 55 → 5 |
| F24 | P2 | India mode: top tape US tickers; bottom tape US/crypto prices frozen from first render | mode-aware tape; bottom tape removed in India layout | `TickerTape.tsx`, `app/dashboard/page.tsx` | NIFTY/SENSEX/… |
| Deps | P1 sec | Next 14.2.5 (critical advisories), next-auth, axios, transitive | patch/minor upgrades, no majors | `package.json`, `package-lock.json` | all suites + build |

## 11. Needs approval

| ID | Item | Why it needs you |
|---|---|---|
| NA-PROD-1 | **Analyst panel and deep dive give buy/sell advice and targets**: BUY/SELL/WATCH picks with entry, target 1/2, stop-loss, "IF YOU BUY… you could gain ₹X/share", "BUY 83% confidence" (rule-based when AI is off), an "AVOID LIST"; screener RATING column "STRONG BUY…SELL" (Yahoo analyst consensus) | Breaks the wording rule (no buy/sell advice or targets). Remove, or rework into "moved with / historically tended to" evidence. Product decision. |
| NA-SEC-1 | No security headers (CSP, frame-ancestors, Referrer-Policy, nosniff, Permissions-Policy, HSTS) | `next.config.js` headers are a high-risk file. Suggested start: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'self'`, then a report-only CSP. |
| NA-DEP-1 | Remaining advisories: Next.js Image Optimizer DoS (self-hosted; Vercel handles image optimisation) and PostCSS via Next → **Next 16**; braces/chokidar/micromatch/postcss-selector-parser → **Tailwind 4** | Major upgrades; need a planned migration. |
| NA-DB-1 | Deleting a user does **not** remove their holdings, alerts, watchlist or transactions: the relations are `onDelete: SetNull`, so rows stay with an empty owner (0 such rows exist today — this pass removed the test account's rows first) | `prisma/schema.prisma` is high-risk; `Cascade` (as `PushSubscription` already has) would fix it, needs a migration. |
| NA-MW-1 | Signed-out deep link drops the query string (`/portfolio?x=1` → `callbackUrl=/portfolio`) | `middleware.ts` is high-risk. |
| NA-UX-1 | 7–10 px fonts across the terminal design; saffron (#FF9933) India headers ~1.9:1 on the light theme | Design-wide decisions. |

## 12. Known limitations

- Weekend run: both markets closed, so accuracy checks compare closes; intraday moves and market-open states were not observed live.
- AI paths ran only with no provider (deterministic answers; the research suite covers its fake-provider path). Real Gemini output was not exercised by design.
- Email: one forgot-password email to the throwaway; alert emails/push were deliberately never triggered (alerts were set at unreachable prices).
- Stripe checkout/portal not exercised (would create real Stripe objects).
- Local timings include India → Neon latency; production latency will differ.
- Upstream-feed routes (commodities, forex, india/*, disease, …) still return upstream error text such as "Request failed with status code 429" — harmless but unpolished (P3, ~30 routes, not changed).
- `/admin/health` for a non-admin logs a Next streaming notice in the console (response is a correct 404).
- The built-in browser pane renders emulated viewports scaled; layout checks were done in code (iframes at exact sizes), not by eye.

**Cleanup:** throwaway account deleted together with its own rows (2 portfolio holdings; alerts, trades and watchlist test rows had already been deleted through the UI) → **15 users**, 0 orphaned rows (userId null) in holdings, price/news alerts, watchlist, transactions and push subscriptions; no `gv-evidence`/`e2e` accounts left. Isolation suite deletes its own pair. Temporary scripts (`scripts/_apisweep.ts`, `scripts/_accuracy.ts`) deleted. Local server stopped; browser left in USA mode, dark theme.
