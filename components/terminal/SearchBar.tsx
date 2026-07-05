'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface SearchResult {
  symbol: string; shortname: string; quoteType: string; exchange: string
}

const TYPE_COLORS: Record<string, string> = {
  EQUITY: 'var(--text-accent)', ETF: 'var(--text-positive)', INDEX: '#a78bfa', MUTUALFUND: 'var(--text-warning)',
  CRYPTOCURRENCY: '#fb923c', CURRENCY: '#34d399', FUTURE: '#f472b6',
}

export default function SearchBar() {
  const [query,    setQuery]   = useState('')
  const [results,  setResults] = useState<SearchResult[]>([])
  const [open,     setOpen]    = useState(false)
  const [loading,  setLoading] = useState(false)
  const [selected, setSelected]= useState(-1)
  const inputRef  = useRef<HTMLInputElement>(null)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router    = useRouter()

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      setResults(json.data || [])
      setOpen(true)
    } catch { setResults([]) }
    finally { setLoading(false) }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    setSelected(-1)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(v), 280)
  }

  const navigate = (result: SearchResult) => {
    setQuery(''); setResults([]); setOpen(false)
    router.push(`/markets?ticker=${result.symbol}`)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, -1)) }
    if (e.key === 'Enter' && selected >= 0) navigate(results[selected])
    if (e.key === 'Enter' && selected < 0 && results.length > 0) navigate(results[0])
    if (e.key === 'Escape') { setOpen(false); setQuery(''); inputRef.current?.blur() }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault(); inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.search-bar-container')) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="search-bar-container" style={{ position: 'relative', width: 260 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-panel)', border: '1px solid #1e3a5f', borderRadius: 4, padding: '3px 8px' }}>
        <span style={{ color: 'var(--text-accent)', fontSize: 11, flexShrink: 0 }}>âŒ•</span>
        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKey}
          onFocus={() => query && setOpen(true)}
          placeholder="Search ticker / company...  âŒƒK"
          style={{
            background: 'none', border: 'none', outline: 'none', width: '100%',
            fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-primary)',
            caretColor: 'var(--text-accent)',
          }}
        />
        {loading && <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>...</span>}
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
          background: 'var(--bg-panel)', border: '1px solid #1e3a5f', borderTop: 'none',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          maxHeight: 320, overflowY: 'auto',
        }}>
          {results.map((r, i) => (
            <div
              key={r.symbol}
              onClick={() => navigate(r)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                cursor: 'pointer', borderBottom: '1px solid rgba(30,41,59,0.5)',
                background: i === selected ? 'rgba(56,189,248,0.08)' : 'transparent',
              }}
              onMouseEnter={() => setSelected(i)}
            >
              <span style={{
                fontFamily: 'IBM Plex Mono', fontSize: 11, fontWeight: 700, minWidth: 70,
                color: TYPE_COLORS[r.quoteType] || 'var(--text-accent)',
              }}>{r.symbol}</span>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.shortname}
              </span>
              <span style={{
                fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--text-muted)',
                padding: '1px 4px', background: 'rgba(30,41,59,0.8)', borderRadius: 2, flexShrink: 0,
              }}>
                {r.quoteType} Â· {r.exchange}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
