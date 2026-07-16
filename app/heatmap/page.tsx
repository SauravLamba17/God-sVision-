'use client'
import { useEffect, useState } from 'react'
import { formatPercent } from '@/lib/utils'

interface SectorData {
  name: string; etf: string; weight: number
  etfData: { price: number; change: number; changePct: number } | null
  stocks: { symbol: string; price: number; changePct: number }[]
}

function heatColor(pct: number): string {
  const clamp = Math.max(-5, Math.min(5, pct))
  if (clamp >= 0) {
    const intensity = clamp / 5
    const r = Math.round(10 + 20 * intensity)
    const g = Math.round(40 + 160 * intensity)
    const b = Math.round(20 + 30 * intensity)
    return `rgb(${r},${g},${b})`
  } else {
    const intensity = Math.abs(clamp) / 5
    const r = Math.round(40 + 180 * intensity)
    const g = Math.round(10 + 20 * intensity)
    const b = Math.round(10 + 30 * intensity)
    return `rgb(${r},${g},${b})`
  }
}

function textColor(pct: number): string {
  return Math.abs(pct) > 1 ? '#ffffff' : 'var(--text-primary)'
}

export default function HeatmapPage() {
  const [sectors, setSectors] = useState<SectorData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState('')
  const [view, setView] = useState<'sectors' | 'stocks'>('sectors')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/heatmap')
        const json = await res.json()
        if (json.data) {
          setSectors(json.data)
          setLastUpdate(new Date().toLocaleTimeString('en-US', { hour12: false }))
        }
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    fetchData()
    const id = setInterval(fetchData, 60000)
    return () => clearInterval(id)
  }, [])

  const allStocks = sectors.flatMap(s => s.stocks.map(st => ({ ...st, sector: s.name })))
  const sortedStocks = [...allStocks].sort((a, b) => b.changePct - a.changePct)

  return (
    <div style={{ padding: 8, height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'linear-gradient(90deg, #0d1526 0%, #070e1b 100%)',
        border: '1px solid #1e293b', borderLeft: '2px solid #38bdf8',
        padding: '6px 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, fontWeight: 600, color: 'var(--text-accent)', letterSpacing: '0.08em', textShadow: '0 0 12px rgba(56,189,248,0.4)' }}>
            S&P 500 SECTOR HEATMAP
          </span>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)' }}>
            {lastUpdate ? `UPDATED ${lastUpdate}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['sectors', 'stocks'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              fontFamily: 'IBM Plex Mono', fontSize: 9, letterSpacing: '0.06em',
              padding: '3px 10px', border: '1px solid', cursor: 'pointer', textTransform: 'uppercase',
              background: view === v ? 'var(--text-accent)' : 'transparent',
              color:      view === v ? 'var(--bg-terminal)' : 'var(--text-accent)',
              borderColor: 'var(--text-accent)',
            }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 4 }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)' }}>SCALE:</span>
        {[-5,-3,-1,0,1,3,5].map(v => (
          <div key={v} style={{
            width: 28, height: 16, background: heatColor(v), borderRadius: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 7, color: '#fff', fontWeight: 600 }}>
              {v > 0 ? `+${v}` : v}%
            </span>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-accent)' }}>
            LOADING HEATMAP<span className="blink-cursor" />
          </span>
        </div>
      ) : view === 'sectors' ? (
        /* Sector view — treemap grid weighted by market cap */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gridAutoRows: 'minmax(100px, auto)',
          gap: 3,
          flex: 1,
          overflow: 'hidden',
        }}>
          {sectors.map(sector => {
            const pct = sector.etfData?.changePct || 0
            const cols = Math.max(2, Math.round((sector.weight / 100) * 12))
            return (
              <div key={sector.name} style={{
                gridColumn: `span ${cols}`,
                background: heatColor(pct),
                border: '1px solid rgba(0,0,0,0.3)',
                borderRadius: 4,
                padding: 8,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                cursor: 'default',
                transition: 'filter 0.15s',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.2)')}
              onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
              >
                <div>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 700, color: textColor(pct), letterSpacing: '0.06em' }}>
                    {sector.name}
                  </div>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: `${textColor(pct)}80`, marginTop: 2 }}>
                    {sector.etf} · {sector.weight}%
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 16, fontWeight: 700, color: textColor(pct), lineHeight: 1 }}>
                    {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                  </div>
                  {sector.etfData && (
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: `${textColor(pct)}80`, marginTop: 2 }}>
                      ${sector.etfData.price?.toFixed(2)}
                    </div>
                  )}
                </div>
                {/* Mini grid of top stocks */}
                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 4 }}>
                  {sector.stocks.slice(0, cols > 3 ? 5 : 3).map(stock => (
                    <div key={stock.symbol} style={{
                      background: 'rgba(0,0,0,0.25)',
                      borderRadius: 2, padding: '1px 4px',
                      fontFamily: 'IBM Plex Mono', fontSize: 8,
                    }}>
                      <span style={{ color: textColor(pct), fontWeight: 700 }}>{stock.symbol}</span>
                      {stock.changePct !== undefined && (
                        <span style={{ color: stock.changePct >= 0 ? '#86efac' : '#fca5a5', marginLeft: 3 }}>
                          {stock.changePct >= 0 ? '+' : ''}{stock.changePct?.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Stocks view — all individual stocks in a heatmap grid */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
          gap: 3,
          flex: 1,
          overflow: 'auto',
          alignContent: 'start',
        }}>
          {sortedStocks.map(stock => (
            <div key={stock.symbol} style={{
              background: heatColor(stock.changePct || 0),
              border: '1px solid rgba(0,0,0,0.3)',
              borderRadius: 3, padding: '6px 8px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              cursor: 'default', minHeight: 60,
              transition: 'filter 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.3)')}
            onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
            >
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 700, color: textColor(stock.changePct || 0) }}>
                {stock.symbol}
              </div>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, fontWeight: 700, color: textColor(stock.changePct || 0), marginTop: 3 }}>
                {(stock.changePct || 0) >= 0 ? '+' : ''}{(stock.changePct || 0).toFixed(2)}%
              </div>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: `${textColor(stock.changePct || 0)}70`, marginTop: 2 }}>
                {stock.sector.slice(0, 8)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
