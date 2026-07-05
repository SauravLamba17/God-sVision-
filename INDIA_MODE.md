# INDIA MODE — GOD's Vision Terminal
> Port 3001 · Next.js 14 · India toggle documentation
> Last updated: 2026-06-28

---

## Overview

India Mode is a global terminal mode switch that transforms GOD's Vision from a
USA-centric Bloomberg terminal into an India-centric financial intelligence platform.

**Toggle:** Click the 🇮🇳 INDIA button in the NavBar, or press **Ctrl+Shift+I**

**Persistence:** Mode saved in `localStorage` key `gv_terminal_mode` — survives page refresh

---

## Architecture

### Global Mode Context

**File:** `lib/context/ModeContext.tsx`

Provides `useMode()` hook to any component:

```typescript
const {
  mode,            // 'USA' | 'INDIA'
  isIndia,         // boolean
  currencySymbol,  // '$' | '₹'
  timezone,        // 'America/New_York' | 'Asia/Kolkata'
  timezoneLabel,   // 'ET' | 'IST'
  exchangeRate,    // live USD/INR rate (from ExchangeRate-API)
  formatCurrency,  // converts USD → INR in India mode (lakhs/crores)
  formatTime,      // time in correct timezone
  formatDate,      // date in correct locale
  toggleMode,      // flip between USA and INDIA
} = useMode()
```

The `ModeProvider` wraps the entire app in `app/layout.tsx`.

---

## Indian Data Sources

### 1. Stock Indices

| Index         | Yahoo Finance Ticker | Exchange |
|---------------|---------------------|----------|
| NIFTY 50      | `^NSEI`             | NSE      |
| SENSEX        | `^BSESN`            | BSE      |
| BANK NIFTY    | `^NSEBANK`          | NSE      |
| NIFTY IT      | `NIFTYIT.NS`        | NSE      |
| NIFTY MIDCAP  | `^NSMIDCP`          | NSE      |
| INDIA VIX     | `^INDIAVIX`         | NSE      |

**API:** `GET /api/india/indices`  
**Cache:** 30s during market hours, 5 min otherwise  
**Source:** Yahoo Finance query1 v8 chart endpoint (no auth needed)

### 2. Nifty 50 Stocks (all 50)

All use `.NS` suffix = NSE-listed. Yahoo Finance returns prices in INR natively.

**Tickers:** `RELIANCE.NS TCS.NS HDFCBANK.NS INFY.NS HINDUNILVR.NS ICICIBANK.NS KOTAKBANK.NS LT.NS SBIN.NS BHARTIARTL.NS` + 40 more (see `lib/apis/india.ts: NIFTY50_STOCKS`)

**API:** `GET /api/india/stocks` — returns quotes, gainers, losers, active  
**API:** `GET /api/india/stocks/movers` — top 10 gainers/losers/active  
**Cache:** 30s during market hours  
**Note:** `.NS` stocks priced in INR by Yahoo Finance — no conversion needed

### 3. Cryptocurrency (INR)

**Source:** CoinGecko Free API with `vs_currency=inr`  
**API:** `GET /api/india/crypto`  
**Cache:** 15 seconds

Coins tracked: BTC, ETH, MATIC (🇮🇳 Polygon — Indian project), SOL, XRP, ADA, DOGE, SHIB, LINK, DOT, BNB, AVAX, UNI, TRX

CoinGecko returns INR prices directly — no conversion needed.

**Indian exchanges shown:** WazirX, CoinDCX, ZebPay (display labels only)

**Tax note displayed:** "30% flat tax + 1% TDS on crypto gains (India)"

### 4. Forex (INR pairs)

| Pair    | Ticker        |
|---------|---------------|
| USD/INR | `USDINR=X`    |
| EUR/INR | `EURINR=X`    |
| GBP/INR | `GBPINR=X`    |
| JPY/INR | `JPYINR=X`    |
| AUD/INR | `AUDINR=X`    |
| CAD/INR | `CADINR=X`    |
| CHF/INR | `CHFINR=X`    |
| CNY/INR | `CNYINR=X`    |
| SGD/INR | `SGDINR=X`    |
| AED/INR | `AEDINR=X`    |

**API:** `GET /api/india/forex`  
**Cache:** 60 seconds  
**Note:** Live USD/INR rate also fetched from ExchangeRate-API as backup

