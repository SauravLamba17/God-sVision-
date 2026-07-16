'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

const FIELDS_GV = [
  'price', 'change', 'change_pct', 'volume', 'market_cap', 'pe_ratio', 'eps',
  'day_high', 'day_low', 'prev_close', 'open', 'fifty_two_week_high',
  'fifty_two_week_low', 'name', 'currency', 'exchange',
];
const FIELDS_HISTORY = ['open', 'high', 'low', 'close', 'volume'];

function buildCodeGs(baseUrl: string, apiKey: string) {
  return `/**
 * GOD's Vision Google Sheets Add-on
 * Custom functions: =GV() and =GV_HISTORY()
 */

const GV_API_BASE = '${baseUrl}/api/public';
const GV_API_KEY = '${apiKey}';

/**
 * Fetches a live financial data point for a given ticker.
 * @param {string} ticker The stock/crypto ticker, e.g. "AAPL"
 * @param {string} field The data field: price, change, change_pct, volume, market_cap, pe_ratio, eps, day_high, day_low, prev_close, open, fifty_two_week_high, fifty_two_week_low, name, currency, exchange
 * @return The requested value
 * @customfunction
 */
function GV(ticker, field) {
  field = field || 'price';
  const url = \`\${GV_API_BASE}/gv?key=\${GV_API_KEY}&ticker=\${encodeURIComponent(ticker)}&field=\${encodeURIComponent(field)}\`;
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const data = JSON.parse(response.getContentText());
    if (data.error) return \`Error: \${data.error}\`;
    return data.value;
  } catch (e) {
    return \`Error: \${e.message}\`;
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
  const url = \`\${GV_API_BASE}/gv-history?key=\${GV_API_KEY}&ticker=\${encodeURIComponent(ticker)}&field=\${encodeURIComponent(field)}&start=\${startDate}&end=\${endDate}\`;
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const data = JSON.parse(response.getContentText());
    if (data.error) return [[\`Error: \${data.error}\`]];
    return data.rows.map(row => [row.date, row.value]);
  } catch (e) {
    return [[\`Error: \${e.message}\`]];
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
    "GOD's Vision Sheets Add-on\\n\\n" +
    'Use =GV("AAPL","price") for live data.\\n' +
    'Use =GV_HISTORY("AAPL","close","2024-01-01","2024-12-31") for history.\\n\\n' +
    'Available fields: price, change, change_pct, volume, market_cap, ' +
    'pe_ratio, eps, day_high, day_low, prev_close, open, ' +
    'fifty_two_week_high, fifty_two_week_low, name, currency, exchange'
  );
}
`;
}

const panel: React.CSSProperties = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border-color)',
  borderRadius: '4px',
  overflow: 'hidden',
};
const header: React.CSSProperties = {
  background: 'var(--bg-header)',
  borderBottom: '1px solid var(--border-color)',
  padding: '8px 12px',
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: '11px',
  fontWeight: 700,
  color: 'var(--text-accent)',
  letterSpacing: '0.5px',
};

export default function SheetsPage() {
  const { data: session, status } = useSession();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/user/gv-key')
      .then(r => r.json())
      .then(d => { if (d.key) setApiKey(d.key); })
      .catch(() => {});
  }, [status]);

  const copyCode = async () => {
    const code = buildCodeGs(baseUrl || 'https://YOUR-VERCEL-URL.vercel.app', apiKey ?? 'YOUR_GV_SHEETS_API_KEY');
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-terminal)', padding: '8px', color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono, monospace' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-accent)', letterSpacing: '1px', marginBottom: '4px' }}>
        GOOGLE SHEETS ADD-ON
      </div>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '10px' }}>
        Pull live GOD&apos;s Vision data into any spreadsheet with =GV() and =GV_HISTORY()
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '8px' }}>
        {/* API key panel */}
        <div style={panel}>
          <div style={header}>YOUR API KEY</div>
          <div style={{ padding: '16px' }}>
            {status === 'loading' ? (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Loading…</div>
            ) : !session ? (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  Sign in to view your GV_SHEETS_API_KEY.
                </div>
                <Link href="/auth/signin" style={{
                  display: 'inline-block', background: 'var(--text-accent)', color: '#000',
                  padding: '7px 16px', borderRadius: '3px', textDecoration: 'none',
                  fontSize: '10px', fontWeight: 700,
                }}>
                  SIGN IN
                </Link>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '6px' }}>GV_SHEETS_API_KEY</div>
                <div style={{
                  fontSize: '12px', color: 'var(--text-positive)', background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)', borderRadius: '3px', padding: '8px 10px',
                  wordBreak: 'break-all', marginBottom: '10px',
                }}>
                  {apiKey ?? 'Loading…'}
                </div>
                <button onClick={copyCode} style={{
                  width: '100%', padding: '9px', background: copied ? 'var(--text-positive)' : 'var(--text-accent)',
                  border: 'none', color: '#000', fontWeight: 700, fontSize: '10px',
                  borderRadius: '3px', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace',
                }}>
                  {copied ? '✓ COPIED TO CLIPBOARD' : 'COPY Code.gs (with your key filled in)'}
                </button>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.5 }}>
                  Base URL used: <span style={{ color: 'var(--text-secondary)' }}>{baseUrl}</span><br />
                  For a production sheet, redeploy with your live Vercel URL and re-copy.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Setup steps */}
        <div style={panel}>
          <div style={header}>INSTALL (5 MINUTES)</div>
          <div style={{ padding: '16px', fontSize: '11px', lineHeight: 2, color: 'var(--text-secondary)' }}>
            <div>1. Open a new or existing Google Sheet</div>
            <div>2. Go to <b style={{ color: 'var(--text-primary)' }}>Extensions → Apps Script</b></div>
            <div>3. Delete any starter code, paste the copied <code>Code.gs</code> above</div>
            <div>4. Save (Ctrl+S), name the project &quot;GOD&apos;s Vision&quot;</div>
            <div>5. Return to your sheet — formulas are ready to use</div>
          </div>
        </div>
      </div>

      {/* Formulas reference */}
      <div style={{ ...panel, marginTop: '8px' }}>
        <div style={header}>FORMULAS AVAILABLE</div>
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-accent)', marginBottom: '8px', fontWeight: 700 }}>=GV(ticker, field)</div>
              {[
                '=GV("AAPL", "price")     → live stock price',
                '=GV("BTC-USD", "price")  → live crypto price',
                '=GV("AAPL", "pe_ratio")  → P/E ratio',
                '=GV("AAPL", "market_cap")→ market cap',
              ].map(ex => (
                <div key={ex} style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', whiteSpace: 'pre' }}>{ex}</div>
              ))}
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '10px', lineHeight: 1.6 }}>
                Fields: {FIELDS_GV.join(', ')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-accent)', marginBottom: '8px', fontWeight: 700 }}>=GV_HISTORY(ticker, field, start, end)</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                =GV_HISTORY(&quot;AAPL&quot;, &quot;close&quot;, &quot;2024-01-01&quot;, &quot;2024-12-31&quot;)
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Returns a 2D [date, value] array — spills across rows automatically.
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '10px', lineHeight: 1.6 }}>
                Fields: {FIELDS_HISTORY.join(', ')}
              </div>
            </div>
          </div>
          <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', fontSize: '9px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Data refreshes automatically when the sheet recalculates · API responses cached 30s server-side · formulas can be dragged/copied like any normal formula.
          </div>
        </div>
      </div>
    </div>
  );
}
