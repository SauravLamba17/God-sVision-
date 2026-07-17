'use client'
import { useEffect, useState, useCallback } from 'react'
import PanelWrapper from '@/components/panels/PanelWrapper'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'

const SCREENERS = [
  { id: 'day_gainers',             label: 'TOP GAINERS' },
  { id: 'day_losers',              label: 'TOP LOSERS' },
  { id: 'most_actives',            label: 'MOST ACTIVE' },
  { id: 'undervalued_growth_stocks', label: 'UNDERVALUED GROWTH' },
  { id: 'growth_technology_stocks',  label: 'TECH GROWTH' },
  { id: 'aggressive_small_caps',   label: 'SMALL CAPS' },
  { id: 'portfolio_anchors',       label: 'BLUE CHIPS' },
]

interface Stock {
  symbol: string; shortName: string; price: number; change: number; changePct: number
  volume: number; avgVolume: number; marketCap: number; trailingPE: number; forwardPE: number
  sector: string; dividendYield: number; fiftyTwoWeekHigh: number; fiftyTwoWeekLow: number
  analystRating: string; eps: number
}

function mktCapLabel(cap: number) {
  if (!cap) return 'N/A'
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`
  if (cap >= 1e9)  return `$${(cap / 1e9).toFixed(1)}B`
  if (cap >= 1e6)  return `$${(cap / 1e6).toFixed(0)}M`
  return `$${cap}`
}

function RatingBadge({ rating }: { rating: string }) {
  if (!rating) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const n = parseFloat(rating)
  const color = n <= 2 ? 'var(--text-positive)' : n <= 3 ? 'var(--text-warning)' : 'var(--text-negative)'
  const label = n <= 1.5 ? 'STRONG BUY' : n <= 2.5 ? 'BUY' : n <= 3.5 ? 'HOLD' : n <= 4.5 ? 'SELL' : 'STRONG SELL'
  return (
    <span style={{ color, fontSize: 9, fontWeight: 600, padding: '1px 5px', background: `${color}15`, border: `1px solid ${color}30`, borderRadius: 3 }}>
      {label}
    </span>
  )
}

export default function ScreenerPage() {
  const [scrId,    setScrId]   = useState('day_gainers')
  const [stocks,   setStocks]  = useState<Stock[]>([])
  const [loading,  setLoading] = useState(true)
  const [error,    setError]   = useState<string|null>(null)
  const [source,   setSource]  = useState('live')
  const [selected, setSelected] = useState<Stock|null>(null)
  const [sort,     setSort]    = useState<{ key: keyof Stock; dir: 1|-1 }>({ key: 'changePct', dir: -1 })

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/screener?scrId=${scrId}&count=50`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setStocks(json.data || [])
      setSource(json.source)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [scrId])

  useEffect(() => { fetchData() }, [fetchData])

  const sorted = [...stocks].sort((a, b) => {
    const av = a[sort.key] as number, bv = b[sort.key] as number
    return (av - bv) * sort.dir
  })

  const toggleSort = (key: keyof Stock) => {
    setSort(s => s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 })
  }

  const SortTh = ({ col, label }: { col: keyof Stock; label: string }) => (
    <th onClick={() => toggleSort(col)} style={{ cursor: 'pointer', userSelect: 'none', textAlign: col === 'symbol' || col === 'shortName' ? 'left' : 'right', whiteSpace: 'nowrap' }}>
      {label} {sort.key === col ? (sort.dir === 1 ? '▲' : '▼') : ''}
    </th>
  )

  return (
    <div className="p-2 flex gap-2 h-full">
      {/* Left: Screener Selector + Detail */}
      <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PanelWrapper title="SCREENER TYPE">
          <div style={{ padding: '4px 0' }}>
            {SCREENERS.map(s => (
              <button
                key={s.id}
                onClick={() => setScrId(s.id)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '6px 10px', border: 'none', cursor: 'pointer',
                  fontFamily: 'IBM Plex Mono', fontSize: 10, letterSpacing: '0.06em',
                  background: scrId === s.id ? 'rgba(56,189,248,0.1)' : 'transparent',
                  color:      scrId === s.id ? 'var(--text-accent)' : 'var(--text-muted)',
                  borderLeft: scrId === s.id ? '2px solid #38bdf8' : '2px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                {scrId === s.id ? '▶ ' : '  '}{s.label}
              </button>
            ))}
          </div>
        </PanelWrapper>

        {selected && (
          <PanelWrapper title={selected.symbol} accentColor="#a78bfa">
            <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{selected.shortName}</div>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>${selected.price?.toFixed(2)}</div>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: selected.changePct >= 0 ? 'var(--text-positive)' : 'var(--text-negative)' }}>
                {selected.changePct >= 0 ? '▲' : '▼'} {formatPercent(selected.changePct)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 4 }}>
                {[
                  { k: 'MKT CAP',  v: mktCapLabel(selected.marketCap) },
                  { k: 'P/E',      v: selected.trailingPE?.toFixed(1) || 'N/A' },
                  { k: 'FWD P/E',  v: selected.forwardPE?.toFixed(1)  || 'N/A' },
                  { k: 'EPS',      v: selected.eps ? `$${selected.eps.toFixed(2)}` : 'N/A' },
                  { k: '52W HI',   v: `$${selected.fiftyTwoWeekHigh?.toFixed(0)}` },
                  { k: '52W LO',   v: `$${selected.fiftyTwoWeekLow?.toFixed(0)}` },
                  { k: 'DIV YLD',  v: selected.dividendYield ? `${(selected.dividendYield*100).toFixed(2)}%` : 'N/A' },
                  { k: 'SECTOR',   v: (selected.sector || 'N/A').slice(0, 10) },
                ].map(row => (
                  <div key={row.k} style={{ borderBottom: '1px solid #1e293b', paddingBottom: 3 }}>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--text-muted)' }}>{row.k}</div>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-secondary)' }}>{row.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 4 }}><RatingBadge rating={selected.analystRating} /></div>
            </div>
          </PanelWrapper>
        )}
      </div>

      {/* Right: Table */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <PanelWrapper title={`${SCREENERS.find(s => s.id === scrId)?.label || 'SCREENER'} — ${stocks.length} RESULTS`}
          loading={loading} error={error} source={source} onRefresh={fetchData}>
          <table className="data-table">
            <thead>
              <tr>
                <SortTh col="symbol"      label="#  TICKER" />
                <SortTh col="shortName"   label="NAME" />
                <SortTh col="price"       label="PRICE" />
                <SortTh col="changePct"   label="CHG%" />
                <SortTh col="volume"      label="VOLUME" />
                <SortTh col="marketCap"   label="MKT CAP" />
                <SortTh col="trailingPE"  label="P/E" />
                <SortTh col="forwardPE"   label="FWD P/E" />
                <SortTh col="dividendYield" label="DIV%" />
                <th style={{ textAlign: 'right' }}>RATING</th>
                <th style={{ textAlign: 'right' }}>52W HI/LO</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => {
                const pct52  = s.fiftyTwoWeekHigh && s.fiftyTwoWeekLow
                  ? ((s.price - s.fiftyTwoWeekLow) / (s.fiftyTwoWeekHigh - s.fiftyTwoWeekLow)) * 100
                  : null
                return (
                  <tr key={s.symbol} onClick={() => setSelected(s)} style={{
                    cursor: 'pointer',
                    background: selected?.symbol === s.symbol ? 'rgba(56,189,248,0.06)' : undefined,
                  }}>
                    <td style={{ textAlign: 'left', minWidth: 80 }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 9, marginRight: 6 }}>{i + 1}</span>
                      <span style={{ color: 'var(--text-accent)', fontWeight: 700, fontSize: 11 }}>{s.symbol}</span>
                    </td>
                    <td style={{ textAlign: 'left', color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {(s.shortName || '').slice(0, 22)}
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(s.price)}</td>
                    <td style={{ color: s.changePct >= 0 ? 'var(--text-positive)' : 'var(--text-negative)', fontWeight: 600 }}>
                      {s.changePct >= 0 ? '▲' : '▼'} {formatPercent(s.changePct)}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{formatNumber(s.volume)}</td>
                    <td>{mktCapLabel(s.marketCap)}</td>
                    <td style={{ color: s.trailingPE > 40 ? 'var(--text-warning)' : 'var(--text-secondary)' }}>
                      {s.trailingPE ? s.trailingPE.toFixed(1) : '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {s.forwardPE ? s.forwardPE.toFixed(1) : '—'}
                    </td>
                    <td style={{ color: 'var(--text-positive)' }}>
                      {s.dividendYield ? `${(s.dividendYield * 100).toFixed(2)}%` : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}><RatingBadge rating={s.analystRating} /></td>
                    <td style={{ textAlign: 'right', minWidth: 80 }}>
                      {pct52 !== null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                          <div style={{ width: 48, height: 4, background: 'var(--border-color)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${pct52}%`, height: '100%', background: 'var(--text-accent)', borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{pct52.toFixed(0)}%</span>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </PanelWrapper>
      </div>
    </div>
  )
}
