'use client'
import { useEffect, useState, useCallback } from 'react'
import PanelWrapper from '@/components/panels/PanelWrapper'
import { formatCurrency } from '@/lib/utils'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface Contract {
  contractSymbol: string; strike: number; lastPrice: number; bid: number; ask: number; mid: number
  change: number; changePct: number; volume: number; openInterest: number; iv: number; inTheMoney: boolean
  delta: number|null; gamma: number|null; theta: number|null; vega: number|null; rho: number|null
}

interface OptionsData {
  ticker: string; spotPrice: number; expiry: string; expiryDates: string[]
  daysToExpiry: number; calls: Contract[]; puts: Contract[]
}

function greekColor(v: number | null): string {
  if (v === null) return 'var(--text-muted)'
  return v > 0 ? 'var(--text-positive)' : v < 0 ? 'var(--text-negative)' : 'var(--text-secondary)'
}

function GreekCell({ v, prefix = '' }: { v: number|null; prefix?: string }) {
  if (v === null) return <td style={{ color: 'var(--text-muted)', textAlign: 'right' }}>—</td>
  return (
    <td style={{ color: greekColor(v), textAlign: 'right', fontWeight: 500 }}>
      {prefix}{v.toFixed(v !== null && Math.abs(v) < 0.01 ? 4 : 3)}
    </td>
  )
}

const POPULAR = ['AAPL','MSFT','NVDA','TSLA','SPY','QQQ','META','GOOGL','AMZN','AMD']

