'use client'
import { useEffect, useState } from 'react'
import { formatPercent } from '@/lib/utils'
import { arrow, pct as pctFmt } from '@/lib/format'

interface SectorData {
  name: string; etf: string; weight: number
  etfData: { price: number; change: number; changePct: number } | null
  stocks: { symbol: string; price: number; changePct: number }[]
}

// Same stepped scale as the Nifty heatmap: every fill keeps white text at ≥5:1
// (the old continuous scale went bright green under white text, and near zero
// put dark theme text on a dark tile). Tiles use .gv-heat, so high contrast
// swaps them for outlined up/down tiles.
function heatColor(pct: number): string {
  if (pct > 3)  return 'var(--heat-up-3)'
  if (pct > 1)  return 'var(--heat-up-2)'
  if (pct >= 0) return 'var(--heat-up-1)'
  if (pct > -1) return 'var(--heat-down-1)'
  if (pct > -3) return 'var(--heat-down-2)'
  return 'var(--heat-down-3)'
}
const heatProps = (pct: number) => ({ className: 'gv-heat', 'data-dir': pct >= 0 ? 'up' : 'down' })

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
      <div className="gv-card" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 'var(--fs-header)', fontWeight: 'var(--fw-bold)', color: 'var(--text)' }}>
            S&P 500 SECTOR HEATMAP
          </span>
          <span className="gv-num" style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            {lastUpdate ? `UPDATED ${lastUpdate}` : ''}
          </span>
        </div>
        <div role="group" aria-label="View" className="gv-seg">
          {(['sectors', 'stocks'] as const).map(v => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} style={{ textTransform: 'uppercase' }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 4 }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>SCALE:</span>
        {[-5,-2,-0.5,0.5,2,5].map(v => (
          <div key={v} {...heatProps(v)} style={{
            ['--heat-bg' as string]: heatColor(v), borderRadius: 4, padding: '0 6px', minHeight: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="gv-num" style={{ fontSize: 9, fontWeight: 600 }}>
              {v > 3 ? '>+3' : v > 1 ? '+1…3' : v >= 0 ? '0…+1' : v > -1 ? '0…−1' : v > -3 ? '−1…3' : '<−3'}%
            </span>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
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
              <div key={sector.name} {...heatProps(pct)} style={{
                gridColumn: `span ${cols}`,
                ['--heat-bg' as string]: heatColor(pct),
                borderRadius: 'var(--radius-inner)',
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
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' }}>
                    {sector.name}
                  </div>
                  <div style={{ fontSize: 9, marginTop: 2 }}>
                    {sector.etf} · <span className="gv-num">{sector.weight}%</span>
                  </div>
                </div>
                <div>
                  <div className="gv-num" style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>
                    {arrow(pct)}{pctFmt(pct, 2)}
                  </div>
                  {sector.etfData && (
                    <div className="gv-num" style={{ fontSize: 9, marginTop: 2 }}>
                      ${sector.etfData.price?.toFixed(2)}
                    </div>
                  )}
                </div>
                {/* Mini grid of top stocks */}
                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 4 }}>
                  {sector.stocks.slice(0, cols > 3 ? 5 : 3).map(stock => (
                    <div key={stock.symbol} style={{
                      border: '1px solid currentColor',
                      borderRadius: 4, padding: '1px 4px',
                      fontSize: 8,
                    }}>
                      <span style={{ fontWeight: 700 }}>{stock.symbol}</span>
                      {stock.changePct !== undefined && (
                        <span className="gv-num" style={{ marginLeft: 3 }}>
                          {arrow(stock.changePct ?? 0, 1)}{pctFmt(stock.changePct ?? 0, 1)}
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
            <div key={stock.symbol} {...heatProps(stock.changePct || 0)} style={{
              ['--heat-bg' as string]: heatColor(stock.changePct || 0),
              borderRadius: 'var(--radius-inner)', padding: '6px 8px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              cursor: 'default', minHeight: 60,
              transition: 'filter 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.3)')}
            onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
            >
              <div style={{ fontSize: 10, fontWeight: 700 }}>
                {stock.symbol}
              </div>
              <div className="gv-num" style={{ fontSize: 11, fontWeight: 700, marginTop: 3 }}>
                {arrow(stock.changePct || 0)}{pctFmt(stock.changePct || 0, 2)}
              </div>
              <div style={{ fontSize: 8, marginTop: 2 }}>
                {stock.sector.slice(0, 8)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
