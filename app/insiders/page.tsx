'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const AIButton = dynamic(() => import('@/components/terminal/AIButton'), { ssr: false })

interface InsiderTx {
  id: string
  company: string
  ticker: string
  insider: string
  role: string | null
  transactionType: 'BUY' | 'SELL' | 'GIFT' | 'AWARD' | null
  // null when the EDGAR Atom summary doesn't disclose the figure.
  shares: number | null
  pricePerShare: number | null
  totalValue: number | null
  filedDate: string
  link: string
}

const TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  BUY: { color: 'var(--text-positive)', bg: 'var(--up-soft)' },
  SELL: { color: 'var(--text-negative)', bg: 'var(--down-soft)' },
  AWARD: { color: 'var(--info)', bg: 'transparent' },
  GIFT: { color: 'var(--text-accent)', bg: 'var(--accent-soft)' },
}

function TypeBadge({ type }: { type: string | null }) {
  if (!type) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const c = TYPE_COLORS[type] ?? { color: 'var(--text-secondary)', bg: 'transparent' }
  return (
    <span style={{ fontSize: 9, fontWeight: 700, color: c.color, background: c.bg, border: 'var(--bw) solid currentColor', padding: '1px 6px', borderRadius: 4 }}>
      {type}
    </span>
  )
}

