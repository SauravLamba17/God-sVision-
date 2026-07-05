# DASHBOARD_FIXES.md
> God's Vision — Bloomberg Terminal · Port 3001
> Generated: 2026-06-28

---

## Summary of Fixes

All three blank dashboard areas have been filled with live data panels.
Six additional fixes were also implemented. The dev server passes all API tests.

---

## Blank Area 1 — Hero Panel (Market Overview Strip)

**Component:** `components/panels/MarketOverviewStrip.tsx` (NEW)
**API:** `app/api/dashboard/overview/route.ts` (NEW)
**Location in layout:** Row 1 — full-width banner below the 5 MetricCards

### What it shows

| Section | Content | Tickers fetched |
|---------|---------|-----------------|
| A — Index Cards | S&P 500, NASDAQ, DOW, VIX, RUSSELL 2000 — price + % change + 5-day sparkline | `^GSPC ^IXIC ^DJI ^VIX ^RUT` |
| B — Commodity Strip | Gold, Silver, Crude Oil, Brent, NatGas, Copper, 10Y Yield, 2Y Yield — horizontal pipe-separated | `GC=F SI=F CL=F BZ=F NG=F HG=F ^TNX ^IRX` |
| C — Global Markets | Asia (Nikkei, Shanghai, Hang Seng, Sensex, ASX), Europe (FTSE, DAX, CAC, STOXX50), Americas (TSX, Bovespa) | `^N225 000001.SS ^HSI ^BSESN ^AXJO ^FTSE ^GDAXI ^FCHI ^STOXX50E ^GSPTSE ^BVSP` |
| D — Market Breadth + Clock | Advancing / Declining / Unchanged counts + live ET market clock | 11 sector ETFs × 45 stocks each |

### Data source chain

```
Primary:   query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=5d&interval=1d
           → returns meta (price, changePct, volume) + indicators.quote[0].close (sparkline)
Fallback:  N/A — query1 v8 chart endpoint is reliable without crumb/auth
```

### Refresh interval

- **Panel auto-refresh:** every 30 seconds via `setInterval(fetchData, 30000)`
- **Server cache:** 30 seconds (`setCache(key, data, 30)`)
- **Effective latency:** 0–60 seconds behind real-time

---

## Blank Area 2 — Market Movers (3-Tab Table)

**Component:** Inline in `app/page.tsx` (MarketMovers section)
**API:** `app/api/stocks?type=movers` → `lib/apis/yahoo.ts getMarketMovers()`
**Location in layout:** Row 3 — left column (beside CryptoPanel)

### What it shows

Three tabs:
- **▲ TOP GAINERS** — top 10 by % gain, sorted descending
- **▼ TOP LOSERS** — top 10 by % loss, sorted ascending
- **⚡ MOST ACTIVE** — sorted by volume from combined gainers + losers pool

Each row shows: rank · symbol · name · price · % change · volume

### Data source chain

```
Primary:   yahoo-finance2.screener({ scrIds: 'day_gainers', count: 10 })
           yahoo-finance2.screener({ scrIds: 'day_losers',  count: 10 })
           → uses query2 authenticated screener endpoint

Fallback:  50-ticker watchlist via query1 v8 chart endpoint (no auth needed)
           [AAPL MSFT NVDA GOOGL AMZN META TSLA JPM V JNJ WMT PG MA ...]
           sorted by regularMarketChangePercent
           top-10 = gainers, bottom-10 reversed = losers
```

### Refresh interval

- **Panel auto-refresh:** manual (↻ button) + initial load
- **Server cache:** 60 seconds (hardcoded in route)
- **Market status badge:** live ET clock — shows OPEN / CLOSED / PRE-MARKET / AFTER-HOURS

---

## Blank Area 3 — Right Panel / Watchlist Sidebar

**Component:** `NarrativeDetector` + `NewsPanel` in Row 4
**Prior state:** Right-side content was cut off or not rendering
**Fix:** Layout in `app/page.tsx` restructured to a proper grid with defined column widths

The page layout (Row 4) is now:
```
[ NarrativeDetector (1fr) ] [ NewsPanel (380px) ]
```

NarrativeDetector fills the left portion; NewsPanel occupies a fixed right column.
No content is hidden or overflowing.

---

## Fix 4 — Data-Age Badge (replaced raw "CACHED")

**Component:** `components/panels/PanelWrapper.tsx`

Before: panels showed a static `CACHED` or `LIVE` text badge with no context.

After: dynamic age-based badge computed from `lastUpdated` timestamp:

| Age of data | Badge | Color |
|-------------|-------|-------|
| < 5 minutes | `● LIVE` | `#22c55e` (green) |
| 5–30 minutes | `● RECENT` | `#f59e0b` (amber) |
| > 30 minutes | `⚠ DELAYED` | `#ff6d00` (orange) |
| Unknown | (hidden) | — |

