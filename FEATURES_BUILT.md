# Features Built — GOD's Vision v2.0

**Date:** 2026-07-04  
**Build:** 91 pages, 0 TypeScript errors, 0 build errors

---

## Feature 1 — Real-Time Stock Prices (Alpaca WebSocket)

### Files Created / Updated
- `lib/hooks/useAlpacaStream.ts` — **NEW**: WebSocket client for `wss://stream.data.alpaca.markets/v2/iex`. Handles `T:'q'` (quotes) and `T:'t'` (trades). Mid-price from bid/ask. Auto-reconnect with 5s backoff. prevClose fetched from prevclose API on mount.
- `lib/hooks/useFlash.ts` — **UPDATED**: Added `'use client'` directive, extended duration to 400ms. Flash direction (`'up'` | `'down'`) on price changes.
- `app/api/stocks/prevclose/route.ts` — **NEW**: Fetches `regularMarketPreviousClose` from yahoo-finance2. 4-hour in-memory cache keyed by sorted symbol list.
- `lib/utils/format.ts` — **UPDATED**: Added `fmtChange()` — formats price change as `+$1.23` / `-$0.45`.

### Environment Variables Required
```
NEXT_PUBLIC_ALPACA_API_KEY=PK6NMHGZWWAVKWD2UGGDU4DI72
NEXT_PUBLIC_ALPACA_SECRET_KEY=4DEUDv3xYNagJDngDqYhjqHyvb8jdG54mup8bh83Aung
ALPACA_API_KEY=PK6NMHGZWWAVKWD2UGGDU4DI72
ALPACA_SECRET_KEY=4DEUDv3xYNagJDngDqYhjqHyvb8jdG54mup8bh83Aung
```

---

## Feature 2 — User Accounts (NextAuth.js)

### Files Created / Updated
- `prisma/schema.prisma` — **REWRITTEN**: SQLite → PostgreSQL. Added User, Account, Session, VerificationToken models. Added `userId` to Watchlist, PortfolioHolding, PriceAlert, NewsAlert.
- `lib/prisma.ts` — **UPDATED**: Added log config (error/warn in dev, error only in prod).
- `lib/auth.ts` — **NEW**: NextAuth options — JWT strategy, PrismaAdapter, CredentialsProvider + conditional GoogleProvider. Callbacks propagate `id` and `plan` to JWT and session.
- `app/api/auth/[...nextauth]/route.ts` — **NEW**: NextAuth route handler.
- `app/api/auth/register/route.ts` — **NEW**: POST — validates email/password, bcrypt hashes (cost 12), creates user with `plan: 'free'`.
- `app/auth/signin/page.tsx` — **NEW**: Terminal-styled sign-in + register page. Two tabs, plan comparison table, IBM Plex Mono, CSS variables.
- `app/auth/error/page.tsx` — **NEW**: Terminal-styled auth error page with Suspense for `useSearchParams`.
- `components/providers/SessionProviderWrapper.tsx` — **NEW**: Client wrapper for NextAuth `SessionProvider`.
- `components/providers/Providers.tsx` — **UPDATED**: Added `SessionProviderWrapper` (outermost) and `LinkedPanelProvider`.
- `components/terminal/UserMenu.tsx` — **NEW**: Circle avatar with user initials (orange for PRO). Portal dropdown with Portfolio/Alerts/Settings/Upgrade/Sign Out. Sign-in link when logged out.
- `components/terminal/TopBar.tsx` — **UPDATED**: Added `UserMenu` as last element after clocks.
- `middleware.ts` — **NEW**: `withAuth` middleware protecting `/portfolio`, `/alerts`, `/settings` (auth required) and `/analyst`, `/insiders`, `/correlation`, `/centralbanks` (Pro redirect).

