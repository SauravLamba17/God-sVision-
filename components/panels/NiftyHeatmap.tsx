'use client'
import { useEffect, useState, useCallback } from 'react'
import { PanelEmpty } from '@/components/ui/Panel'
import { arrow, pct } from '@/lib/format'

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
  if (pct > 3)  return 'var(--heat-up-3)'
  if (pct > 1)  return 'var(--heat-up-2)'
  if (pct > 0)  return 'var(--heat-up-1)'
  if (pct > -1) return 'var(--heat-down-1)'
  if (pct > -3) return 'var(--heat-down-2)'
  return 'var(--heat-down-3)'
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
  if (loading) return <PanelEmpty title="NIFTY 50 HEATMAP" accent="var(--saffron)" message="Loading Nifty heatmap…" />
  if (Object.keys(stocks).length === 0) {
    return <PanelEmpty title="NIFTY 50 HEATMAP" accent="var(--saffron)" message="Nifty constituent prices temporarily unavailable" onRetry={load} />
  }

  return (
    // height:100% + a scrolling body makes the panel fill its grid cell. Left
    // auto-height, the cell's remaining space rendered as bare page background
    // — a black rectangle under the heatmap.
    <div className="gv-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div className="gv-card-head" style={{ flexShrink: 0, flexWrap: 'wrap' }}>
        <span>Nifty 50 heatmap</span>
        <div style={{ display: 'flex', gap: 6, fontSize: 'var(--fs-meta)', fontWeight: 'var(--fw-normal)' }}>
          {[['STRONG UP', 'var(--heat-up-3)'], ['UP', 'var(--heat-up-1)'], ['DOWN', 'var(--heat-down-2)'], ['STRONG DN', 'var(--heat-down-3)']].map(([l, c]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 2, color: 'var(--text-muted)' }}>
              <span className="gv-heat-swatch" style={{ width: 8, height: 8, background: c as string, borderRadius: 1, display: 'inline-block' }} />
              {l}
            </span>
          ))}
        </div>
      </div>

      <div style={{ padding: '10px 16px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {Object.entries(SECTOR_MAP).map(([sector, tickers]) => (
          <div key={sector} style={{ marginBottom: 8 }}>
            <div className="gv-label" style={{ marginBottom: 3 }}>{sector}</div>
            <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {tickers.map(t => {
                const s = stocks[t]
                if (!s) return null
                const displayName = t.replace('.NS', '')
                const bg = intensityColor(s.changePct)
                const isPos = s.changePct >= 0
                return (
                  <div key={t}
                    title={`${displayName}: ₹${s.price?.toFixed(2)} (${pct(s.changePct ?? 0, 2)})`}
                    onClick={() => window.dispatchEvent(new CustomEvent('stockSelected', { detail: { ticker: t } }))}
                    role="button" tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.dispatchEvent(new CustomEvent('stockSelected', { detail: { ticker: t } })) } }}
                    className="gv-heat" data-dir={isPos ? 'up' : 'down'}
                    style={{
                      ['--heat-bg' as string]: bg,
                      borderRadius: 6, padding: '4px 6px',
                      cursor: 'pointer', minWidth: 52, textAlign: 'center',
                    }}>
                    {/* Saturated red/green tiles with white text (≥5:1); high contrast swaps to outlined tiles (globals.css). */}
                    <div style={{ fontSize: 'var(--fs-meta)', fontWeight: 'var(--fw-bold)' }}>{displayName.slice(0, 8)}</div>
                    <div className="gv-num" style={{ fontSize: 'var(--fs-meta)', marginTop: 1 }}>
                      {arrow(s.changePct ?? 0, 1)}{pct(s.changePct ?? 0, 1)}
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
