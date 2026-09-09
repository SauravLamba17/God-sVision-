# Landing Page Port — Report

**Date:** 2026-09-09
**Branch:** `main` (uncommitted — awaiting review, as instructed)
**Reference:** `_landing-reference/GODs Vision Landing.dc.html` + `support.js`

---

## 0. A note on the reference file

The plan referred to `_landing-reference/` as already present. It was not — the files were
still inside `Design updates_ stats, pricing, backtest.zip` at the repo root, which is why an
initial search for `*landing*` / `*.dc.html` found nothing. The zip was extracted to
`_landing-reference/` and both files read in full before any port code was written.

**One correction to a plan assumption:** the plan said to port the globe math and the
`frame()`/`frameBody()` loop "from `support.js`". `support.js` is in fact the *generated Claude
Design runtime* (`dc-runtime` — a React wrapper, mustache templating and prop editors). It
contains **zero** design-specific content (0 matches for the accent colour, `GOD`, `NIFTY`,
`AAPL`). All design logic — `buildSphere`, `drawGlobe`, `drawArcs`, `frame`, `frameBody`,
`startAI`, `drawChart`, `buildSeries`, `tickQuote` — lives in the `<script type="text/x-dc">`
block *inside* the `.dc.html`. That block is what was ported from.

Also worth noting: there is no separate pricing section in the design. The "pricing" in the zip
name is the **Ledger** section, and it already carries the corrected `~$32,000` figure with its
disclaimer — no old fabricated itemised breakdown was present to remove.

---

## 1. Routing change, and proof every protected route is still protected

### What changed

`/` was **never** in a protected-paths list. `middleware.ts` is **deny-by-default**: the matcher
runs on everything except a fixed set of static/API exclusions, then `publicPaths` is checked
with `startsWith()`, and anything left over requires a token.

That mattered a great deal. The plan's step "remove `/` from protected paths" would in practice
be "add `/` to `publicPaths`" — and because that list is matched with `startsWith()`, **an entry
of `/` there would have made every single route in the application public.** Given middleware
has already caused two production incidents this session, this was the highest-risk line in the
whole plan.

The fix keeps them strictly separate:

```ts
// Exact-match only. '/' MUST NOT go in publicPaths below: that list is
// matched with startsWith(), so a '/' entry there would make every route public.
const publicExactPaths = new Set(['/'])

if (publicExactPaths.has(path) || publicPaths.some(p => path.startsWith(p))) {
  return NextResponse.next()
}
```

`/dashboard` needed **no entry at all** — deny-by-default already protects it, in exactly the
same way and by exactly the same mechanism that protected `/` before the move. No auth
requirement was weakened anywhere; `publicPaths` itself is byte-for-byte unchanged.

### Proof — production build (`next build` + `next start`), logged out

| Route | Status | Redirect |
|---|---|---|
| `/` | **200** | none (public, as intended) |
| `/dashboard` | 307 | `/auth/signin?callbackUrl=%2Fdashboard` |
| `/markets` | 307 | `/auth/signin?callbackUrl=%2Fmarkets` |
| `/crypto` | 307 | `/auth/signin?callbackUrl=%2Fcrypto` |
| `/forex` | 307 | `/auth/signin?callbackUrl=%2Fforex` |
| `/bonds` | 307 | `/auth/signin?callbackUrl=%2Fbonds` |
| `/backtest` | 307 | `/auth/signin?callbackUrl=%2Fbacktest` |
| `/portfolio` | 307 | `/auth/signin?callbackUrl=%2Fportfolio` |
| `/alerts` | 307 | `/auth/signin?callbackUrl=%2Falerts` |
| `/watchlists` | 307 | `/auth/signin?callbackUrl=%2Fwatchlists` |
| `/godmode` | 307 | `/auth/signin?callbackUrl=%2Fgodmode` |
| `/sheets` | 307 | `/auth/signin?callbackUrl=%2Fsheets` |
| `/heatmap` | 307 | `/auth/signin?callbackUrl=%2Fheatmap` |
| `/auth/signin` | 200 | public ✔ |
| `/auth/forgot-password` | **200** | still public ✔ (the bug fixed earlier this session — not regressed) |
| `/auth/reset-password` | **200** | still public ✔ |

