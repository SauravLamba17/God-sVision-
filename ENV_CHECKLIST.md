# Environment Variable Checklist

**Generated:** 2026-08-30
**Sources:** `grep -r "process.env."` across all `.ts/.tsx/.js/.mjs` (excluding `node_modules`,
`.next`, `.git`) + `prisma/schema.prisma` `env()` calls, cross-referenced against `.env.local`
and `.env`.

**34 variables matter in total:** 31 referenced via `process.env.*` in project code, 2 referenced
only by Prisma's schema, 1 (`NEXTAUTH_URL`) read internally by NextAuth and never via
`process.env`.

> Secret values are masked below. Neither `.env` nor `.env.local` is tracked by git (both are in
> `.gitignore`, confirmed via `git ls-files`).

---

## 🔴 BLOCKERS — placeholder values sitting in `.env.local` right now

These are *present* but hold literal placeholder text, so every guard in the code treats them as
missing. **These are the confirmed root causes of three findings in the production audit.**

| Variable | Current value | Consequence |
|---|---|---|
| `FRED_API_KEY` | `your_fred_key_here` (18 ch) | `lib/apis/fred.ts:6` sets `KEY_VALID=false` → `/api/macro` serves **2024-dated `MACRO_MOCK`**; `/api/bonds?type=spread` serves static estimates with `date:"N/A"` |
| `UPSTASH_REDIS_REST_URL` | `paste_from_upstash…` (28 ch) | `lib/cache.ts:7` explicitly checks `!redisUrl.startsWith('paste_from')` → **Redis disabled**, in-memory only |
| `UPSTASH_REDIS_REST_TOKEN` | `paste_from_upstash…` (28 ch) | Same as above |
| `NEWS_API_KEY` | `your_newsapi_key_here` (21 ch) | `lib/apis/news.ts:268` returns `[]` from NewsAPI. Not fatal — news also has RSS sources — but one feed is silently dead |

Getting real values for these four fixes CRITICAL #6 (macro mock data) and CRITICAL #7 (Redis not
configured) from the production report.

---

## 🔴 MISSING ENTIRELY — referenced in code, absent from `.env.local`

| Variable | Used in | Impact if unset |
|---|---|---|
| `NEXT_PUBLIC_BASE_URL` | `lib/apis/narratives.ts:30` | **Defaults to `http://localhost:3001`** and then does `fetch(\`${baseUrl}/api/news\`)`. On Vercel a serverless function calling localhost fails — a likely contributing cause of the stale AI Narratives panel. **Set this to `https://god-s-vision.vercel.app`** |
| `GOOGLE_CLIENT_ID` | `lib/auth.ts` | Google sign-in provider is conditionally skipped. Credentials login still works. Optional |
| `GOOGLE_CLIENT_SECRET` | `lib/auth.ts` | Same |
| `STRIPE_SECRET_KEY` | `lib/stripe.ts:8` | **Throws `STRIPE_SECRET_KEY is not configured`** on any checkout attempt. `/pricing` cannot transact |
| `STRIPE_WEBHOOK_SECRET` | `app/api/stripe/webhook/route.ts` | Webhook signature verification fails — plan upgrades never apply |
| `STRIPE_PRO_PRICE_ID` | `lib/stripe.ts:28`, `app/api/stripe/checkout/route.ts` | Checkout session has `priceId: undefined` |
| `OPENSKY_USERNAME` | `lib/apis/opensky.ts:39` | Falls back to anonymous access (heavily rate-limited). Plausibly why `/api/flights` times out — see CRITICAL: flights BROKEN |
| `OPENSKY_PASSWORD` | `lib/apis/opensky.ts:40` | Same |

---

## ✅ PRESENT AND VALID in `.env.local`

