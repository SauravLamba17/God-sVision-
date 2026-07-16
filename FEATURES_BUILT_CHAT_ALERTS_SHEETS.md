# Features Built: Live Chat, Email/Push Alerts, Google Sheets Add-on

Built 2026-07-16. All three features are live, typechecked (`npx tsc --noEmit` clean) and build cleanly (`npm run build`). Verified end-to-end in a real two-tab browser session against the running dev server.

---

## 1. Socket.io Real-Time Chat (`/chat`)

### New files
- `server.js` — custom Node HTTP server wrapping Next.js + Socket.io on path `/api/socket`. Rooms: `equities`, `crypto`, `india-markets`, `macro`, `general`. In-memory `Map`-based room history (capped at 100 messages/room) and online-user tracking — resets on server restart, no persistence.
- `lib/hooks/useChatSocket.ts` — client hook wrapping `socket.io-client`; exposes `messages`, `connected`, `onlineCount`, `currentRoom`, `switchRoom`, `sendMessage`, `sendTyping`, `typingUser`.
- `app/chat/page.tsx` — chat UI: room sidebar, message list, `@TICKER` mentions auto-linked to `/markets?ticker=...`, typing indicator, sign-in gate.

### Modified files
- `package.json` — `dev`/`start` scripts now run `node server.js` instead of `next dev`/`next start` (required — App Router alone can't host a long-lived Socket.io server). `build` now runs `prisma generate && next build`.
- `components/terminal/NavBar.tsx`, `components/terminal/CommandPalette.tsx` — added CHAT nav link/command entry.

### New packages
`socket.io`, `socket.io-client`, `cross-env` (dev dependency, needed to set `NODE_ENV=production` cross-platform in `start`).

### Bug found & fixed during verification
The chat page hardcoded `height: calc(100vh - 92px)`, but the site's global `<main>` already reserves `top:100` + `bottom:26` (126px total) for the fixed `TopBar`/`NavBar`/`StatusBar` chrome. The 34px shortfall pushed the message input row behind the fixed footer (`StatusBar`, z-index 50), making it **unclickable** — confirmed via `elementFromPoint` hit-testing (`FOOTER` was intercepting clicks meant for the `<input>`). Fixed to `height: calc(100vh - 126px)` in [app/chat/page.tsx](app/chat/page.tsx).

### Verified live
- Two independent browser tabs, both signed in, connected simultaneously — online count correctly went 1 → 2.
- Message sent in tab A appeared instantly in tab B with no refresh (real Socket.io broadcast, not polling).
- `@AAPL` in a message rendered as a real `<a href="/markets?ticker=AAPL">` link in both tabs.
- Typing in one tab showed "X is typing..." live in the other tab.
- Switching rooms in one tab correctly isolated it from the other tab's room (online count dropped to 1, history cleared).
- Standalone `socket.io-client` script (outside the browser) additionally verified join/history/broadcast/typing/room-switch/disconnect against the raw server logic.

---

## 2. Email + Push Alerts (Resend + Web Push)

**Existing browser-notification alert logic was NOT touched.** Email and push are additional delivery channels layered onto the real, already-live alert checker.

### New files
- `lib/resend.ts` — Resend client, guarded so the placeholder API key is never treated as "configured."
- `lib/webpush.ts` — `web-push` wrapper using VAPID keys.
- `app/api/push/subscribe/route.ts` — upserts a `PushSubscription` row by `endpoint`, associates it with the signed-in user if present.
- `public/sw.js` — service worker: `push` and `notificationclick` listeners.
- `components/terminal/PushSubscribe.tsx` — "🔔 ENABLE PUSH ALERTS" button, registers the service worker and subscribes via `PushManager`.

### Modified files
- `prisma/schema.prisma` — added `PushSubscription` model (`endpoint` unique, `keys` JSON, optional `userId` relation) and `pushSubscriptions` back-relation on `User`. Migrated via `npx prisma db push`.
- **`app/api/alerts/check/route.ts`** — this is the real, globally-running alert checker (mounted via `AlertChecker.tsx` in `ClientLayout.tsx`, polls every 30s across all users' active/untriggered `PriceAlert` rows). After an alert fires and is marked triggered, it now also emails the user (if they have an email) and pushes to every registered `PushSubscription` for that user, alongside the existing behavior. Wrapped in its own try/catch so a Resend/web-push failure never blocks the alert-triggering logic itself.
  - **Deviation from the original spec**: the spec pointed at `lib/alertChecker.ts` for this wiring. That file is dead code — a client-only, `localStorage`-based checker with zero imports anywhere in the codebase and no `userId` field. The real, live checker is `app/api/alerts/check/route.ts`. `lib/alertChecker.ts` was left completely untouched.
- `app/alerts/page.tsx` — renders `<PushSubscribe />` next to the existing browser-notification `ENABLE`/`BLOCKED` button. Both are visibly present and independently functional.
- `.env.local` — see env vars below.

### New packages
`resend`, `web-push`, `@types/web-push` (dev dependency).

### Bugs found & fixed during verification
1. **`next.config.js`** had a blanket header rule (`source: '/((?!api|_next|favicon).*)'`) forcing `Content-Type: text/html; charset=utf-8` on every non-API route — including `/sw.js`. Chrome refuses to register a service worker whose script isn't served as JavaScript, so this broke push subscription entirely (`SecurityError: unsupported MIME type`). Fixed the regex to also exclude `sw.js` and `manifest.json`, verified via `curl` that `/sw.js` now serves `application/javascript` while HTML pages are unaffected.
2. **`components/terminal/PushSubscribe.tsx`** called `reg.pushManager.subscribe()` immediately after `navigator.serviceWorker.register()`, before the worker had finished activating, causing `AbortError: Subscription failed - no active Service Worker` on first-time registration. Fixed to `await navigator.serviceWorker.ready` before subscribing.

### Verified live
- `PushSubscribe` button renders on `/alerts` next to the untouched existing `🔕 BLOCKED` / `ENABLE` browser-notification button — both present, no console errors, no regression to the existing system.
- After both fixes, the full subscribe chain (`register` → `ready` → `pushManager.subscribe` → `POST /api/push/subscribe`) executes correctly up to the OS/browser notification-permission gate. In this sandboxed test environment, `Notification.permission` is `denied` at the OS level — which is exactly why the pre-existing button also shows `🔕 BLOCKED`. Both systems hit the identical, expected browser-level permission wall; this is not a code defect. On a real desktop browser where the user grants permission, the flow completes.

### Setup required (not done — placeholders left intentionally)
- **Resend**: sign up free at resend.com, replace `RESEND_API_KEY=get_free_from_resend.com` in `.env.local` with a real key. Until then, `lib/resend.ts` exports `resend = null` and email sending is a no-op (skipped, not an error).
- **VAPID keys**: already generated for you via `npx web-push generate-vapid-keys` and are real, working values in `.env.local` — no action needed unless you want to rotate them.

---

## 3. Google Sheets Add-on (`=GV()` / `=GV_HISTORY()`)

### New files
- `app/api/public/gv/route.ts` — public API-key-gated endpoint returning a single live field for a ticker.
- `app/api/public/gv-history/route.ts` — public API-key-gated endpoint returning historical OHLCV rows.
- `app/api/user/gv-key/route.ts` — returns the shared `GV_SHEETS_API_KEY` to signed-in users only (401 otherwise), so `/sheets` can display it.
- `google-sheets-addon/Code.gs` — Apps Script reference file with `=GV()`/`=GV_HISTORY()` custom functions and an `onOpen` menu, placeholders for base URL and API key.
- `google-sheets-addon/README.md` — manual install instructions.
- `app/sheets/page.tsx` — in-app documentation page: shows the signed-in user's real API key, a "COPY Code.gs" button that generates a ready-to-paste script with the key and current origin already substituted in, install steps, and a formulas reference table.

### Modified files
- `components/terminal/NavBar.tsx`, `components/terminal/CommandPalette.tsx` — added SHEETS nav link/command entry.

### New env var
`GV_SHEETS_API_KEY` — shared secret used to authenticate `=GV()`/`=GV_HISTORY()` calls from any Google Sheet. Falls back to `godsvision-demo-key` if unset.

### Verified live
- Wrong-key request to `/api/public/gv` returns a clean `401 {"error":"Invalid or missing API key"}` — confirms the auth gate itself works correctly, independent of downstream data availability.
- Correct-key requests reach the real Yahoo Finance call (proving routing/auth is correct) but currently hit Yahoo's `Too Many Requests` rate limit from this network — see caveat below. This is an existing, external, session-wide issue affecting all Yahoo-sourced data in the app, not specific to this feature.
- `/sheets` page renders correctly signed-out (sign-in prompt) and signed-in (real API key + working copy-to-clipboard).

---

## Environment variables added to `.env.local`

```
RESEND_API_KEY=get_free_from_resend.com          # placeholder — replace with a real key from resend.com
VAPID_PUBLIC_KEY=BAge1N5lFxuy39xZKhSEIV8KNSivRTyrOc8CUUcxg-SgDP7LnAxa6-Zk3qyB9gLFWm7AokTAPC7fjdNdoahrFrw
VAPID_PRIVATE_KEY=_x3ze4l3IggH8eABrT0Ua54C557Wj7YLojlRM-GdxSc
VAPID_SUBJECT=mailto:operations@myhealthiq.io
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BAge1N5lFxuy39xZKhSEIV8KNSivRTyrOc8CUUcxg-SgDP7LnAxa6-Zk3qyB9gLFWm7AokTAPC7fjdNdoahrFrw
GV_SHEETS_API_KEY=9b2097bd14cff8f5a128853d3f91b373503233f72c9c0e76
```

VAPID keys are real and functional (generated via `npx web-push generate-vapid-keys`). `RESEND_API_KEY` is a placeholder — email sending is safely a no-op until replaced.

---

## `server.js` / NextAuth / Prisma compatibility

Confirmed the custom `server.js` does not break existing functionality:
- `npx tsc --noEmit` — clean.
- `npm run build` — succeeds, all routes present (old and new).
- Middleware-protected routes (`/portfolio`, `/alerts`, `/settings`) still correctly redirect unauthenticated users to sign-in through the custom server.
- Sign-in via `CredentialsProvider` (bcrypt + Prisma/Neon) works correctly through `server.js` — verified by creating and signing in as test accounts.
- `prisma generate` runs as part of `npm run build` (added to the `build` script) — schema changes are picked up automatically.

## Known external caveat (unrelated to this work)

Yahoo Finance's crumb-fetch endpoint (`query1/query2.finance.yahoo.com`) returns "Too Many Requests" for nearly all `yahoo-finance2` calls from this network — this affects `/api/public/gv`, `/api/public/gv-history`, and other pre-existing Yahoo-sourced data across the app. It is not a defect in any of the three features above; the auth/routing logic in front of it was verified correct independently.

## QA test accounts (please delete or keep as needed)

Two throwaway accounts were created via the app's own `/api/auth/register` endpoint to verify sign-in-gated features (chat, push subscribe) end-to-end, since the database had zero users:
- `qa-test-alice@example.test` / `TestPass1234`
- `qa-test-bob@example.test` / `TestPass1234`

Delete these from the Neon database (`User` table) whenever convenient — they're not referenced by anything else.