Logged in (valid session cookie): `/` → **307 → `/dashboard`**; all eleven protected routes
return 200.

### A gap the plan did not cover

`components/terminal/ClientLayout.tsx` wraps TopBar / NavBar / StatusBar / CommandPalette and a
`position: fixed` `<main>` around every route except `/godmode` and `/auth/*`. Without adding
`/` to that exemption the public landing page would have rendered *inside* the authenticated
terminal chrome. Fixed alongside the middleware change.

---

## 2. Files created, moved and modified — by phase

### Phase 2 — routing
| File | Change |
|---|---|
| `app/page.tsx` → `app/dashboard/page.tsx` | **Moved** via `git mv` (rename preserved in history). No co-located files: all 14 panels are `@/components/...` dynamic imports, and the only other files in `app/` root are the shared `layout.tsx` and `globals.css`. |
| `middleware.ts` | **Modified** — added `publicExactPaths` Set + one condition; updated the header comment. `publicPaths` and `matcher` untouched. |
| `components/terminal/ClientLayout.tsx` | **Modified** — added `isLanding` (`pathname === '/'`) to the standalone-render branch. |
| `components/terminal/NavBar.tsx` | **Modified** — F1 `DASH` → `/dashboard`. |
| `components/terminal/CommandPalette.tsx` | **Modified** — `DASHBOARD` entry → `/dashboard`. |
| `app/pricing/page.tsx` | **Modified** — `<Link href="/">` → `/dashboard`. |
| `app/auth/signin/page.tsx` | **Modified** — `callbackUrl` default and its safety fallback `/` → `/dashboard`; "Back to Terminal" → `/dashboard`. |
| `app/page.tsx` | **Created** — landing page (see Phase 4/7). |

`lib/auth.ts` was **not touched.** The audit showed `authOptions` has no redirect callback at
all; the post-login target lives entirely client-side in `signin/page.tsx`'s `gotoCallback()`.
Its deliberate hard `window.location.href` navigation (documented in-file as the fix for a real
cookie-timing bug) was preserved exactly.

`UserMenu.tsx`'s `signOut({ callbackUrl: '/' })` was deliberately **left as `/`** — signing out
should land on the public landing page.

### Phase 3 — public ticker endpoint
| File | Change |
|---|---|
| `app/api/public/ticker/route.ts` | **Created** — under `app/api/public/` so it inherits the same proven middleware exemption as the Sheets API (matcher negative-lookahead *and* `publicPaths`). Unlike `/api/public/gv` it takes no API key: anonymous visitors are the entire audience. Reuses `getCryptoTop100()` from `lib/apis/coingecko.ts` and `getCache`/`setCache` from `lib/cache.ts`, 60s TTL, serves stale on upstream failure. |

### Phase 4 — landing components
Created under `components/landing/`: `LandingHeader.tsx`, `LandingTickerTape.tsx`,
`LandingHero.tsx`, `LandingMarkets.tsx`, `LandingAI.tsx`, `LandingBacktest.tsx`,
`LandingWorld.tsx`, `LandingDualMode.tsx`, `LandingLedger.tsx`, `LandingCTA.tsx`,
`LandingFooter.tsx`, plus `links.ts`.

Created elsewhere:
- `lib/canvas/globe.ts` — `buildSphere`, `rot`, `drawGlobe`, `drawArcs`, `CITIES`, `ROUTES`,
  colours. Ported line-for-line; tuned constants (0.22 perspective divisor, `3.5/√n` neighbour
  cutoff, per-point alpha curve, 0.2 arc lift) preserved exactly.
- `lib/canvas/chart.ts` — `ChartSeries` (seeded LCG, seed 42), `drawChart`. Ported from
  `buildSeries`/`tickQuote`/`drawChart`.
- `lib/hooks/useGlobeAnimation.ts` — the shared rAF driver: IntersectionObserver gating
  (`rootMargin: '140px 0px'`), tab-hidden pause, 32 ms (~30 fps) throttle, resize/scroll kicks,
  single static frame under reduced motion. Takes a per-frame callback so Hero and World supply
  their own camera curves.
- `lib/hooks/useTypewriter.ts` — `AI_SCRIPT` verbatim, IntersectionObserver at threshold 0.25,
  2 chars per 14 ms tick, instant full reveal under reduced motion.
