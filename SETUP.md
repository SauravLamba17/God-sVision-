# GOD's VISION — Financial Intelligence Terminal
## Setup Guide

### Step 1: Get Free API Keys

| Service | URL | Key Variable | Notes |
|---|---|---|---|
| Alpha Vantage | https://www.alphavantage.co/support/#api-key | ALPHA_VANTAGE_KEY | 25 req/day free |
| FRED (St. Louis Fed) | https://fred.stlouisfed.org/docs/api/api_key.html | FRED_API_KEY | Free, unlimited |
| EIA (Energy) | https://www.eia.gov/opendata/register.php | EIA_API_KEY | Free |
| NewsAPI | https://newsapi.org/register | NEWS_API_KEY | 100 req/day free |
| OpenWeatherMap | https://openweathermap.org/api | OPENWEATHER_KEY | 1,000 req/day free |
| Windy Webcams | https://api.windy.com/webcams | WINDY_WEBCAM_KEY | Free tier available |

### Step 2: Configure Environment

Edit `.env.local` and replace `your_*_key_here` with your actual keys.

### Step 3: Install & Run

```bash
# Install dependencies (already done if you're reading this)
npm install

# Initialize the SQLite database
npx prisma db push

# Generate Prisma client
npx prisma generate

# Start the development server on port 3001
npm run dev
```

Then open: http://localhost:3001

### Step 4: Keyboard Shortcuts

| Key | Module |
|---|---|
| F1 | Dashboard |
| F2 | Markets |
| F3 | Crypto |
| F4 | Forex |
| F5 | Macro |
| F6 | Commodities |
| F7 | News |
| F8 | World Map |
| F9 | Live Cameras |
| F10 | Flights |
| F11 | Weather |
| F12 | Sports |

### APIs That Work Without Keys

- CoinGecko — crypto prices
- ExchangeRate-API — forex rates
- OpenSky — live flight tracking
- USGS — earthquakes
- Open-Meteo — weather (backup)
- Binance — crypto ticker
- TheSportsDB — sports scores
- OpenF1 — Formula 1
- NASA EPIC — Earth imagery
- CartoDB tiles — map tiles
- disease.sh — health data
- DeFiLlama — DeFi TVL
- HackerNews — tech news
- Reddit — public posts
- TfL — London traffic cams

### Optional: Deploy to Vercel

```bash
npm run build
npx vercel --prod
```

Note: SQLite won't work on Vercel. For production, switch to PostgreSQL (free on Supabase or Railway) and update the Prisma schema datasource.

### Architecture Notes

- All API calls are proxied through Next.js `/api` routes (CORS-safe)
- In-memory caching prevents rate limit hits during refresh cycles
- Real-time updates via `setInterval` polling (not WebSocket for most data)
- SQLite stores watchlists, portfolio, and alerts locally
- Map and chart components use dynamic imports (no SSR) for browser-only libraries