| Variable | Used in | Notes |
|---|---|---|
| `POSTGRES_PRISMA_URL` | `prisma/schema.prisma` (`env()`) | Pooled Neon connection. **Not** read via `process.env` |
| `POSTGRES_URL_NON_POOLING` | `prisma/schema.prisma` (`directUrl`) | Direct connection for migrations |
| `NEXTAUTH_SECRET` | `lib/auth.ts`, `middleware.ts` | JWT signing. Middleware fails safe to sign-in if this mismatches |
| `NEXTAUTH_URL` | *(NextAuth internal — never via `process.env`)* | ⚠️ **Currently `http://localhost:3001`. MUST be `https://god-s-vision.vercel.app` on Vercel** |
| `GEMINI_API_KEY` | 8 files — `lib/gemini.ts`, `lib/apis/narratives.ts`, `lib/apis/newsSentiment.ts`, `app/api/ai/brief`, `app/api/ai/sentiment`, `app/api/analyst`, `app/api/analyst/stock`, `app/api/reddit/sentiment` | Most-referenced var. Verified working in production |
| `GV_SHEETS_API_KEY` | `app/api/public/gv`, `app/api/public/gv-history`, `app/api/user/gv-key` | Shared app-wide key. Auth layer verified working |
| `OPENWEATHER_KEY` | `lib/apis/openweather.ts` | Verified live in production |
| `WINDY_WEBCAM_KEY` | `lib/apis/windy.ts` | Verified live in production |
| `AISSTREAM_KEY` | `app/api/ships/route.ts` | Set, but `/api/ships` returns `connected:false` — worth a look |
| `ALPACA_API_KEY` | `app/api/sparkline/route.ts` | `/api/sparkline` currently returns empty for all tickers |
| `ALPACA_SECRET_KEY` | `app/api/sparkline/route.ts` | Same |
| `NEXT_PUBLIC_ALPACA_API_KEY` | `lib/hooks/useAlpacaStream.ts` | ⚠️ `NEXT_PUBLIC_` = **shipped to the browser**. See security note below |
| `NEXT_PUBLIC_ALPACA_SECRET_KEY` | `lib/hooks/useAlpacaStream.ts` | ⚠️ **A secret key exposed client-side.** See below |
| `RESEND_API_KEY` | `lib/resend.ts` | Email delivery |
| `VAPID_PUBLIC_KEY` | `lib/webpush.ts` | Web push |
| `VAPID_PRIVATE_KEY` | `lib/webpush.ts` | Web push |
| `VAPID_SUBJECT` | `lib/webpush.ts` | Web push |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `components/terminal/PushSubscribe.tsx` | Public by design — correct |

---

## ⚙️ AUTO-PROVIDED BY VERCEL — do not set manually

| Variable | Used in | Notes |
|---|---|---|
| `VERCEL_ENV` | `next.config.js:10` | Vercel injects at build. Copied into `NEXT_PUBLIC_DEPLOY_ENV` |
| `NEXT_PUBLIC_DEPLOY_ENV` | `lib/utils.ts:144` | **Derived** in `next.config.js` from `VERCEL_ENV` — never set by hand |
| `NODE_ENV` | `lib/prisma.ts`, `server.js` | Set by Next.js/Vercel |
| `PORT` | `server.js` | Custom server only — **local dev, not used on Vercel** |

---

## 🗑️ DEAD — in `.env.local`, referenced nowhere in code

Safe to delete locally; do not add to Vercel.

| Variable | Note |
|---|---|
| `ANTHROPIC_API_KEY` | Leftover from before the Gemini migration |
| `ALPHA_VANTAGE_KEY` | No `process.env` reference anywhere |
| `EIA_API_KEY` | No reference |
| `NEWSAPI_KEY` | Duplicate/typo of `NEWS_API_KEY` — the code only reads `NEWS_API_KEY` |
| `NEXT_PUBLIC_APP_NAME` | No reference |
| `NEXT_PUBLIC_PORT` | No reference |
| `DATABASE_URL` | In `.env`, but `schema.prisma` uses `POSTGRES_PRISMA_URL`. Keep only if a Prisma CLI workflow needs it |

---

## 🔐 Security note — `NEXT_PUBLIC_ALPACA_SECRET_KEY`