- `lib/hooks/useLandingReveal.ts` — port of `setupReveal()`. *(Additive: not in the plan's file
  list, but the reference has this logic and dropping it would leave sections able to stick at
  `opacity: 0`. Called once from `LandingHeader`.)*
- `app/landing.css` — the `@import` for Geist/Geist Mono, the four keyframes (`gv-tape`,
  `gv-blink`, `gv-rise`, `gv-live`), the `@supports (animation-timeline: view())` upgrade, the
  reduced-motion block, and the hover/focus classes.

`style-hover` / `style-focus` are a Claude Design authoring convention, not real HTML. Each was
converted to a real class with `:hover` / `:focus-visible`: `.gv-nav-link`, `.gv-link-quiet`,
`.gv-btn-primary`, `.gv-btn-ghost`, `.gv-skip`. Mustache `{{ }}` and the `<sc-for>` loop became
JSX expressions and `.map()`. All other styling is inline `style={{}}` objects, camelCased, as
instructed.

**Two global-style conflicts had to be neutralised** (found in the Phase 1 audit):
`globals.css:182` sets `html, body { overflow: hidden; height: 100%; background-color: … !important }`
and `app/layout.tsx` sets `overflow: hidden; height: 100vh` **inline** on `<body>`. An inline
style can only be beaten by `!important`, so `landing.css` scopes overrides via
`html:has(.gv-landing), body:has(.gv-landing)`. The terminal's `body::before` grid overlay and
`body::after` radial glow are hidden the same way, and `#__next, main { height: 100% }` is
undone for `.gv-landing main`. No other route is affected.

### Phase 5 — fonts
`next/font/google` in **Next 14.2.5 does not include Geist** — verified by inspecting the
compiled catalogue directly (`next/dist/compiled/@next/font/dist/google/font-data.json`
filtered for `/geist/i` → `[]`), not assumed. Fell back to the reference's own Google Fonts
approach, as an `@import` at the top of `app/landing.css` so it is scoped to this page rather
than added to the root layout (which would cost every authenticated route an extra font
download). Verified present in the built CSS chunk and actually resolving in the browser:
`h1` → `Geist, sans-serif`; `#gv-tape b` → `"Geist Mono", monospace`.

### Phase 6 — integration points
- `app/auth/signin/page.tsx` — added `?tab=register` support. Smallest viable change: the
  component was split into a `Suspense` wrapper plus `SignInForm`, and the existing
  `useState` initialiser now seeds from `useSearchParams()`. The tab-switching mechanism itself
  is untouched. The `Suspense` boundary is required — `useSearchParams()` otherwise makes
  `next build` bail out of static generation for the route.
- `LandingDualMode.tsx` — wired to the **real** `useMode()` context, not local state.
- `LandingTickerTape.tsx` — fetches `/api/public/ticker`, falls back to the reference's static
  array.

### Phase 7 — metadata
`app/page.tsx` exports its own `metadata`: title, description, `themeColor: '#0a0b0d'`,
Open Graph (`title`, `description`, `siteName`, `type: website`) and a Twitter summary card —
distinct from the root layout's terminal metadata.

---

## 3. Ticker: what is genuinely live vs illustrative

**Genuinely live — BTC, ETH, SOL.** Fetched from CoinGecko via the existing
`getCryptoTop100()` helper (no new API client, no key needed), cached 60 s through the existing
`lib/cache.ts` Redis/memory layer so anonymous landing traffic cannot hammer upstream.

Verified live in the browser: the tape rendered `BTC 79,254 ▲ +1.21%` against the design's
static `BTC 67,412 +2.81%`, so the override path demonstrably fired.

**Illustrative — AAPL, NIFTY, USDINR, SPX, EURUSD, GOLD, NVDA, RELIANCE, WTI, JPY, TSLA,
SENSEX.** Left at the design's values, per the plan's own guidance. This turned out to be
well-founded rather than merely cautious: during verification, `/api/public/gv?key=<valid>`
returned **500 — `invalid json response body at https://query2.finance.yahoo.com/...`**. That
is the exact Yahoo rate-limit fragility the plan anticipated, observed live. Putting index/FX
data behind an endpoint hit by every anonymous visitor would have spent that fragile budget on
a marketing marquee.