### 5. MCX Commodities (₹)

| Commodity | Base Ticker | Unit    | Conversion Formula |
|-----------|-------------|---------|-------------------|
| Gold      | `GC=F`      | ₹/10g   | USD/troy oz × 31.1035 × rate / 10 |
| Silver    | `SI=F`      | ₹/kg    | USD/troy oz × 32.1507 × rate |
| Crude Oil | `CL=F`      | ₹/bbl   | USD × rate |
| Nat Gas   | `NG=F`      | ₹/MMBtu | USD × rate |
| Copper    | `HG=F`      | ₹/kg    | USD/lb × rate × 2.20462 |

**API:** `GET /api/india/commodities`  
**Cache:** 30 seconds

### 6. Macro Data

**API:** `GET /api/india/macro`  
**Cache:** 1 hour (data changes slowly — RBI meets 6x/year)

**Static data in:** `lib/apis/india.ts: INDIA_MACRO`

**To update when RBI changes rates:**
1. Open `lib/apis/india.ts`
2. Update `INDIA_MACRO.repoRate` (currently 6.50%)
3. Update `INDIA_MACRO.reverseRepoRate` (currently 3.35%)
4. Update `RBI_MPC_MEETINGS` array — add the new meeting date
5. Optionally update `FII_DII_DATA` from NSE daily press release

**Current values (as of Jun 2026):**

| Indicator      | Value  |
|----------------|--------|
| Repo Rate      | 6.50%  |
| Reverse Repo   | 3.35%  |
| CRR            | 4.50%  |
| SLR            | 18.00% |
| GDP Growth     | 7.6%   |
| CPI Inflation  | 4.85%  |
| WPI Inflation  | 0.53%  |
| IIP Growth     | 5.0%   |
| Fiscal Deficit | 5.1% GDP |
| Current Acct   | -1.3% GDP |
| Forex Reserves | $616.1B |
| Gross NPA      | 3.9%   |
| Unemployment   | 7.8%   |

### 7. India G-Sec Yield Curve (static — update quarterly)

In `lib/apis/india.ts: INDIA_YIELD_CURVE`:

| Tenor     | Yield |
|-----------|-------|
| Overnight | 6.50% |
| 91D T-Bill| 6.65% |
| 182D      | 6.72% |
| 364D      | 6.78% |
| 2Y G-Sec  | 6.82% |
| 5Y G-Sec  | 6.92% |
| 10Y G-Sec | 7.10% |
| 30Y G-Sec | 7.35% |

Update from: RBI website → Publications → G-Sec yields

### 8. India News RSS Feeds

**API:** `GET /api/india/news`  
**Cache:** 5 minutes

| Source                 | RSS URL |
|------------------------|---------|
| Economic Times Markets | `economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms` |
| Economic Times         | `economictimes.indiatimes.com/rssfeedstopstories.cms` |
| Business Standard      | `business-standard.com/rss/markets-106.rss` |
| Livemint               | `livemint.com/rss/markets` |
| Financial Express      | `financialexpress.com/market/feed/` |
| NDTV Profit            | `feeds.feedburner.com/ndtvprofit-latest` |
| The Hindu Business     | `thehindu.com/business/feeder/default.rss` |

**Known limitations:** Some RSS feeds (Moneycontrol, BQ Prime) return 403/blocked for server-side requests. The route gracefully skips failed feeds and combines the rest.

---

## RBI MPC Meeting Schedule

Configured in `lib/apis/india.ts: RBI_MPC_MEETINGS`. Update when RBI publishes new calendar:

```typescript
export const RBI_MPC_MEETINGS = [
  { date: '2025-08-06', resolution: '2025-08-08', decision: 'PENDING' },
  { date: '2025-10-07', resolution: '2025-10-09', decision: 'PENDING' },
  ...
]
```

---

## India Market Hours (NSE/BSE)

Function: `lib/apis/india.ts: getIndianMarketStatus()`

| Status      | IST Time Window |
|-------------|-----------------|
| CLOSED      | Weekends or before 9:00 AM |
| PRE-OPEN    | 9:00 AM – 9:15 AM |
| OPEN        | 9:15 AM – 3:30 PM |
| AFTER-HOURS | 3:30 PM – 4:00 PM |
| CLOSED      | After 4:00 PM |