export default function OptionsPage() {
  const [ticker,  setTicker]  = useState('AAPL')
  const [input,   setInput]   = useState('AAPL')
  const [expiry,  setExpiry]  = useState('')
  const [data,    setData]    = useState<OptionsData|null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string|null>(null)
  const [source,  setSource]  = useState('live')
  const [tab,       setTab]       = useState<'calls'|'puts'>('calls')
  const [viewMode,  setViewMode]  = useState<'chain'|'surface'>('chain')
  const [strikeFilter, setStrikeFilter] = useState<'all'|'itm'|'otm'>('all')

  const fetchData = useCallback(async (t: string, exp: string) => {
    setLoading(true); setError(null)
    try {
      const url = `/api/options?ticker=${t}${exp ? `&expiry=${exp}` : ''}`
      const res  = await fetch(url)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      if (json.source === 'unavailable' && json.message) setError(json.message)
      setData(json.data)
      setSource(json.source)
      if (!exp && json.data?.expiry) setExpiry(json.data.expiry)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(ticker, '') }, [ticker])
  useEffect(() => { if (expiry && ticker) fetchData(ticker, expiry) }, [expiry])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const t = input.trim().toUpperCase()
    if (t) { setTicker(t); setExpiry('') }
  }

  const contracts = data ? (tab === 'calls' ? data.calls : data.puts) : []
  const filtered  = contracts.filter(c => {
    if (strikeFilter === 'itm') return c.inTheMoney
    if (strikeFilter === 'otm') return !c.inTheMoney
    return true
  })

  const spotPrice = data?.spotPrice || 0

  return (
    <div style={{ padding: 8, height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        background: 'linear-gradient(90deg, #0d1526 0%, #070e1b 100%)',
        border: '1px solid #1e293b', borderLeft: '2px solid #a78bfa',
        padding: '6px 12px',
      }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, fontWeight: 600, color: '#a78bfa', letterSpacing: '0.08em', textShadow: '0 0 12px rgba(167,139,250,0.4)' }}>
          OPTIONS CHAIN
        </span>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 6 }}>
          <input
            value={input} onChange={e => setInput(e.target.value.toUpperCase())}
            placeholder="TICKER" className="input-terminal"
            style={{ width: 90 }}
          />
          <button type="submit" className="btn-terminal">LOAD</button>
        </form>
        {/* Popular tickers */}
        <div style={{ display: 'flex', gap: 4 }}>
          {POPULAR.map(t => (
            <button key={t} onClick={() => { setTicker(t); setInput(t); setExpiry('') }}
              style={{
                fontFamily: 'IBM Plex Mono', fontSize: 9, padding: '2px 7px',
                border: '1px solid', borderColor: ticker === t ? '#a78bfa' : 'var(--border-color)',
                background: ticker === t ? 'rgba(167,139,250,0.1)' : 'transparent',
                color: ticker === t ? '#a78bfa' : 'var(--text-muted)', cursor: 'pointer', borderRadius: 3,
              }}
            >{t}</button>
          ))}
        </div>
        {/* View mode toggle */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['chain','surface'] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)} style={{
              fontFamily: 'IBM Plex Mono', fontSize: 9, padding: '2px 8px', cursor: 'pointer',
              border: '1px solid', borderRadius: 3,
              background: viewMode === m ? 'rgba(167,139,250,0.12)' : 'transparent',
              color:      viewMode === m ? '#a78bfa' : 'var(--text-muted)',
              borderColor: viewMode === m ? '#a78bfa' : 'var(--border-color)',
            }}>
              {m === 'chain' ? '≡ CHAIN' : '◫ VOL SURFACE'}
            </button>
          ))}
        </div>
        {data && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-secondary)' }}>SPOT</span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(spotPrice)}
            </span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)' }}>
              {data.daysToExpiry}d TO EXPIRY
            </span>
          </div>
        )}
      </div>

      {/* Expiry selector + Greek legend */}
      {data && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)' }}>EXPIRY:</span>
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
            {data.expiryDates.slice(0, 12).map(d => (
              <button key={d} onClick={() => setExpiry(d)} style={{
                fontFamily: 'IBM Plex Mono', fontSize: 9, padding: '2px 8px',
                border: '1px solid', borderColor: expiry === d ? '#a78bfa' : 'var(--border-color)',
                background: expiry === d ? 'rgba(167,139,250,0.1)' : 'transparent',
                color: expiry === d ? '#a78bfa' : 'var(--text-muted)', cursor: 'pointer', borderRadius: 3, whiteSpace: 'nowrap',
              }}>{d}</button>
            ))}
          </div>
          <div style={{ marginLeft: 8, display: 'flex', gap: 4 }}>
            {(['all','itm','otm'] as const).map(f => (
              <button key={f} onClick={() => setStrikeFilter(f)} style={{
                fontFamily: 'IBM Plex Mono', fontSize: 9, padding: '2px 8px',
                border: '1px solid', borderColor: strikeFilter === f ? 'var(--text-accent)' : 'var(--border-color)',
                background: strikeFilter === f ? 'rgba(56,189,248,0.1)' : 'transparent',
                color: strikeFilter === f ? 'var(--text-accent)' : 'var(--text-muted)', cursor: 'pointer', borderRadius: 3,
                textTransform: 'uppercase',
              }}>{f}</button>
            ))}
          </div>
        </div>
      )}

      {/* Vol Surface */}
      {viewMode === 'surface' && data && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          <div style={{ border: '1px solid #1e293b', background: 'var(--bg-panel)' }}>
            <div className="panel-header">
              <span className="panel-header-title">IV SMILE / SKEW — {ticker} {expiry}</span>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)' }}>Implied volatility by strike vs spot ({formatCurrency(spotPrice)})</span>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart
                data={(() => {
                  const allStrikes = [...new Set([...data.calls.map(c=>c.strike),...data.puts.map(c=>c.strike)])].sort((a,b)=>a-b)
                  return allStrikes.map(strike => ({
                    strike,
                    moneyness: `${((strike/spotPrice)*100).toFixed(0)}%`,
                    callIV: data.calls.find(c=>c.strike===strike)?.iv ?? null,
                    putIV:  data.puts.find(c=>c.strike===strike)?.iv ?? null,
                  }))
                })()}
                margin={{ top: 8, right: 16, left: 40, bottom: 8 }}
              >
                <CartesianGrid stroke="#1e293b" strokeDasharray="2 4" />
                <XAxis dataKey="moneyness" tick={{ fontFamily:'IBM Plex Mono', fontSize:9, fill:'var(--text-muted)' }} />
                <YAxis domain={['auto','auto']} tick={{ fontFamily:'IBM Plex Mono', fontSize:9, fill:'var(--text-muted)' }} tickFormatter={v => `${v?.toFixed(0)}%`} />
                <Tooltip contentStyle={{ background:'var(--bg-panel)', border:'1px solid #1e293b', fontFamily:'IBM Plex Mono', fontSize:9 }} formatter={(v: any) => v ? `${Number(v).toFixed(1)}%` : 'N/A'} />
                <Legend wrapperStyle={{ fontFamily:'IBM Plex Mono', fontSize:9 }} />
                <Line type="monotone" dataKey="callIV" name="Call IV%" stroke="#22c55e" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="putIV"  name="Put IV%"  stroke="#ef4444" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* IV Heatmap grid */}
          <div style={{ border: '1px solid #1e293b', background: 'var(--bg-panel)' }}>
            <div className="panel-header"><span className="panel-header-title">IV HEATMAP — CALLS</span></div>
            <div style={{ padding: '8px 12px', overflowX: 'auto' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {data.calls.filter(c=>c.iv>0).sort((a,b)=>a.strike-b.strike).map(c => {
                  const iv = c.iv
                  const bg = iv>=80?'rgba(239,68,68,0.7)':iv>=60?'rgba(249,115,22,0.6)':iv>=40?'rgba(245,158,11,0.5)':iv>=20?'rgba(34,197,94,0.4)':'rgba(56,189,248,0.3)'
                  const mono = ((c.strike/spotPrice)*100).toFixed(0)
                  return (
                    <div key={c.strike} title={`Strike: $${c.strike} | IV: ${iv.toFixed(1)}% | Delta: ${c.delta?.toFixed(2)??'N/A'}`} style={{
                      width:60, height:50, background:bg, borderRadius:3, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1, cursor:'default', border:`1px solid ${c.inTheMoney?'rgba(56,189,248,0.5)':'rgba(30,41,59,0.4)'}`,
                    }}>
                      <span style={{ fontFamily:'IBM Plex Mono', fontSize:8, color:'var(--text-primary)' }}>${c.strike}</span>
                      <span style={{ fontFamily:'IBM Plex Mono', fontSize:11, fontWeight:700, color:'#fff' }}>{iv.toFixed(0)}%</span>
                      <span style={{ fontFamily:'IBM Plex Mono', fontSize:7, color:'rgba(255,255,255,0.7)' }}>{mono}%</span>
                    </div>
                  )
                })}
              </div>
              <div style={{ display:'flex', gap:12, marginTop:8, fontFamily:'IBM Plex Mono', fontSize:8, color:'var(--text-muted)' }}>
                {[['rgba(56,189,248,0.3)','<20% (Low)'],['rgba(34,197,94,0.4)','20-40%'],['rgba(245,158,11,0.5)','40-60%'],['rgba(249,115,22,0.6)','60-80%'],['rgba(239,68,68,0.7)','≥80% (Elevated)']].map(([bg,label])=>(
                  <div key={label} style={{display:'flex',alignItems:'center',gap:4}}>
                    <div style={{width:12,height:12,borderRadius:2,background:bg}} />{label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calls / Puts tabs + table */}
      {viewMode === 'chain' && <div style={{ flex: 1, minHeight: 0 }}>
        <PanelWrapper title={`${ticker} OPTIONS — ${tab.toUpperCase()}`}
          loading={loading} error={error} source={source} onRefresh={() => fetchData(ticker, expiry)}
          accentColor="#a78bfa">
          <div style={{ display: 'flex', borderBottom: '1px solid #1e293b' }}>
            {(['calls','puts'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '6px 0',
                fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
                textTransform: 'uppercase', border: 'none', cursor: 'pointer',
                background: tab === t ? 'rgba(167,139,250,0.1)' : 'transparent',
                color: tab === t ? '#a78bfa' : 'var(--text-muted)',
                borderBottom: tab === t ? '2px solid #a78bfa' : '2px solid transparent',
              }}>{t === 'calls' ? '▲ CALLS' : '▼ PUTS'}</button>
            ))}
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>STRIKE</th>
                <th>BID</th>
                <th>ASK</th>
                <th>MID</th>
                <th>LAST</th>
                <th>IV%</th>
                <th>VOLUME</th>
                <th>OI</th>
                <th>DELTA</th>
                <th>GAMMA</th>
                <th>THETA</th>
                <th>VEGA</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.contractSymbol} style={{
                  background: c.inTheMoney ? 'rgba(56,189,248,0.05)' : undefined,
                }}>
                  <td style={{
                    textAlign: 'left', fontWeight: 700,
                    color: c.inTheMoney ? 'var(--text-accent)' : 'var(--text-primary)',
                  }}>
                    ${c.strike?.toFixed(0)}
                    {c.inTheMoney && <span style={{ fontSize: 8, color: 'var(--text-accent)', marginLeft: 4 }}>ITM</span>}
                  </td>
                  <td>{c.bid?.toFixed(2) || '—'}</td>
                  <td>{c.ask?.toFixed(2) || '—'}</td>
                  <td style={{ color: 'var(--text-accent)', fontWeight: 600 }}>{c.mid?.toFixed(2) || '—'}</td>
                  <td>{c.lastPrice?.toFixed(2) || '—'}</td>
                  <td style={{ color: c.iv > 80 ? 'var(--text-negative)' : c.iv > 40 ? 'var(--text-warning)' : 'var(--text-secondary)' }}>
                    {c.iv?.toFixed(1)}%
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{c.volume?.toLocaleString() || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{c.openInterest?.toLocaleString() || '—'}</td>
                  <GreekCell v={c.delta} />
                  <GreekCell v={c.gamma} />
                  <GreekCell v={c.theta} />
                  <GreekCell v={c.vega} />
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
                    No contracts found for selected filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </PanelWrapper>
        {/* Greeks legend */}
        <div style={{ display: 'flex', gap: 16, padding: '4px 8px', fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)' }}>
          {[
            { label: 'DELTA', desc: 'Price sensitivity to $1 spot move' },
            { label: 'GAMMA', desc: 'Rate of delta change' },
            { label: 'THETA', desc: 'Daily time decay (negative)' },
            { label: 'VEGA',  desc: 'Sensitivity to 1% IV change' },
            { label: 'IV',    desc: 'Implied Volatility (annualized %)' },
          ].map(g => (
            <span key={g.label}>
              <span style={{ color: 'var(--text-accent)', fontWeight: 600 }}>{g.label}</span>: {g.desc}
            </span>
          ))}
        </div>
      </div>}
    </div>
  )
}
