'use client'
import { useEffect, useState, useCallback } from 'react'
import { PanelEmpty } from '@/components/ui/Panel'

interface Stock {
  symbol: string
  shortName?: string
  price: number
  changePct: number
  volume: number
}

const SECTOR_MAP: Record<string, string[]> = {
  'IT':         ['TCS.NS','INFY.NS','WIPRO.NS','HCLTECH.NS','TECHM.NS'],
  'BANKING':    ['HDFCBANK.NS','ICICIBANK.NS','KOTAKBANK.NS','SBIN.NS','AXISBANK.NS','INDUSINDBK.NS','BAJFINANCE.NS'],
  'ENERGY':     ['RELIANCE.NS','ONGC.NS','BPCL.NS','NTPC.NS','POWERGRID.NS'],
  'AUTO':       ['MARUTI.NS','TMPV.NS','BAJAJ-AUTO.NS','EICHERMOT.NS','HEROMOTOCO.NS','M&M.NS'],
  'PHARMA':     ['SUNPHARMA.NS','DRREDDY.NS','CIPLA.NS','DIVISLAB.NS','APOLLOHOSP.NS'],
  'FMCG':       ['HINDUNILVR.NS','ITC.NS','NESTLEIND.NS','BRITANNIA.NS','TATACONSUM.NS'],
  'INFRA':      ['LT.NS','ADANIENT.NS','ADANIPORTS.NS','ULTRACEMCO.NS','SHREECEM.NS'],
  'METALS':     ['TATASTEEL.NS','JSWSTEEL.NS','HINDALCO.NS','COALINDIA.NS','UPL.NS'],
  'OTHERS':     ['ASIANPAINT.NS','BAJAJFINSV.NS','GRASIM.NS','TITAN.NS','BHARTIARTL.NS'],
}

function intensityColor(pct: number): string {
  if (pct > 3)  return '#14532d'
  if (pct > 1)  return '#15803d'
  if (pct > 0)  return '#166534'
  if (pct > -1) return '#7f1d1d'
  if (pct > -3) return '#991b1b'
  return '#450a0a'
}

export default function NiftyHeatmap() {
  const [stocks, setStocks] = useState<Record<string, Stock>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/india/stocks')
      const j   = await res.json()
      if (j.data?.quotes) {
        const map: Record<string, Stock> = {}
        // A quote with no changePct colours every tile the "strong down" red,
        // so drop it here rather than paint a false signal.
        for (const q of j.data.quotes) {
          if (Number.isFinite(q?.changePct)) map[q.symbol] = q
        }
        setStocks(map)
      }
    } catch { /* falls through to the unavailable state below */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [load])

  // Both of these previously rendered bare unbordered text (or nine sector
  // labels with no tiles under them), which read as a blank panel in the
  // 380px-wide, 520px-tall grid cell this sits in.
  if (loading) return <PanelEmpty title="NIFTY 50 HEATMAP" accent="#FF9933" message="Loading Nifty heatmap…" />
  if (Object.keys(stocks).length === 0) {
    return <PanelEmpty title="NIFTY 50 HEATMAP" accent="#FF9933" message="Nifty constituent prices temporarily unavailable" onRetry={load} />
  }

  return (
    // height:100% + a scrolling body makes the panel fill its grid cell. Left
    // auto-height, the cell's remaining space rendered as bare page background
    // — a black rectangle under the heatmap.
    <div style={{ fontFamily: 'IBM Plex Mono', border: '1px solid #1e293b', borderLeft: '2px solid #FF9933', background: 'linear-gradient(180deg,#0a0f1e,#060d1a)', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ padding: '5px 10px', borderBottom: '1px solid #1e293b', background: '#0d1526', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: '#FF9933', letterSpacing: '0.08em' }}>NIFTY 50 HEATMAP</span>
        <div style={{ display: 'flex', gap: 6, fontSize: 'var(--fs-meta)' }}>
          {[['STRONG UP', '#14532d'], ['UP', '#166534'], ['DOWN', '#991b1b'], ['STRONG DN', '#450a0a']].map(([l, c]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 2, color: 'var(--text-muted)' }}>
              <span style={{ width: 8, height: 8, background: c as string, borderRadius: 1, display: 'inline-block' }} />
              {l}
            </span>
          ))}
        </div>
      </div>

      <div style={{ padding: 8, flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {Object.entries(SECTOR_MAP).map(([sector, tickers]) => (
          <div key={sector} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 'var(--fs-meta)', color: '#607d8b', letterSpacing: '0.1em', marginBottom: 3 }}>{sector}</div>
            <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {tickers.map(t => {
                const s = stocks[t]
                if (!s) return null
                const displayName = t.replace('.NS', '')
                const bg = intensityColor(s.changePct)
                const isPos = s.changePct >= 0
                return (
                  <div key={t}
                    title={`${displayName}: ₹${s.price?.toFixed(2)} (${s.changePct?.toFixed(2)}%)`}
                    onClick={() => window.dispatchEvent(new CustomEvent('stockSelected', { detail: { ticker: t } }))}
                    style={{
                      background: bg, border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 3, padding: '4px 6px',
                      cursor: 'pointer', minWidth: 52, textAlign: 'center',
                    }}>
                    <div style={{ fontSize: 'var(--fs-meta)', fontWeight: 700, color: 'var(--text-primary)' }}>{displayName.slice(0, 8)}</div>
                    <div style={{ fontSize: 'var(--fs-meta)', color: isPos ? '#86efac' : '#fca5a5', marginTop: 1 }}>
                      {isPos ? '+' : ''}{s.changePct?.toFixed(1)}%
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