---

## Components Modified for India Mode

| Component | Change |
|-----------|--------|
| `app/layout.tsx` | Wrapped with `<ModeProvider>` |
| `components/terminal/NavBar.tsx` | ModeToggle button added; accent color changes to saffron |
| `components/terminal/TopBar.tsx` | Flag emoji, IST clock first, saffron brand in India mode |
| `components/terminal/StatusBar.tsx` | Shows "🇮🇳 IN MARKETS" + live USD/INR rate |
| `app/page.tsx` | Complete India dashboard: Nifty cards, Nifty heatmap, FII/DII, India news |

## New Components

| Component | Purpose |
|-----------|---------|
| `lib/context/ModeContext.tsx` | Global mode state, currency/timezone helpers |
| `components/terminal/ModeToggle.tsx` | Toggle button + animated mode switch overlay |
| `components/panels/RBIPolicyTracker.tsx` | RBI repo rate, next MPC, rate history |
| `components/panels/FIIDIIFlow.tsx` | FII/DII daily and YTD flow monitor |
| `components/panels/NiftyHeatmap.tsx` | Sector-wise Nifty 50 heatmap (green/red tiles) |

## New API Routes

| Route | Data | Cache |
|-------|------|-------|
| `GET /api/india/indices` | 6 Indian indices with sparklines | 30s/5min |
| `GET /api/india/stocks` | All 50 Nifty stocks | 30s |
| `GET /api/india/stocks/movers` | Top 10 gainers/losers/active | 30s |
| `GET /api/india/crypto` | 13 coins vs INR (CoinGecko) | 15s |
| `GET /api/india/forex` | 10 INR forex pairs | 60s |
| `GET /api/india/macro` | RBI rates, GDP, CPI, MPC schedule | 1hr |
| `GET /api/india/commodities` | MCX commodities in ₹ | 30s |
| `GET /api/india/news` | Indian market news from 7 RSS feeds | 5min |

---

## Known Limitations

1. **NSE API blocked server-side:** NSE India's direct API (`nseindia.com/api/*`) blocks non-browser requests with Cloudflare challenge. Using Yahoo Finance for all Nifty data instead.

2. **FII/DII data is static:** The `FII_DII_DATA` in `lib/apis/india.ts` uses manually-entered values from the NSE daily press release. Update by editing those constants.

3. **NIFTY IT ticker:** `NIFTYIT.NS` may not always return data from Yahoo Finance (sector indices are less reliable than main indices). This is a Yahoo Finance limitation.

4. **USD/INR rate:** The ExchangeRate-API free tier has rate limits. Fallback is 83.5 INR/USD. The actual rate is fetched every 10 minutes in the client context.

5. **Some RSS feeds return 403:** Moneycontrol and BQ Prime block server-side RSS fetches. Working feeds: Economic Times, Business Standard, Livemint, Financial Express.

6. **India mode pages not yet updated:** The following pages are identified for future India mode treatment but remain in USA mode for now:
   - `app/markets/page.tsx` — still defaults to US stocks
   - `app/crypto/page.tsx` — still shows USD prices
   - `app/forex/page.tsx` — still USD-centric
   - `app/macro/page.tsx` — still shows FRED/US data
   - `app/news/page.tsx` — still shows global news
   - `app/weather/page.tsx` — still shows US cities

---

## How to Update Static Data

### When RBI changes repo rate:
```bash
# 1. Edit lib/apis/india.ts
INDIA_MACRO.repoRate = X.XX  # new rate
INDIA_MACRO.reverseRepoRate = Y.YY  # usually repo - 3.15

# 2. Add new MPC meeting entry to RBI_MPC_MEETINGS
# 3. Update rateHistory in /api/india/macro/route.ts
```

### When FII/DII changes meaningfully:
```bash
# Edit lib/apis/india.ts
FII_DII_DATA.fiiNetEquity = XXXX  # from NSE press release
FII_DII_DATA.lastUpdated = 'YYYY-MM-DD'
```

### When G-Sec yields shift:
```bash
# Edit lib/apis/india.ts: INDIA_YIELD_CURVE
# Source: RBI website or Bloomberg India G-Sec page
```