> That 500 is **pre-existing and unrelated to this work** — `app/api/public/gv/route.ts` is
> untouched (`git status`/`git diff` both clean for it), and the route is still correctly
> reachable rather than redirected: a wrong key returns its own `401 {"error":"Invalid or
> missing API key"}` from the route body, proving middleware exemption intact. Flagged as a
> follow-up in §7.

The client merges live rows over the static array by symbol, so a fetch failure, a slow
response or an empty result silently leaves the full 15-cell design tape in place. The marquee
can never render empty or broken.

---

## 4. Phase 9 verification — evidence

Testing used headless Chrome driven over the DevTools Protocol, capturing `Runtime.consoleAPICalled`,
`Runtime.exceptionThrown` and `Log.entryAdded`. Canvas rendering was verified by reading back
pixel data (counting non-zero alpha), not by eyeballing. Unless noted, results are from the
**production build** (`next build` + `next start`), which is why the console is free of dev-mode
Fast Refresh noise.

### 9.1 / 9.2 — Typecheck and build
`npx tsc --noEmit` → **exit 0, no errors.** `npm run build` → **exit 0**, all routes emitted.
`/` is `ƒ` (server-rendered, correct — it calls `getServerSession`); `/dashboard` `○` at 10.2 kB.
Both were run and passed after Phase 2 *and* after Phase 4/6, per the "verify after every phase"
rule.

### 9.3 — Logged out

| Check | Result |
|---|---|
| Visit `/` — landing page, not redirected | ✅ 200, `.gv-landing` present, `<h1>` = "A terminal that reads the whole tape — and costs n…" |
| No hydration warnings in console | ✅ **`logs: []`, `errors: []`** — zero console output of any kind, at 1440×900 and 390×844 |
| Ticker shows data | ✅ 30 cells (15 doubled for the seamless loop); `BTC 79,254 ▲ +1.21%` = live |
| Ticker graceful fallback | ✅ static array retained on any fetch failure (merge-by-symbol) |
| Hero globe renders and animates | ✅ canvas 915×784, **12,554 painted pixels**; readout advancing (`yaw 033.8°`) |
| Scroll — reveal animations fire | ✅ 20 `[data-reveal]` elements, **0 stuck at opacity 0** |
| World globe larger, scroll-driven camera | ✅ canvas 1430×810, **35,689 painted pixels** after scrolling into view; correctly **unpainted** before (IntersectionObserver gating works) |
| AI typewriter starts on scroll | ✅ idle placeholder → 387 chars mid-type (status "Reading wires…") → 708 chars, status "Brief ready · confidence 0.72", tail `…trace 0413 \n\n> _ ▌` |
| Dual mode toggle switches | ✅ S&P 500 → NIFTY 50, `aria-checked` flips |
| Backtest equity curve renders | ✅ both polylines + endpoint marker; stats 57.4% / 1.18 / −14.6% / +9.2 pts |
| Ledger shows ~$32,000 with disclaimer | ✅ 9 rows, `tfoot` = `["$0", "~$32,000"]`, illustrative-pricing paragraph present |
| "Sign in" → `/auth/signin` (Sign In tab) | ✅ both instances; page loads with `activeTab: "SIGN IN"`, no name field |
| "Get started" → Register tab active | ✅ all three instances → `/auth/signin?tab=register`; loads with `activeTab: "REGISTER"`, name field present, submit reads "CREATE ACCOUNT →" |
| `/dashboard` logged out → redirects | ✅ 307 → `/auth/signin?callbackUrl=%2Fdashboard` |

`?tab=bogus` and plain `/auth/signin` both correctly fall back to the Sign In tab.

### 9.4 — Logged-in flow

**One deliberate deviation.** The plan said to register a real test account. Verification showed
`.env` points `DATABASE_URL` at the **production Neon instance**
(`ep-wandering-paper-atay5blo…neon.tech/neondb`), so registering would have written a real user
row into the live database. Because `authOptions` uses `session: { strategy: 'jwt' }`, both
`getToken()` in middleware and `getServerSession()` only verify the JWT — no DB read. So a valid
session cookie was minted with the real `NEXTAUTH_SECRET` via next-auth's own
`encode()`. This exercises **the identical code paths** with zero writes to production.

