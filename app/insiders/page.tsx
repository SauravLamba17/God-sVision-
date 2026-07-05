'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const AIButton = dynamic(() => import('@/components/terminal/AIButton'), { ssr: false })

interface InsiderTx {
  id: string
  company: string
  ticker: string
  insider: string
  role: string
  transactionType: 'BUY' | 'SELL' | 'GIFT' | 'AWARD'
  shares: number
  pricePerShare: number
  totalValue: number
  filedDate: string
  link: string
}

const TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  BUY: { color: 'var(--text-positive)', bg: 'rgba(34,197,94,0.1)' },
  SELL: { color: 'var(--text-negative)', bg: 'rgba(239,68,68,0.1)' },
  AWARD: { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  GIFT: { color: 'var(--text-accent)', bg: 'rgba(56,189,248,0.1)' },
}

function TypeBadge({ type }: { type: string }) {
  const c = TYPE_COLORS[type] ?? { color: 'var(--text-secondary)', bg: 'rgba(148,163,184,0.1)' }
  return (
    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, fontWeight: 700, color: c.color, background: c.bg, padding: '2px 6px', borderRadius: 2 }}>
      {type}
    </span>
  )
}

function formatValue(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

export default function InsidersPage() {
  const [txs, setTxs] = useState<InsiderTx[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'BUY' | 'SELL' | 'AWARD'>('all')
  const [minVal, setMinVal] = useState(100000)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/insiders?minValue=${minVal}&type=${filter}`)
      const j = await res.json()
      if (j.error) setError(j.error)
      setTxs(j.data ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [filter, minVal])

  const displayed = txs.filter(t => filter === 'all' || t.transactionType === filter)

  return (
    <div style={{ fontFamily: 'IBM Plex Mono', background: 'var(--bg-terminal)', minHeight: '100%', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1b2e1b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-accent)', letterSpacing: '0.1em' }}>SEC INSIDER TRANSACTIONS</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>Form 4 Filings â€” EDGAR Â· Real-Time Feed</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <AIButton panelName="Insider Transactions" panelData={txs.slice(0, 5)} context="Recent Form 4 insider transactions from SEC EDGAR. Look for clusters of insider buying/selling, big single transactions, and any notable corporate names. Provide market signal interpretation." />
          <select value={filter} onChange={e => setFilter(e.target.value as any)}
            style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, background: 'var(--bg-header)', color: 'var(--text-primary)', border: '1px solid #1b2e1b', padding: '4px 8px', borderRadius: 2 }}>
            <option value="all">ALL TYPES</option>
            <option value="BUY">BUYS ONLY</option>
            <option value="SELL">SELLS ONLY</option>
            <option value="AWARD">AWARDS ONLY</option>
          </select>
          <select value={minVal} onChange={e => setMinVal(parseInt(e.target.value))}
            style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, background: 'var(--bg-header)', color: 'var(--text-primary)', border: '1px solid #1b2e1b', padding: '4px 8px', borderRadius: 2 }}>
            <option value={100000}>$100K+</option>
            <option value={500000}>$500K+</option>
            <option value={1000000}>$1M+</option>
            <option value={5000000}>$5M+</option>
          </select>
          <button onClick={load} style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, background: 'var(--border-color)', color: 'var(--text-positive)', border: '1px solid #22c55e40', padding: '4px 10px', borderRadius: 2, cursor: 'pointer' }}>
            â†º REFRESH
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '8px 16px', background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid #ef444430', fontSize: 10, color: 'var(--text-negative)' }}>
          EDGAR API: {error} â€” Showing cached data if available.
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr style={{ background: 'var(--bg-panel)', borderBottom: '1px solid #1b2e1b' }}>
              {['DATE', 'COMPANY', 'TICKER', 'INSIDER', 'ROLE', 'TYPE', 'SHARES', 'PRICE', 'TOTAL VALUE', 'SIGNAL', ''].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: 'var(--text-accent)', fontSize: 10 }}>FETCHING EDGAR FORM 4 FILINGS...</td></tr>
            )}
            {!loading && displayed.length === 0 && (
              <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 10 }}>No transactions match filters. EDGAR may be throttling requests.</td></tr>
            )}
            {displayed.map(tx => (
              <>
                <tr
                  key={tx.id}
                  onClick={() => setExpanded(expanded === tx.id ? null : tx.id)}
                  style={{ borderBottom: '1px solid #0d1526', cursor: 'pointer', background: expanded === tx.id ? 'rgba(255,109,0,0.04)' : 'transparent' }}
                >
                  <td style={{ padding: '6px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{tx.filedDate}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--text-primary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.company}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--text-accent)', fontWeight: 700 }}>{tx.ticker || 'â€”'}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--text-secondary)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.insider}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{tx.role}</td>
                  <td style={{ padding: '6px 10px' }}><TypeBadge type={tx.transactionType} /></td>
                  <td style={{ padding: '6px 10px', color: 'var(--text-primary)', textAlign: 'right' }}>{tx.shares.toLocaleString()}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--text-secondary)', textAlign: 'right' }}>${tx.pricePerShare.toFixed(2)}</td>
                  <td style={{ padding: '6px 10px', fontWeight: 700, textAlign: 'right', color: tx.transactionType === 'BUY' ? 'var(--text-positive)' : tx.transactionType === 'SELL' ? 'var(--text-negative)' : 'var(--text-secondary)' }}>
                    {formatValue(tx.totalValue)}
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    {tx.totalValue >= 1000000 && tx.transactionType === 'BUY' && (
                      <span style={{ fontSize: 8, color: 'var(--text-positive)', background: 'rgba(34,197,94,0.1)', padding: '1px 5px', borderRadius: 2 }}>BULLISH</span>
                    )}
                    {tx.totalValue >= 1000000 && tx.transactionType === 'SELL' && (
                      <span style={{ fontSize: 8, color: 'var(--text-negative)', background: 'rgba(239,68,68,0.1)', padding: '1px 5px', borderRadius: 2 }}>BEARISH</span>
                    )}
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{expanded === tx.id ? 'â–²' : 'â–¼'}</span>
                  </td>
                </tr>
                {expanded === tx.id && (
                  <tr key={`${tx.id}-detail`} style={{ background: 'var(--bg-terminal)' }}>
                    <td colSpan={11} style={{ padding: '10px 16px', borderBottom: '1px solid #1b2e1b' }}>
                      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>FULL DETAILS</div>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                            {tx.insider} ({tx.role}) filed Form 4 for {tx.company} on {tx.filedDate}.
                            Transaction: {tx.transactionType} of {tx.shares.toLocaleString()} shares at ${tx.pricePerShare.toFixed(2)} each. Total: {formatValue(tx.totalValue)}.
                          </div>
                          <a href={tx.link} target="_blank" rel="noreferrer" style={{ fontSize: 9, color: 'var(--text-accent)', display: 'inline-block', marginTop: 6 }}>
                            VIEW ON SEC EDGAR â†’
                          </a>
                        </div>
                        <AIButton
                          panelName="Insider Transaction"
                          panelData={tx}
                          context={`Analyze this insider transaction: ${tx.insider} (${tx.role}) at ${tx.company} (${tx.ticker}) ${tx.transactionType === 'BUY' ? 'bought' : 'sold'} ${tx.shares.toLocaleString()} shares at $${tx.pricePerShare.toFixed(2)} for a total of ${formatValue(tx.totalValue)} on ${tx.filedDate}. Is this a significant signal? What should investors watch?`}
                          style={{ marginTop: 0 }}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '8px 16px', borderTop: '1px solid #1b2e1b', display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)' }}>
        <span>Source: SEC EDGAR Form 4 RSS Â· {displayed.length} transactions shown Â· Min value: {formatValue(minVal)}</span>
        <span>Data refreshed on page load Â· Non-real-time</span>
      </div>
    </div>
  )
}