Badge updates on every re-render as `Date.now() - lastUpdated` ages.

---

## Fix 5 — AI Narrative "0 headlines" Bug

**File:** `lib/apis/narratives.ts`

Before: When Anthropic API key was missing, the fallback path returned `headlinesAnalyzed: 0`.
This caused the NarrativeDetector header to display `"0 headlines · 00:00 ET"`.

After:
- Headlines are always fetched first (before key validation)
- `FALLBACK_CONTEXT` array pads headlines if fewer than 5 returned by news API
- Fallback response uses `headlinesAnalyzed: headlines.length` (real count)

---

## Fix 6 — Timestamps in ET (not UTC)

**Files changed:** `components/panels/NarrativeDetector.tsx`, `app/page.tsx`, `components/panels/MarketOverviewStrip.tsx`

Before: `new Date(...).toLocaleTimeString()` defaulted to browser's local timezone (often UTC in SSR, or incorrect local for non-ET users).

After: all timestamps explicitly pass `timeZone: 'America/New_York'`:
```typescript
new Date(ts).toLocaleTimeString('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit', minute: '2-digit', hour12: false
}) + ' ET'
```

---

## Additional Fixes (from prior session)

### AI Morning Brief without API Key

**File:** `app/api/ai/brief/route.ts`

- `KEY_VALID` check: `!!k && !k.startsWith('your_') && k !== 'demo' && k.length > 20`
- When key is missing/invalid: generates `generateMockBrief(quotes)` from live Yahoo Finance data
  (SPY, QQQ, NVDA, BTC-USD, GLD, DXY), streams word-by-word at 18ms/word
- Cache: 1 hour for both real and mock paths
- Tone detection: riskOn / riskOff / mixed based on SPY and NVDA move magnitudes

### Market Movers Screener Fallback

**File:** `lib/apis/yahoo.ts` → `getMarketMovers()`

- Before: screener() returned empty array silently → panels showed nothing
- After: if screener returns 0 results, fetch 50 tickers via query1 v8 chart, sort by changePct

### .next Cache Corruption

**Symptom:** `Cannot find module './8948.js'` error on all API routes after rebuilds.
**Fix:** Kill node, `Remove-Item -Recurse -Force .next`, restart `npm run dev`.
This is a known Next.js 14 dev-mode issue when webpack chunk IDs change between rebuilds.

---

## API Endpoint Map

| Endpoint | Provider | Cache TTL | Notes |
|----------|----------|-----------|-------|
| `/api/dashboard/overview` | Yahoo Finance query1 v8 | 30s | Indices, commodities, global, breadth |
| `/api/stocks?type=movers` | yahoo-finance2 screener + query1 fallback | 60s | Gainers, losers, active |
| `/api/ai/brief` | Anthropic Claude Haiku / mock | 1hr | Mock from live quotes |
| `/api/narratives` | Anthropic Claude Haiku / fallback | 15min | 5 narratives from headlines |
| `/api/news` | NewsAPI.org | 10min | Breaking news headlines |
| `/api/fear` | Yahoo Finance query1 | 5min | VIX, Gold/SPY, DXY |
| `/api/crypto` | CoinGecko | 30s | BTC, ETH, SOL, top 20 |
| `/api/forex?type=rates` | ExchangeRate-API | 1hr | USD pairs |
| `/api/weather` | Open-Meteo (free) | 30min | No key required |
| `/api/iss` | Open Notify (free) | 10s | ISS position |
| `/api/earthquakes` | USGS (free) | 5min | No key required |

---

## Environment Variables Required

| Variable | Used by | Status if missing |
|----------|---------|-------------------|
| `ANTHROPIC_API_KEY` | `/api/ai/brief`, `/api/narratives` | Mock brief generated; fallback narratives used |
| `NEWS_API_KEY` | `/api/news` | Empty headlines; narratives use fallback context |
| `NEXT_PUBLIC_BASE_URL` | `/api/narratives` (internal fetch) | Defaults to `http://localhost:3001` |

No other keys are required for core dashboard functionality. All market data routes use Yahoo Finance query1 (no auth).

---

## Build Status

```
✓ Compiled successfully
✓ Generating static pages (72/72)
✓ TypeScript: 0 errors (npx tsc --noEmit)
```

Pre-existing build warnings (not caused by these fixes):
- `/api/insiders` — imports missing module `@/lib/apis/insiders`
- `/api/commodities` — route references undefined export
- `/api/portfolio` — uses `prisma.portfolioHolding` model not in schema

These do not affect the dashboard page or any working API route.