function formatValue(v: number | null): string {
  if (v === null || isNaN(v)) return '—'
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
    <div className="gv-card" style={{ margin: 12, color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: 'var(--bw) solid var(--divider)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)' }}>SEC INSIDER TRANSACTIONS</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
            SEC Form 4 filings · Companies have up to 2 business days to report insider transactions · Dates shown are filing dates, not trade dates
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <AIButton panelName="Insider Transactions" panelData={txs.slice(0, 5)} context="Recent Form 4 insider transactions from SEC EDGAR. Look for clusters of insider buying/selling, big single transactions, and any notable corporate names. Provide market signal interpretation." />
          <select value={filter} aria-label="Transaction type" onChange={e => setFilter(e.target.value as any)}
            className="input-terminal" style={{ width: 'auto', fontSize: 10, padding: '4px 8px' }}>
            <option value="all">ALL TYPES</option>
            <option value="BUY">BUYS ONLY</option>
            <option value="SELL">SELLS ONLY</option>
            <option value="AWARD">AWARDS ONLY</option>
          </select>
          <select value={minVal} aria-label="Minimum value" onChange={e => setMinVal(parseInt(e.target.value))}
            className="input-terminal" style={{ width: 'auto', fontSize: 10, padding: '4px 8px' }}>
            <option value={100000}>$100K+</option>
            <option value={500000}>$500K+</option>
            <option value={1000000}>$1M+</option>
            <option value={5000000}>$5M+</option>
          </select>
          <button type="button" onClick={load} className="gv-tab">
            ↺ REFRESH
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '8px 16px', background: 'var(--down-soft)', borderBottom: 'var(--bw) solid var(--down)', fontSize: 10, color: 'var(--text-negative)' }}>
          EDGAR API: {error} — Showing cached data if available.
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr style={{ borderBottom: 'var(--bw) solid var(--divider)' }}>
              {['DATE', 'COMPANY', 'TICKER', 'INSIDER', 'ROLE', 'TYPE', 'SHARES', 'PRICE', 'TOTAL VALUE', 'SIGNAL', ''].map(h => (
                <th key={h} style={{ padding: '8px 10px 6px', textAlign: 'left', fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
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
                  className="gv-row"
                  style={{ borderBottom: 'var(--bw) solid var(--divider)', cursor: 'pointer', background: expanded === tx.id ? 'var(--surface-2)' : undefined }}
                >
                  <td className="gv-num" style={{ padding: '6px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{tx.filedDate}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--text-primary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.company}>{tx.company}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--text-accent)', fontWeight: 700 }}>{tx.ticker || '—'}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--text-secondary)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.insider}>{tx.insider}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{tx.role ?? '—'}</td>
                  <td style={{ padding: '6px 10px' }}><TypeBadge type={tx.transactionType} /></td>
                  <td className="gv-num" style={{ padding: '6px 10px', color: 'var(--text-primary)', textAlign: 'right' }}>{tx.shares !== null ? tx.shares.toLocaleString() : '—'}</td>
                  <td className="gv-num" style={{ padding: '6px 10px', color: 'var(--text-secondary)', textAlign: 'right' }}>{tx.pricePerShare !== null ? `$${tx.pricePerShare.toFixed(2)}` : '—'}</td>
                  <td className="gv-num" style={{ padding: '6px 10px', fontWeight: 700, textAlign: 'right', color: tx.transactionType === 'BUY' ? 'var(--text-positive)' : tx.transactionType === 'SELL' ? 'var(--text-negative)' : 'var(--text-secondary)' }}>
                    {formatValue(tx.totalValue)}
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    {tx.totalValue !== null && tx.totalValue >= 1000000 && tx.transactionType === 'BUY' && (
                      <span style={{ fontSize: 8, color: 'var(--text-positive)', background: 'var(--up-soft)', border: 'var(--bw) solid currentColor', padding: '1px 5px', borderRadius: 4 }}>▲ BULLISH</span>
                    )}
                    {tx.totalValue !== null && tx.totalValue >= 1000000 && tx.transactionType === 'SELL' && (
                      <span style={{ fontSize: 8, color: 'var(--text-negative)', background: 'var(--down-soft)', border: 'var(--bw) solid currentColor', padding: '1px 5px', borderRadius: 4 }}>▼ BEARISH</span>
                    )}
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{expanded === tx.id ? '▲' : '▼'}</span>
                  </td>
                </tr>
                {expanded === tx.id && (
                  <tr key={`${tx.id}-detail`} style={{ background: 'var(--surface-2)' }}>
                    <td colSpan={11} style={{ padding: '10px 16px', borderBottom: 'var(--bw) solid var(--divider)' }}>
                      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>FULL DETAILS</div>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                            {tx.insider}{tx.role ? ` (${tx.role})` : ''} filed Form 4 for {tx.company} on {tx.filedDate}.
                            {tx.transactionType ? ` Transaction: ${tx.transactionType}` : ' Transaction type not stated in the EDGAR feed.'}
                            {tx.shares !== null ? ` of ${tx.shares.toLocaleString()} shares` : ''}
                            {tx.pricePerShare !== null ? ` at $${tx.pricePerShare.toFixed(2)} each` : ''}
                            {tx.totalValue !== null
                              ? `. Total: ${formatValue(tx.totalValue)}.`
                              : '. Share count and price are not disclosed in the EDGAR feed — open the filing for full details.'}
                          </div>
                          <a href={tx.link} target="_blank" rel="noreferrer" style={{ fontSize: 9, color: 'var(--text-accent)', display: 'inline-block', marginTop: 6 }}>
                            VIEW ON SEC EDGAR →
                          </a>
                        </div>
                        <AIButton
                          panelName="Insider Transaction"
                          panelData={tx}
                          context={`Analyze this SEC Form 4 filing: ${tx.insider}${tx.role ? ` (${tx.role})` : ''} at ${tx.company}${tx.ticker ? ` (${tx.ticker})` : ''}. ${tx.transactionType ? `Transaction type: ${tx.transactionType}.` : 'The EDGAR feed does not state the transaction type.'} ${tx.shares !== null ? `${tx.shares.toLocaleString()} shares` : 'Share count undisclosed'}${tx.pricePerShare !== null ? ` at $${tx.pricePerShare.toFixed(2)}` : ''}${tx.totalValue !== null ? ` for a total of ${formatValue(tx.totalValue)}` : ' (transaction value not disclosed in the EDGAR feed)'} on ${tx.filedDate}. Is this a significant signal? What should investors watch?`}
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

      <div style={{ padding: '8px 16px', borderTop: 'var(--bw) solid var(--divider)', display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)' }}>
        <span>Source: SEC EDGAR Form 4 RSS · {displayed.length} transactions shown · Min value: {formatValue(minVal)}</span>
        <span>Data refreshed on page load · Non-real-time</span>
      </div>
    </div>
  )
}