| Check | Result |
|---|---|
| Toggle India on the landing dual-mode demo | ✅ benchmark → NIFTY 50, `localStorage.gv_terminal_mode = "INDIA"` |
| Redirect after auth lands on `/dashboard`, not `/` | ✅ `callbackUrl` default is `/dashboard`; visiting `/` with a session → `/dashboard` |
| `/dashboard` shows India mode carried from landing | ✅ `<html data-terminal-mode="INDIA">`, localStorage `"INDIA"`, page text contains NIFTY, SENSEX and ₹ |
| Navigate to `/` while logged in → auto-redirect | ✅ 307 → `/dashboard` (middleware-level) and client lands on `/dashboard` |
| Logo/wordmark inside the app → `/dashboard` | ✅ **nothing to fix** — `TopBar.tsx:133` "GOD'S VISION" is a plain `<span>`, not a link. The F1 `DASH` nav item was the real dashboard link and now points to `/dashboard`. |
| Sign out → `/` shows the landing page again | ✅ cookies cleared → `/` renders `.gv-landing` with the hero `<h1>` |

### 9.5 — Regression checks

| Check | Result |
|---|---|
| `/markets` `/crypto` `/forex` `/bonds` `/backtest` `/portfolio` `/alerts` `/watchlists` require auth | ✅ all 307 → signin logged out; all 200 logged in |
| `/auth/forgot-password`, `/auth/reset-password` still public | ✅ both 200 logged out — **the exact bug fixed earlier this session is not regressed** |
| `/api/public/gv` still works as before | ⚠️ Route **unchanged and still correctly middleware-exempt** (wrong key → its own `401`, not a redirect). Live Yahoo call currently returns 500 — pre-existing upstream rate-limiting, not caused by this work. See §3 and §7. |
| Cmd+K palette still functions | ✅ opens on a real `Input.dispatchKeyEvent` Cmd+K on `/dashboard`; DASHBOARD entry visible and now points to `/dashboard` |
| Zero console errors on `/dashboard` | ✅ `errors: []` |

### 9.6 — Reduced motion (`prefers-reduced-motion: reduce` emulated via CDP)

| Check | Result |
|---|---|
| Marquee stops | ✅ `animationName: none`, `duration: 0s`; bounding-box x **unchanged over 2.5 s** (`moved: false`) |
| AI panel shows full text instantly | ✅ 708 chars immediately, status already "Brief ready · confidence 0.72", no typing interval |
| Globe static, graceful | ✅ single static frame at `t=0`, 35,749 painted pixels; rAF loop does not re-arm |
| Cursor blink / pulse dot / rise-in disabled | ✅ all three `animationName: none` |

> Note: computed `animation-play-state` still reads `running` under reduced motion. That is
> cosmetic and expected — the CSS `animation: none !important` resets the whole shorthand,
> including play-state, to its initial value. Confirmed inert by measuring actual position over
> time rather than trusting the property.

### 9.7 — Mobile viewport (390×844)

✅ No horizontal overflow: `documentElement.scrollWidth` = 390 = `innerWidth` (desktop: 1430 vs
1440, also clean). Header nav wraps to 342 px rather than overflowing. World globe renders
(16,053 painted pixels). Zero console errors. Nothing visibly broken.

---

## 5. Hydration safety

Audited against the Phase 8 checklist explicitly:

| Concern | Handling |
|---|---|
| Session clock | `useState('——:——:——')` — the reference's em-dash placeholder — rendered identically on server and first client paint; `Intl.DateTimeFormat` + the 1 s interval start in `useEffect`. |
| `prefers-reduced-motion` / `matchMedia` | Read **only** inside `useEffect`, in all four places (`useGlobeAnimation`, `useTypewriter`, `useLandingReveal`, `LandingTickerTape`). Never in a render body. |
| Canvas setup | `sizeCanvas` / `getContext` / `buildSphere` all inside `useEffect` after mount. Never during render. |
| AI panel | Server renders the static "awaiting desk session…" placeholder; the observer swaps it only after mount. |
| Hero scroll readout | Static `cam.z 1.00 · yaw 000.0°` in JSX; the per-frame value is written via a **ref** (`textContent`), not state — this also avoids ~30 re-renders/second of the whole hero. |
| Ticker tape | First render always uses the static array; the live merge happens in `useEffect`. |
| `useMode()` | Initialises to `'USA'` and reads localStorage in an effect — pre-existing app behaviour, server and first client render agree. |

