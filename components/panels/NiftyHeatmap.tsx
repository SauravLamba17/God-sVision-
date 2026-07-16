'use client'
import { useEffect, useState } from 'react'

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
  'AUTO':       ['MARUTI.NS','TATAMOTORS.NS','BAJAJ-AUTO.NS','EICHERMOT.NS','HEROMOTOCO.NS','M&M.NS'],
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

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/india/stocks')
        const j   = await res.json()
        if (j.data?.quotes) {
          const map: Record<string, Stock> = {}
          for (const q of j.data.quotes) map[q.symbol] = q
          setStocks(map)
        }
      } finally { setLoading(false) }
    }
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [])

  if (loading) return (
    <div style={{ padding: 12, fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#FF9933' }}>
      LOADING NIFTY HEATMAP...
    </div>
  )

  return (
    <div style={{ fontFamily: 'IBM Plex Mono', border: '1px solid #1e293b', borderLeft: '2px solid #FF9933', background: 'linear-gradient(180deg,#0a0f1e,#060d1a)' }}>
      <div style={{ padding: '5px 10px', borderBottom: '1px solid #1e293b', background: '#0d1526', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#FF9933', letterSpacing: '0.08em' }}>NIFTY 50 HEATMAP</span>
        <div style={{ display: 'flex', gap: 6, fontSize: 7 }}>
          {[['STRONG UP', '#14532d'], ['UP', '#166534'], ['DOWN', '#991b1b'], ['STRONG DN', '#450a0a']].map(([l, c]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 2, color: 'var(--text-muted)' }}>
              <span style={{ width: 8, height: 8, background: c as string, borderRadius: 1, display: 'inline-block' }} />
              {l}
            </span>
          ))}
        </div>
      </div>

      <div style={{ padding: 8 }}>
        {Object.entries(SECTOR_MAP).map(([sector, tickers]) => (
          <div key={sector} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 7, color: '#607d8b', letterSpacing: '0.1em', marginBottom: 3 }}>{sector}</div>
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
                    <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-primary)' }}>{displayName.slice(0, 8)}</div>
                    <div style={{ fontSize: 7, color: isPos ? '#86efac' : '#fca5a5', marginTop: 1 }}>
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