### Environment Variables Required
```
NEXTAUTH_SECRET=tDvfPMoOMIfzscihdEI0QURi75SE7eGmwoX7lfaiwvY=
POSTGRES_PRISMA_URL=postgresql://...
POSTGRES_URL_NON_POOLING=postgresql://...
# Optional:
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

---

## Feature 3 — Stripe Payments

### Files Created / Updated
- `lib/stripe.ts` — **NEW**: Lazy Stripe client (proxy pattern — initializes on first use, safe during build). `getStripe()` getter. `PLANS` object with Free and Pro features. `isPro()` helper.
- `app/api/stripe/checkout/route.ts` — **NEW**: POST — creates Stripe checkout session in subscription mode. Creates Stripe customer if none exists.
- `app/api/stripe/portal/route.ts` — **NEW**: POST — creates Stripe billing portal session for subscription management.
- `app/api/stripe/webhook/route.ts` — **NEW**: POST — handles `checkout.session.completed` (set plan: 'pro'), `customer.subscription.deleted` (set plan: 'free'), `invoice.payment_failed` (set plan: 'free'), `customer.subscription.updated` (sync plan).
- `app/pricing/page.tsx` — **NEW**: Standalone pricing page. Two-column Free vs Pro. Pro card with orange border. Checkout / Manage / Sign-in-to-upgrade buttons. Footer: "Cancel anytime · Secure payment via Stripe".
- `lib/planGate.ts` — **NEW**: `getUserPlan()`, `requirePro()`, `PRO_GATE_RESPONSE` for server-side plan checking.
- `components/ui/ProGate.tsx` — **NEW**: Orange-bordered Pro feature gate component with "UPGRADE TO PRO →" button.

### Routes with Pro Gates Added
- `app/api/analyst/route.ts` — HTTP 403 + upgrade URL for free users
- `app/api/narratives/route.ts` — HTTP 403 + upgrade URL for free users
- `app/api/india/indices/route.ts` — HTTP 403 + upgrade URL for free users
- `app/api/india/stocks/route.ts` — HTTP 403 + upgrade URL for free users
- `app/api/india/news/route.ts` — HTTP 403 + upgrade URL for free users

### Dashboard Updates
- `app/page.tsx` — Added `UpgradeBanner` component (dismissible for free users). Added `TickerLink` to market movers symbol cells.

### Environment Variables Required
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Feature 4 — Vercel Postgres / User Data Isolation

All watchlist, portfolio, and alert data is now scoped per userId:

- `app/api/watchlist/route.ts` — **REWRITTEN**: GET/POST/DELETE filter by `userId` from session. Upsert uses `userId_ticker` unique constraint.
- `app/api/portfolio/route.ts` — **UPDATED**: GET/POST/DELETE filter by `userId`.
- `app/api/alerts/route.ts` — **UPDATED**: GET/POST/DELETE filter by `userId`. Free plan limited to 2 active price alerts (HTTP 403 if exceeded).

---

## Feature 5 — Linked Panels

### Files Created / Updated
- `lib/context/LinkedPanelContext.tsx` — **NEW**: React context broadcasting `activeTicker` to all linked split panels. Default linked panels: `new Set(['p1','p2','p3','p4'])`. `togglePanelLink()` per panel.
- `components/ui/TickerLink.tsx` — **NEW**: Clickable span that calls `setActiveTicker(ticker)`. Orange color, underline on hover, supports `style` override.
- `components/terminal/TickerBroadcast.tsx` — **NEW**: Toast "⧉ LINKED PANELS → {ticker}" shown for 1500ms on ticker change. Fixed position, center-top, `fadeInOut` animation.
- `components/terminal/SplitLayout.tsx` — **UPDATED**: Each `PanelSlot` has a ⧉ link toggle button. Linked panels highlight their header border in orange. Pass `effectiveTicker` (activeTicker when linked) to module as `ticker` prop.
- `components/modules/index.ts` — **UPDATED**: Module type updated to `ComponentType<{ compact?: boolean; ticker?: string }>`.
- `app/layout.tsx` — **UPDATED**: Added `<TickerBroadcast />` inside Providers.
- `app/globals.css` — **UPDATED**: Added `@keyframes fadeInOut` for TickerBroadcast animation.

---

## TypeScript & Build Results

```
npx tsc --noEmit    → 0 errors
npm run build       → 91 pages, 0 errors
```

### Build Key
- `○ (Static)`  — prerendered as static content
- `ƒ (Dynamic)` — server-rendered on demand

### New Pages
| Page | Type | Notes |
|------|------|-------|
| `/auth/signin` | Static | Terminal sign-in + register |
| `/auth/error` | Static | Auth error page |
| `/pricing` | Static | Stripe pricing page |
| `/api/auth/[...nextauth]` | Dynamic | NextAuth handler |
| `/api/auth/register` | Dynamic | User registration |
| `/api/stripe/checkout` | Dynamic | Stripe checkout |
| `/api/stripe/portal` | Dynamic | Billing portal |
| `/api/stripe/webhook` | Dynamic | Stripe webhooks |
| `/api/stocks/prevclose` | Dynamic | Previous close cache |

---

## Setup Checklist (for first deployment)

1. **Add to `.env.local`**:
   - `POSTGRES_PRISMA_URL=postgresql://...` (from Vercel/Neon)
   - `POSTGRES_URL_NON_POOLING=postgresql://...`
   - `STRIPE_SECRET_KEY=sk_live_...`
   - `STRIPE_PRO_PRICE_ID=price_...`
   - `STRIPE_WEBHOOK_SECRET=whsec_...`

2. **Run migrations**:
   ```bash
   npx prisma migrate deploy
   # or for fresh DB:
   npx prisma db push
   ```

3. **Stripe webhook**: Register `https://yourdomain.com/api/stripe/webhook` in Stripe dashboard for events: `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_failed`, `customer.subscription.updated`

4. **Optional**: Add `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` for Google OAuth
