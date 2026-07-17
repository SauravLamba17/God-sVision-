'use client'
import { useEffect, useState, useCallback } from 'react'
import PanelWrapper from '@/components/panels/PanelWrapper'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface WatchlistItem { id: number; ticker: string; notes: string; addedAt: string }
interface WatchlistGroup { id: number; name: string; items: WatchlistItem[]; createdAt: string }
interface QuoteData { symbol: string; price: number; change: number; changePct: number; volume: number; marketCap: number | null; high: number; low: number }

export default function WatchlistsPage() {
  const [groups,   setGroups]   = useState<WatchlistGroup[]>([])
  const [active,   setActive]   = useState<WatchlistGroup | null>(null)
  const [quotes,   setQuotes]   = useState<Record<string, QuoteData>>({})
  const [loading,  setLoading]  = useState(true)
  const [qLoading, setQLoading] = useState(false)
  const [newName,  setNewName]  = useState('')
  const [newTicker,setNewTicker]= useState('')
  const [showAdd,  setShowAdd]  = useState(false)
  const router = useRouter()

  const loadGroups = useCallback(async () => {
    try {
      const res  = await fetch('/api/watchlists')
      const json = await res.json()
      const g: WatchlistGroup[] = json.data || []
      setGroups(g)
      if (!active && g.length > 0) setActive(g[0])
      else if (active) {
        const updated = g.find(x => x.id === active.id)
        if (updated) setActive(updated)
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [active])

  const loadQuotes = useCallback(async (items: WatchlistItem[]) => {
    if (!items.length) return
    setQLoading(true)
    try {
      const tickers = items.map(i => i.ticker).join(',')
      const res     = await fetch(`/api/stocks?tickers=${tickers}`)
      const json    = await res.json()
      const map: Record<string, QuoteData> = {}
      ;(json.data || []).forEach((q: any) => {
        map[q.symbol] = {
          symbol: q.symbol, price: q.regularMarketPrice, change: q.regularMarketChange,
          changePct: q.regularMarketChangePercent, volume: q.regularMarketVolume,
          marketCap: q.marketCap, high: q.regularMarketDayHigh, low: q.regularMarketDayLow,
        }
      })
      setQuotes(map)
    } catch { /* silent */ }
    finally { setQLoading(false) }
  }, [])

  useEffect(() => { loadGroups() }, [])

  useEffect(() => {
    if (active?.items?.length) {
      loadQuotes(active.items)
      const id = setInterval(() => loadQuotes(active.items), 30000)
      return () => clearInterval(id)
    }
  }, [active, loadQuotes])

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    await fetch('/api/watchlists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'createGroup', name: newName.trim() }) })
    setNewName('')
    loadGroups()
  }

  const addTicker = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!active || !newTicker.trim()) return
    await fetch('/api/watchlists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'addItem', groupId: active.id, ticker: newTicker.trim().toUpperCase() }) })
    setNewTicker('')
    setShowAdd(false)
    loadGroups()
  }

  const removeItem = async (itemId: number) => {
    await fetch(`/api/watchlists?itemId=${itemId}`, { method: 'DELETE' })
    loadGroups()
  }

  const removeGroup = async (groupId: number) => {
    await fetch(`/api/watchlists?groupId=${groupId}`, { method: 'DELETE' })
    setActive(null)
    loadGroups()
  }

  const gainers  = active?.items.filter(i => (quotes[i.ticker]?.changePct ?? 0) > 0).length || 0
  const losers   = active?.items.filter(i => (quotes[i.ticker]?.changePct ?? 0) < 0).length || 0
  const totalVal = active?.items.reduce((s, i) => s + (quotes[i.ticker]?.marketCap || 0), 0) || 0

  return (
    <div style={{ padding: 8, height: '100%', display: 'flex', gap: 8 }}>
      {/* Left sidebar: watchlist groups */}
      <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ border: '1px solid #1e293b', background: 'var(--bg-panel)' }}>
          <div className="panel-header">
            <span className="panel-header-title">WATCHLISTS</span>
          </div>
          <div style={{ padding: 6 }}>
            {loading ? (
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)', padding: 8 }}>Loading...</div>
            ) : (
              groups.map(g => (
                <div key={g.id} onClick={() => setActive(g)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 10px', cursor: 'pointer', borderRadius: 3, marginBottom: 2,
                  background: active?.id === g.id ? 'rgba(56,189,248,0.1)' : 'transparent',
                  border: `1px solid ${active?.id === g.id ? 'rgba(56,189,248,0.3)' : 'transparent'}`,
                }}>
                  <div>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 600, color: active?.id === g.id ? 'var(--text-accent)' : 'var(--text-secondary)' }}>{g.name}</div>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--text-muted)' }}>{g.items.length} TICKERS</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); removeGroup(g.id) }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, padding: '0 2px' }}>✕</button>
                </div>
              ))
            )}
          </div>
          {/* Create new group */}
          <div style={{ padding: '6px 8px', borderTop: '1px solid #1e293b' }}>
            <form onSubmit={createGroup} style={{ display: 'flex', gap: 4 }}>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New list name" className="input-terminal" style={{ flex: 1, fontSize: 9 }} />
              <button type="submit" className="btn-terminal" style={{ fontSize: 9, padding: '3px 6px' }}>+</button>
            </form>
          </div>
        </div>

        {/* Stats */}
        {active && (
          <div style={{ border: '1px solid #1e293b', background: 'var(--bg-panel)', padding: '8px 12px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.06em' }}>LIST STATS</div>
            {[
              { label: 'TICKERS',  val: String(active.items.length),   color: 'var(--text-accent)' },
              { label: 'GAINERS',  val: String(gainers),               color: 'var(--text-positive)' },
              { label: 'LOSERS',   val: String(losers),                color: 'var(--text-negative)' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(30,41,59,0.4)' }}>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)' }}>{s.label}</span>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, fontWeight: 700, color: s.color }}>{s.val}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: watchlist content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {active ? (
          <>
            {/* Active watchlist header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'linear-gradient(90deg, #0d1526, #070e1b)', border: '1px solid #1e293b', borderLeft: '2px solid #38bdf8', padding: '6px 12px' }}>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, fontWeight: 700, color: 'var(--text-accent)', letterSpacing: '0.08em', textShadow: '0 0 12px rgba(56,189,248,0.4)' }}>
                {active.name.toUpperCase()}
              </span>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)' }}>{active.items.length} TICKERS</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {showAdd ? (
                  <form onSubmit={addTicker} style={{ display: 'flex', gap: 4 }}>
                    <input value={newTicker} onChange={e => setNewTicker(e.target.value.toUpperCase())} placeholder="ADD TICKER" className="input-terminal" style={{ width: 120 }} autoFocus />
                    <button type="submit" className="btn-terminal">ADD</button>
                    <button type="button" onClick={() => setShowAdd(false)} className="btn-terminal">✕</button>
                  </form>
                ) : (
                  <button onClick={() => setShowAdd(true)} className="btn-terminal">+ ADD TICKER</button>
                )}
              </div>
            </div>

            <PanelWrapper title={`${active.name} — LIVE QUOTES`} loading={qLoading} source="live" accentColor="#38bdf8">
              {active.items.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 150, gap: 10 }}>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)' }}>EMPTY WATCHLIST — ADD TICKERS ABOVE</span>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>TICKER</th>
                      <th>PRICE</th>
                      <th>CHANGE</th>
                      <th>CHANGE %</th>
                      <th>DAY HIGH</th>
                      <th>DAY LOW</th>
                      <th>VOLUME</th>
                      <th>MKT CAP</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.items.map(item => {
                      const q = quotes[item.ticker]
                      const pos = q && q.changePct >= 0
                      return (
                        <tr key={item.id} onClick={() => router.push(`/markets?ticker=${item.ticker}`)} style={{ cursor: 'pointer' }}>
                          <td style={{ textAlign: 'left' }}>
                            <span style={{ color: 'var(--text-accent)', fontWeight: 700, fontSize: 12 }}>{item.ticker}</span>
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 12 }}>
                            {q ? formatCurrency(q.price) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td style={{ color: pos ? 'var(--text-positive)' : 'var(--text-negative)', fontWeight: 600 }}>
                            {q ? `${q.change >= 0 ? '+' : ''}${formatCurrency(Math.abs(q.change))}` : '—'}
                          </td>
                          <td>
                            {q ? (
                              <span style={{
                                padding: '2px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700,
                                background: pos ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                                color: pos ? 'var(--text-positive)' : 'var(--text-negative)',
                              }}>
                                {pos ? '▲' : '▼'} {Math.abs(q.changePct).toFixed(2)}%
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>{q ? formatCurrency(q.high) : '—'}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{q ? formatCurrency(q.low)  : '—'}</td>
                          <td style={{ color: 'var(--text-muted)' }}>
                            {q ? (q.volume >= 1e6 ? `${(q.volume/1e6).toFixed(1)}M` : `${(q.volume/1e3).toFixed(0)}K`) : '—'}
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>
                            {q?.marketCap ? (q.marketCap >= 1e12 ? `$${(q.marketCap/1e12).toFixed(2)}T` : `$${(q.marketCap/1e9).toFixed(0)}B`) : '—'}
                          </td>
                          <td onClick={e => { e.stopPropagation(); removeItem(item.id) }}>
                            <span style={{ color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '0 4px' }}>✕</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </PanelWrapper>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-muted)' }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 16 }}>⊞</span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>CREATE A WATCHLIST TO GET STARTED</span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9 }}>Use the panel on the left to create your first watchlist</span>
          </div>
        )}
      </div>
    </div>
  )
}
