/**
 * GOD's Vision Google Sheets Add-on
 * Custom functions: =GV() and =GV_HISTORY()
 */

const GV_API_BASE = 'https://YOUR-VERCEL-URL.vercel.app/api/public';
const GV_API_KEY = 'YOUR_GV_SHEETS_API_KEY';

/**
 * Fetches a live financial data point for a given ticker.
 * @param {string} ticker The stock/crypto ticker, e.g. "AAPL"
 * @param {string} field The data field: price, change, change_pct, volume, market_cap, pe_ratio, eps, day_high, day_low, prev_close, open, fifty_two_week_high, fifty_two_week_low, name, currency, exchange
 * @return The requested value
 * @customfunction
 */
function GV(ticker, field) {
  field = field || 'price';
  const url = `${GV_API_BASE}/gv?key=${GV_API_KEY}&ticker=${encodeURIComponent(ticker)}&field=${encodeURIComponent(field)}`;
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const data = JSON.parse(response.getContentText());
    if (data.error) return `Error: ${data.error}`;
    return data.value;
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

/**
 * Fetches historical price data for a ticker between two dates.
 * @param {string} ticker The stock ticker, e.g. "AAPL"
 * @param {string} field The OHLCV field: open, high, low, close, volume (default: close)
 * @param {string} startDate Start date, format YYYY-MM-DD
 * @param {string} endDate End date, format YYYY-MM-DD
 * @return A 2D array of [date, value] rows, spillable across cells
 * @customfunction
 */
function GV_HISTORY(ticker, field, startDate, endDate) {
  field = field || 'close';
  const url = `${GV_API_BASE}/gv-history?key=${GV_API_KEY}&ticker=${encodeURIComponent(ticker)}&field=${encodeURIComponent(field)}&start=${startDate}&end=${endDate}`;
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const data = JSON.parse(response.getContentText());
    if (data.error) return [[`Error: ${data.error}`]];
    return data.rows.map(row => [row.date, row.value]);
  } catch (e) {
    return [[`Error: ${e.message}`]];
  }
}

/**
 * Menu setup when the sheet opens (optional convenience menu)
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("GOD's Vision")
    .addItem('About', 'showAbout')
    .addToUi();
}

function showAbout() {
  SpreadsheetApp.getUi().alert(
    "GOD's Vision Sheets Add-on\n\n" +
    'Use =GV("AAPL","price") for live data.\n' +
    'Use =GV_HISTORY("AAPL","close","2024-01-01","2024-12-31") for history.\n\n' +
    'Available fields: price, change, change_pct, volume, market_cap, ' +
    'pe_ratio, eps, day_high, day_low, prev_close, open, ' +
    'fifty_two_week_high, fifty_two_week_low, name, currency, exchange'
  );
}
