'use client'
import { useEffect, useState, useCallback } from 'react'
import PanelWrapper from '@/components/panels/PanelWrapper'

interface Trade {
  ticker: string; company: string; insider: string; title: string; type: string
  price: number; quantity: number; sharesOwned: number; deltaOwned: string
  value: number; isBuy: boolean; tradeDate: string; filingDate: string
}

function formatVal(v: number) {
  if (v >= 1e9) return `$${(v/1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v/1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v/1e3).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

const TYPES: Record<string, string> = {
  latest:    'LATEST TRADES',
  purchases: 'PURCHASES ONLY',
  sales:     'SALES ONLY',
}

export default function InsiderPage() {
  const [trades,  setTrades]  = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string|null>(null)
  const [source,  setSource]  = useState('live')
  const [type,    setType]    = useState<'latest'|'purchases'|'sales'>('latest')
  const [ticker,  setTicker]  = useState('')
  const [input,   setInput]   = useState('')
  const [selected, setSelected] = useState<Trade|null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ type })
      if (ticker) params.set('ticker', ticker)
      const res  = await fetch(`/api/insider?${params}`)
      const json = await res.json()
      if (json.error && !json.data?.length) throw new Error(json.error)
      setTrades(json.data || [])
      setSource(json.source)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [type, ticker])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setTicker(input.trim().toUpperCase())
  }

  const buys  = trades.filter(t => t.isBuy)
  const sells = trades.filter(t => !t.isBuy)
  const totalBuyVal  = buys.reduce((s, t) => s + t.value, 0)
  const totalSellVal = sells.reduce((s, t) => s + t.value, 0)

  return (
    <div style={{ padding: 8, height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        background: 'linear-gradient(90deg, #0d1526 0%, #070e1b 100%)',
        border: '1px solid #1e293b', borderLeft: '2px solid #f59e0b',
        padding: '6px 12px',
      }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, fontWeight: 600, color: 'var(--text-warning)', letterSpacing: '0.08em', textShadow: '0 0 12px rgba(245,158,11,0.4)' }}>
          INSIDER TRANSACTIONS — SEC FORM 4
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {(Object.keys(TYPES) as Array<'latest'|'purchases'|'sales'>).map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              fontFamily: 'IBM Plex Mono', fontSize: 9, padding: '2px 8px', cursor: 'pointer',
              border: '1px solid', borderRadius: 3,
              background: type === t ? 'rgba(245,158,11,0.1)' : 'transparent',
              color:      type === t ? 'var(--text-warning)' : 'var(--text-muted)',
              borderColor: type === t ? 'var(--text-warning)' : 'var(--border-color)',
            }}>{t.toUpperCase()}</button>
          ))}
        </div>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 6 }}>
          <input value={input} onChange={e => setInput(e.target.value.toUpperCase())}
            placeholder="FILTER TICKER..." className="input-terminal" style={{ width: 130 }} />
          <button type="submit" className="btn-terminal">FILTER</button>
          {ticker && (
            <button type="button" onClick={() => { setTicker(''); setInput('') }} className="btn-terminal">
              CLEAR
            </button>
          )}
        </form>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { label: 'TOTAL TRADES', val: String(trades.length), color: 'var(--text-accent)' },
          { label: 'PURCHASES',    val: `${buys.length}`,        color: 'var(--text-positive)' },
          { label: 'SALES',        val: `${sells.length}`,       color: 'var(--text-negative)' },
          { label: 'BUY VALUE',    val: formatVal(totalBuyVal),  color: 'var(--text-positive)' },
          { label: 'SELL VALUE',   val: formatVal(totalSellVal), color: 'var(--text-negative)' },
          { label: 'BUY/SELL',     val: sells.length === 0 ? 'âˆž' : (buys.length/sells.length).toFixed(2)+'x', color: 'var(--text-warning)' },
        ].map(s => (
          <div key={s.label} style={{
            background: `${s.color}08`, border: `1px solid ${s.color}20`,
            padding: '5px 12px', borderRadius: 4,
            display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90,
          }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 15, fontWeight: 700, color: s.color }}>{s.val}</span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.06em', marginTop: 1 }}>{s.label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          {source === 'fallback' && (
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-warning)', padding: '2px 8px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 3 }}>
              ⚠ DEMO DATA — OpenInsider scrape may be blocked
            </span>
          )}
        </div>
      </div>

      {/* Main table */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <PanelWrapper title={`${TYPES[type]}${ticker ? ` — ${ticker}` : ''} (${trades.length})`}
            loading={loading} error={error} source={source} onRefresh={fetchData} accentColor="#f59e0b">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>DATE</th>
                  <th style={{ textAlign: 'left' }}>TICKER</th>
                  <th style={{ textAlign: 'left' }}>INSIDER</th>
                  <th style={{ textAlign: 'left' }}>TITLE</th>
                  <th>TYPE</th>
                  <th>PRICE</th>
                  <th>QUANTITY</th>
                  <th>VALUE</th>
                  <th>OWN CHANGE</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t, i) => (
                  <tr key={i} onClick={() => setSelected(t)} style={{
                    cursor: 'pointer',
                    background: selected === t ? 'rgba(245,158,11,0.06)' : t.isBuy ? 'rgba(34,197,94,0.02)' : 'rgba(239,68,68,0.02)',
                  }}>
                    <td style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 10 }}>{t.tradeDate}</td>
                    <td style={{ textAlign: 'left' }}>
                      <span style={{ color: 'var(--text-accent)', fontWeight: 700 }}>{t.ticker}</span>
                    </td>
                    <td style={{ textAlign: 'left', color: 'var(--text-secondary)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.insider}
                    </td>
                    <td style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 9, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.title}
                    </td>
                    <td>
                      <span style={{
                        padding: '1px 6px', borderRadius: 3,
                        fontSize: 9, fontWeight: 700,
                        background: t.isBuy ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        color:      t.isBuy ? 'var(--text-positive)' : 'var(--text-negative)',
                        border:     `1px solid ${t.isBuy ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
                      }}>
                        {t.isBuy ? '▲ BUY' : '▼ SELL'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-primary)' }}>${t.price?.toFixed(2) || '—'}</td>
                    <td style={{ color: t.isBuy ? 'var(--text-positive)' : 'var(--text-negative)' }}>
                      {t.quantity > 0 ? `${t.isBuy ? '+' : '-'}${t.quantity.toLocaleString()}` : '—'}
                    </td>
                    <td style={{ color: t.isBuy ? 'var(--text-positive)' : 'var(--text-negative)', fontWeight: 600 }}>
                      {t.value ? formatVal(t.value) : '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{t.deltaOwned || '—'}</td>
                  </tr>
                ))}
                {trades.length === 0 && !loading && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
                      No insider trades found. Data sourced from OpenInsider (SEC Form 4 filings).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </PanelWrapper>
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ width: 260, flexShrink: 0 }}>
            <PanelWrapper title="TRADE DETAIL" accentColor="#f59e0b">
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 16, fontWeight: 700, color: 'var(--text-accent)' }}>
                  {selected.ticker}
                </div>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-secondary)' }}>{selected.company}</div>
                <div style={{
                  padding: '6px 10px', borderRadius: 4,
                  background: selected.isBuy ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${selected.isBuy ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  color: selected.isBuy ? 'var(--text-positive)' : 'var(--text-negative)',
                  fontFamily: 'IBM Plex Mono', fontSize: 12, fontWeight: 700, textAlign: 'center',
                }}>
                  {selected.isBuy ? '▲ PURCHASE' : '▼ SALE'} — {formatVal(selected.value)}
                </div>
                {[
                  { k: 'INSIDER',       v: selected.insider },
                  { k: 'TITLE',         v: selected.title },
                  { k: 'TRADE DATE',    v: selected.tradeDate },
                  { k: 'FILING DATE',   v: selected.filingDate },
                  { k: 'TRANSACTION',   v: selected.type },
                  { k: 'PRICE',         v: `$${selected.price?.toFixed(2)}` },
                  { k: 'QUANTITY',      v: selected.quantity?.toLocaleString() },
                  { k: 'TOTAL VALUE',   v: formatVal(selected.value) },
                  { k: 'SHARES OWNED',  v: selected.sharesOwned?.toLocaleString() },
                  { k: 'OWN CHANGE %',  v: selected.deltaOwned },
                ].map(row => (
                  <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: 4 }}>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)' }}>{row.k}</span>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-secondary)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>
                      {row.v || '—'}
                    </span>
                  </div>
                ))}
              </div>
            </PanelWrapper>
          </div>
        )}
      </div>
    </div>
  )
}