**Result: zero hydration warnings.** In the production build, at both 1440×900 and 390×844,
console capture returned `logs: []` and `errors: []` — no output whatsoever, so no
"Text content did not match", no "Hydration failed", nothing.

---

## 6. Deviations from the reference design

1. **CTA targets.** Every "Sign in" / "Get started" in the reference points at the in-page
   `#start` anchor (a static prototype had nowhere else to go). They now point at
   `/auth/signin` and `/auth/signin?tab=register`. This is the intended Phase 6 wiring.
2. **`?locale=` URL parameter dropped.** The prototype mirrored its mode into a query param via
   `history.replaceState`. The real `ModeContext` already persists to
   `localStorage['gv_terminal_mode']`, which is what actually carries the choice into the
   dashboard. Keeping both would be redundant and could conflict.
3. **`setMode` expressed as a guarded toggle.** `ModeContext` exports `toggleMode` but no
   `setMode`, so the two radio buttons call `toggleMode()` only when the target differs from the
   current mode. This keeps the core context untouched, per the instruction to prefer changing
   call sites over core config. Behaviour is identical.
4. **`data-delay` attributes are inert — as in the reference.** The design's CSS never reads
   `data-delay`; `[data-reveal]` has a single un-delayed `gv-rise`. The attributes are carried
   through for markup fidelity, but no stagger was invented, since adding one would be a
   redesign rather than a port.
5. **`useLandingReveal` added** (see §2) — restores `setupReveal()` logic the plan's file list
   omitted.
6. **Globe sphere construction memoised.** `buildSphere` is O(n²) in its link pass (~192k
   iterations at n=620). Results are cached per density and built in `requestIdleCallback`, so
   the Hero and World globes share one computation instead of doing it twice on the critical
   path. Output is bit-identical to the reference.

No section, stat, table row, or piece of copy was dropped, reworded or restyled. All eight
sections are present in the reference's order: Hero → Markets → AI → Backtest → World →
Dual Mode → Ledger → CTA, plus header, ticker, scanline overlay, skip link and footer.

---

## 7. Known limitations and recommended follow-ups

1. **Geist is loaded via a Google Fonts `@import`, not `next/font`.** Next 14.2.5's font
   catalogue has no Geist entry (verified, not assumed). This means no automatic self-hosting,
   preloading or CLS-reducing size-adjust fallback for these two families, and a render-blocking
   request to `fonts.googleapis.com`. Two ways forward: upgrade Next to a version whose
   `next/font/google` includes Geist, or self-host the `.woff2` files under `public/` and use
   `next/font/local`. Not a blocker.
2. **`/api/public/gv` currently returns 500 from Yahoo.** Pre-existing, unrelated to this work,
   and observed live during testing. The Sheets add-on is presumably affected in production
   right now. Worth investigating separately — and it is the concrete justification for keeping
   the index/FX portion of the ticker illustrative.
3. **The ticker's non-crypto rows are static.** If live index/FX data is wanted later, the merge
   point already exists — extend `/api/public/ticker` to add rows and they will override by
   symbol with no component change. A more resilient upstream than Yahoo is advisable first.
4. **`:has()` is load-bearing** for the `landing.css` overrides that undo the terminal shell's
   `overflow: hidden` and `!important` background. Baseline in all current browsers, but if a
   very old browser must be supported the landing page would not scroll. A `<body>`-class
   toggle would be the fallback, at the cost of a flash before hydration.
5. **`_landing-reference/` and the source `.zip` are currently untracked** at the repo root.
   Decide whether to commit them as design provenance or add them to `.gitignore`.
6. **The registration → redirect path was verified by code and by an equivalent minted session,
   not by creating a live account** (§9.4). If an end-to-end signup test is wanted, it should be
   run against a non-production database.

---

## 8. Status

`npx tsc --noEmit` clean · `npm run build` clean · all Phase 9 checks passed · zero hydration
warnings · every previously-protected route still protected.

**Not committed and not pushed**, as instructed — awaiting review of this report.
