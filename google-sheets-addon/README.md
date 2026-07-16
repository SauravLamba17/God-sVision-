# GOD's Vision Google Sheets Add-on — Setup Guide

## How to install (manual, 5 minutes)

1. Open a new or existing Google Sheet
2. Go to Extensions → Apps Script
3. Delete any starter code, paste the entire contents of `Code.gs`
4. Replace `YOUR-VERCEL-URL` with your actual deployed URL
5. Replace `YOUR_GV_SHEETS_API_KEY` with the value from your `.env.local` GV_SHEETS_API_KEY
6. Save (Ctrl+S), name the project "GOD's Vision"
7. Return to your sheet — you can now use:

## Formulas available

`=GV("AAPL", "price")` → live stock price
`=GV("BTC-USD", "price")` → live crypto price
`=GV("AAPL", "pe_ratio")` → P/E ratio
`=GV("AAPL", "market_cap")` → market cap
`=GV_HISTORY("AAPL", "close", "2024-01-01", "2024-12-31")` → historical closes, spills across rows

## Available fields for GV()
price, change, change_pct, volume, market_cap, pe_ratio, eps,
day_high, day_low, prev_close, open, fifty_two_week_high,
fifty_two_week_low, name, currency, exchange

## Available fields for GV_HISTORY()
open, high, low, close, volume

## Notes
- Data refreshes automatically when the sheet recalculates
- API responses are cached for 30 seconds server-side
- Formulas work in any cell, can be dragged/copied like normal formulas