Any `NEXT_PUBLIC_` variable is **inlined into the JavaScript bundle and readable by every visitor**.
`lib/hooks/useAlpacaStream.ts` reads both the Alpaca key *and secret* this way, so your Alpaca API
secret is currently shipped to every browser that loads the app.

This wasn't in the production audit's scope, but it's the same class of problem as CRITICAL #1
(credentials/data reaching people who shouldn't have them). The usual fix is to proxy the Alpaca
WebSocket through a server route so the secret stays server-side. Flagging only — not fixing, per
your instruction.

---

## Vercel setup checklist

Set for **Production, Preview, and Development** unless noted.

```
# Database (from Neon)
POSTGRES_PRISMA_URL              ✅ have locally
POSTGRES_URL_NON_POOLING         ✅ have locally

# Auth
NEXTAUTH_SECRET                  ✅ have locally
NEXTAUTH_URL                     ⚠️  must be https://god-s-vision.vercel.app (NOT localhost)
GOOGLE_CLIENT_ID                 ⬜ optional — enables Google sign-in
GOOGLE_CLIENT_SECRET             ⬜ optional

# AI
GEMINI_API_KEY                   ✅ have locally

# Caching  ← fixes CRITICAL #7
UPSTASH_REDIS_REST_URL           🔴 placeholder — get real value from Upstash
UPSTASH_REDIS_REST_TOKEN         🔴 placeholder — get real value from Upstash

# Data providers
FRED_API_KEY                     🔴 placeholder — get free key at fred.stlouisfed.org  ← fixes CRITICAL #6
NEWS_API_KEY                     🔴 placeholder — newsapi.org
OPENWEATHER_KEY                  ✅ have locally
WINDY_WEBCAM_KEY                 ✅ have locally
AISSTREAM_KEY                    ✅ have locally
OPENSKY_USERNAME                 ⬜ missing — raises flights rate limit substantially
OPENSKY_PASSWORD                 ⬜ missing
ALPACA_API_KEY                   ✅ have locally
ALPACA_SECRET_KEY                ✅ have locally
NEXT_PUBLIC_ALPACA_API_KEY       ⚠️  browser-exposed
NEXT_PUBLIC_ALPACA_SECRET_KEY    ⚠️  browser-exposed — see security note

# Platform
NEXT_PUBLIC_BASE_URL             🔴 missing — set to https://god-s-vision.vercel.app

# Payments (all three needed for /pricing to work at all)
STRIPE_SECRET_KEY                ⬜ missing
STRIPE_WEBHOOK_SECRET            ⬜ missing
STRIPE_PRO_PRICE_ID              ⬜ missing

# Push + email
VAPID_PUBLIC_KEY                 ✅ have locally
VAPID_PRIVATE_KEY                ✅ have locally
VAPID_SUBJECT                    ✅ have locally
NEXT_PUBLIC_VAPID_PUBLIC_KEY     ✅ have locally
RESEND_API_KEY                   ✅ have locally
```

**Do NOT set:** `VERCEL_ENV`, `NEXT_PUBLIC_DEPLOY_ENV`, `NODE_ENV`, `PORT`.

### Tally

- **7 ready to copy across as-is**
- **4 placeholders to replace** (`FRED_API_KEY`, `NEWS_API_KEY`, both Upstash vars)
- **6 missing and needed** (`NEXT_PUBLIC_BASE_URL`, 3× Stripe, 2× OpenSky)
- **2 optional** (Google OAuth pair)
- **1 to correct on Vercel** (`NEXTAUTH_URL` must not be localhost)

> Note: after changing any env var on Vercel you must **redeploy** — env changes don't apply to an
> existing deployment. That matters doubly here, since several routes bake their data in at build
> time (CRITICAL #3 in the production report).

### Verifying afterwards

`vercel env ls` lists what's actually set per environment, and `vercel env pull` writes it to a
local file for diffing. The CLI isn't installed here — `npm i -g vercel` then `vercel login`.
