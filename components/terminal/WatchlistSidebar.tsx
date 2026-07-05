'use client'
import { useEffect, useRef, useState } from 'react'

interface WatchlistItem {
  id: number
  ticker: string
  name: string
  assetType: string
  note: string
  price: number | null
  change: number | null
  changePct: number | null
}

const SIDEBAR_WIDTH = 220

export default function WatchlistSidebar() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [adding, setAdding] = useState(false)
  const [newTicker, setNewTicker] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    try {
      const res = await fetch('/api/watchlist')
      const j = await res.json()
      if (j.data) setItems(j.data)
    } catch {}
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 30000) // refresh prices every 30s
    return () => clearInterval(id)
  }, [])

  // W key toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'w' || e.key === 'W') && !e.ctrlKey && !e.metaKey && !(document.activeElement instanceof HTMLInputElement) && !(document.activeElement instanceof HTMLTextAreaElement)) {
        setOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const addTicker = async () => {
    const t = newTicker.trim().toUpperCase()
    if (!t) return
    await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: t, name: t }),
    })
    setNewTicker('')
    setAdding(false)
    await load()
  }

  const removeTicker = async (ticker: string) => {
    await fetch(`/api/watchlist?ticker=${ticker}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.ticker !== ticker))
  }

  const totalValue = items.reduce((sum, i) => sum + (i.price ?? 0), 0)
  const totalChange = items.reduce((sum, i) => sum + (i.change ?? 0), 0)

  return (
    <>
      {/* Star icon toggle â€” always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Watchlist (W)"
        style={{
          position: 'fixed',
          right: open ? SIDEBAR_WIDTH : 0,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 50,
          background: 'var(--bg-panel)',
          border: '1px solid #1b2e1b',
          borderRight: 'none',
          borderRadius: '4px 0 0 4px',
          width: 22,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: open ? 'var(--text-warning)' : 'var(--text-muted)',
          fontSize: 12,
          transition: 'right 0.25s ease, color 0.2s',
        }}
      >
        â˜…
      </button>

      {/* Sidebar */}
      <div style={{
        position: 'fixed',
        right: open ? 0 : -SIDEBAR_WIDTH,
        top: 100,
        bottom: 26,
        width: SIDEBAR_WIDTH,
        background: 'var(--bg-panel)',
        borderLeft: '1px solid #1b2e1b',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        transition: 'right 0.25s ease',
        fontFamily: 'IBM Plex Mono',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '8px 10px', borderBottom: '1px solid #1b2e1b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text-warning)', fontWeight: 700, letterSpacing: '0.1em' }}>â˜… WATCHLIST</span>
          <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>{items.length} items Â· W to close</span>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {items.map(item => {
            const isPos = (item.changePct ?? 0) >= 0
            return (
              <div key={item.id} style={{ padding: '6px 10px', borderBottom: '1px solid #0d1526', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>{item.ticker}</div>
                  <div style={{ fontSize: 8, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {item.price != null ? (
                    <>
                      <div style={{ fontSize: 11, color: 'var(--text-primary)' }}>${item.price.toFixed(2)}</div>
                      <div style={{ fontSize: 9, color: isPos ? 'var(--text-positive)' : 'var(--text-negative)' }}>
                        {isPos ? '+' : ''}{(item.changePct ?? 0).toFixed(2)}%
                      </div>
                    </>
                  ) : <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>â€”</div>}
                </div>
                <button
                  onClick={() => removeTicker(item.ticker)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10, padding: '0 2px' }}
                >Ã—</button>
              </div>
            )
          })}
          {items.length === 0 && !adding && (
            <div style={{ padding: '12px 10px', fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>
              Add tickers to track prices.<br />Press + below.
            </div>
          )}
        </div>

        {/* Add ticker */}
        {adding ? (
          <div style={{ padding: '6px 8px', borderTop: '1px solid #1b2e1b', display: 'flex', gap: 4 }}>
            <input
              ref={inputRef}
              value={newTicker}
              onChange={e => setNewTicker(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter') addTicker(); if (e.key === 'Escape') { setAdding(false); setNewTicker('') } }}
              placeholder="TICKER"
              autoFocus
              style={{ flex: 1, fontFamily: 'IBM Plex Mono', fontSize: 10, background: 'var(--bg-terminal)', color: 'var(--text-primary)', border: '1px solid #1b2e1b', padding: '3px 6px', outline: 'none' }}
            />
            <button onClick={addTicker} style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, background: 'var(--border-color)', color: 'var(--text-positive)', border: 'none', padding: '3px 8px', cursor: 'pointer' }}>ADD</button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            style={{ padding: '6px', borderTop: '1px solid #1b2e1b', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'IBM Plex Mono', fontSize: 10, width: '100%' }}
          >
            + ADD TICKER
          </button>
        )}

        {/* Portfolio value footer */}
        {items.length > 0 && (
          <div style={{ padding: '6px 10px', borderTop: '1px solid #1b2e1b', background: 'var(--bg-terminal)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>TOTAL PRICES</span>
              <span style={{ fontSize: 9, color: 'var(--text-primary)', fontWeight: 700 }}>${totalValue.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>TOTAL CHANGE</span>
              <span style={{ fontSize: 9, color: totalChange >= 0 ? 'var(--text-positive)' : 'var(--text-negative)', fontWeight: 700 }}>
                {totalChange >= 0 ? '+' : ''}${totalChange.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
