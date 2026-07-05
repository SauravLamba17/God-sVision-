'use client'
import { useEffect, useState, useCallback } from 'react'
import PanelWrapper from '@/components/panels/PanelWrapper'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import {
  sharpeRatio, sortinoRatio, beta, maxDrawdown, valueAtRisk,
  dailyReturns, conditionalVaR, correlationMatrix,
} from '@/lib/portfolio-analytics'

interface Holding {
  id: number; ticker: string; name: string; quantity: number; buyPrice: number
  buyDate: string; currentPrice?: number; currentValue?: number
  pnl?: number; pnlPct?: number; dayChange?: number
}

interface Tx {
  id: number; ticker: string; type: string; quantity: number; price: number
  date: string; fee: number; notes: string
}

const COLORS = ['var(--text-accent)','#a78bfa','var(--text-positive)','var(--text-warning)','var(--text-negative)','#fb923c','#06b6d4','#84cc16','#e879f9']

function RiskBadge({ label, value, good, warn }: { label: string; value: string; good?: boolean; warn?: boolean }) {
  const color = good ? 'var(--text-positive)' : warn ? 'var(--text-warning)' : 'var(--text-secondary)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 10px', background: `${color}08`, border: `1px solid ${color}25`, borderRadius: 4, minWidth: 80 }}>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 14, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.06em', textAlign: 'center' }}>{label}</span>
    </div>
  )
}

export default function PortfolioPage() {
  const [holdings,    setHoldings]   = useState<Holding[]>([])
  const [loading,     setLoading]    = useState(true)
  const [form,        setForm]       = useState({ ticker: '', name: '', quantity: '', buyPrice: '', buyDate: new Date().toISOString().slice(0, 10) })
  const [showForm,    setShowForm]   = useState(false)
  const [totalValue,  setTotalValue] = useState(0)
  const [totalPnL,    setTotalPnL]   = useState(0)
  const [dayChange,   setDayChange]  = useState(0)
  const [riskMetrics, setRiskMetrics]= useState<any>(null)
  const [riskLoading, setRiskLoading]= useState(false)
  const [txs,         setTxs]        = useState<Tx[]>([])
  const [txForm,      setTxForm]     = useState({ ticker: '', type: 'BUY', quantity: '', price: '', date: new Date().toISOString().slice(0,10), fee: '0', notes: '' })
  const [showTxForm,  setShowTxForm] = useState(false)

  const computeRisk = useCallback(async (tickers: string[]) => {
    if (tickers.length === 0) return
    setRiskLoading(true)
    try {
      const [chartResults, spyResult] = await Promise.allSettled([
        Promise.allSettled(tickers.map(t => fetch(`/api/technicals?ticker=${t}&period=1y`).then(r => r.json()))),
        fetch('/api/technicals?ticker=SPY&period=1y').then(r => r.json()),
      ])

      const spyPrices: number[] = spyResult.status === 'fulfilled'
        ? (spyResult.value.data?.candles || []).map((c: any) => c.close)
        : []
      const spyRet = dailyReturns(spyPrices)

      const assetReturns: Record<string, number[]> = {}
      if (chartResults.status === 'fulfilled') {
        chartResults.value.forEach((r: any, i: number) => {
          if (r.status === 'fulfilled' && r.value?.data?.candles) {
            const prices = r.value.data.candles.map((c: any) => c.close)
            assetReturns[tickers[i]] = dailyReturns(prices)
          }
        })
      }

      const allReturns = Object.values(assetReturns).flat()
      const combinedPrices = spyPrices.length > 0 ? spyPrices : []

      const sharpe  = sharpeRatio(allReturns)
      const sortino = sortinoRatio(allReturns)
      const maxDD   = maxDrawdown(combinedPrices)
      const var95   = valueAtRisk(allReturns, 0.95)
      const cvar95  = conditionalVaR(allReturns, 0.95)

      const betas = Object.entries(assetReturns).map(([t, ret]) => ({
        ticker: t, beta: beta(ret, spyRet),
      }))

      const corrResult = Object.keys(assetReturns).length >= 2
        ? correlationMatrix(assetReturns) : null

      setRiskMetrics({ sharpe, sortino, maxDD, var95, cvar95, betas, corrMatrix: corrResult })
    } catch { /* silent */ }
    finally { setRiskLoading(false) }
  }, [])

  const loadHoldings = useCallback(async () => {
    try {
      const res  = await fetch('/api/portfolio')
      const json = await res.json()
      if (json.data) {
        const h: Holding[] = json.data
        const tickers = h.map((x: Holding) => x.ticker).filter(Boolean)
        if (tickers.length > 0) {
          const qRes  = await fetch(`/api/stocks?tickers=${tickers.join(',')}`)
          const qJson = await qRes.json()
          const prices: Record<string, { price: number; change: number }> = {}
          if (qJson.data) {
            qJson.data.forEach((q: any) => { prices[q.symbol] = { price: q.regularMarketPrice, change: q.regularMarketChange } })
          }
          const enriched = h.map((x: Holding) => {
            const p         = prices[x.ticker]
            const current   = p?.price || x.buyPrice
            const val       = current * x.quantity
            const cost      = x.buyPrice * x.quantity
            const pnl       = val - cost
            const pnlPct    = (pnl / cost) * 100
            const dc        = (p?.change || 0) * x.quantity
            return { ...x, currentPrice: current, currentValue: val, pnl, pnlPct, dayChange: dc }
          })
          setHoldings(enriched)
          setTotalValue(enriched.reduce((s, x) => s + (x.currentValue || 0), 0))
          setTotalPnL(enriched.reduce((s, x) => s + (x.pnl || 0), 0))
          setDayChange(enriched.reduce((s, x) => s + (x.dayChange || 0), 0))
          computeRisk(tickers)
        } else {
          setHoldings(h)
        }
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [computeRisk])

  const loadTxs = useCallback(async () => {
    try {
      const res = await fetch('/api/transactions')
      const j = await res.json()
      if (j.data) setTxs(j.data)
    } catch {}
  }, [])

  useEffect(() => { loadHoldings(); loadTxs(); const id = setInterval(loadHoldings, 30000); return () => clearInterval(id) }, [loadHoldings, loadTxs])

  const addTx = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(txForm) })
    setTxForm({ ticker: '', type: 'BUY', quantity: '', price: '', date: new Date().toISOString().slice(0,10), fee: '0', notes: '' })
    setShowTxForm(false)
    loadTxs()
  }

  const deleteTx = async (id: number) => {
    await fetch(`/api/transactions?id=${id}`, { method: 'DELETE' })
    setTxs(prev => prev.filter(t => t.id !== id))
  }

  const addHolding = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetch('/api/portfolio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setForm({ ticker: '', name: '', quantity: '', buyPrice: '', buyDate: new Date().toISOString().slice(0, 10) })
    setShowForm(false)
    loadHoldings()
  }

  const removeHolding = async (id: number) => {
    await fetch(`/api/portfolio?id=${id}`, { method: 'DELETE' })
    loadHoldings()
  }

  const pieData   = holdings.map((h, i) => ({ name: h.ticker, value: h.currentValue || 0, color: COLORS[i % COLORS.length] })).filter(h => h.value > 0)
  const costBasis = holdings.reduce((s, h) => s + h.buyPrice * h.quantity, 0)

  return (
    <div className="p-2 flex gap-2 h-full">
      {/* Left: Summary + Risk */}
      <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        {/* P&L Summary */}
        <div style={{ border: '1px solid #1e293b', borderLeft: '2px solid #22c55e', background: 'linear-gradient(135deg, #0a0f1e, #0d1526)', padding: '10px 12px' }}>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 700, color: 'var(--text-positive)', letterSpacing: '0.08em', marginBottom: 8 }}>PORTFOLIO SUMMARY</div>
          {[
            { label: 'TOTAL VALUE',  value: formatCurrency(totalValue), color: 'var(--text-primary)', big: true },
            { label: 'TOTAL P&L',    value: `${totalPnL >= 0 ? '+' : ''}${formatCurrency(totalPnL)}`, color: totalPnL >= 0 ? 'var(--text-positive)' : 'var(--text-negative)' },
            { label: 'P&L %',        value: costBasis > 0 ? formatPercent((totalPnL / costBasis) * 100) : 'N/A', color: totalPnL >= 0 ? 'var(--text-positive)' : 'var(--text-negative)' },
            { label: 'DAY CHANGE',   value: `${dayChange >= 0 ? '+' : ''}${formatCurrency(dayChange)}`, color: dayChange >= 0 ? 'var(--text-positive)' : 'var(--text-negative)' },
            { label: 'POSITIONS',    value: String(holdings.length), color: 'var(--text-accent)' },
            { label: 'COST BASIS',   value: formatCurrency(costBasis), color: 'var(--text-secondary)' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(30,41,59,0.5)' }}>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)' }}>{row.label}</span>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: row.big ? 14 : 12, fontWeight: 700, color: row.color }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Risk Metrics */}
        {riskMetrics && (
          <div style={{ border: '1px solid #1e293b', borderLeft: '2px solid #a78bfa', background: 'var(--bg-panel)', padding: '10px 12px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.08em', marginBottom: 8 }}>
              RISK ANALYTICS (1Y)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              <RiskBadge label="SHARPE" value={riskMetrics.sharpe.toFixed(2)} good={riskMetrics.sharpe > 1} warn={riskMetrics.sharpe > 0} />
              <RiskBadge label="SORTINO" value={riskMetrics.sortino > 99 ? 'âˆž' : riskMetrics.sortino.toFixed(2)} good={riskMetrics.sortino > 1.5} warn={riskMetrics.sortino > 0.5} />
              <RiskBadge label="MAX DD" value={`${(riskMetrics.maxDD * 100).toFixed(1)}%`} warn={riskMetrics.maxDD < 0.15} good={false} />
              <RiskBadge label="VAR 95%" value={`${(riskMetrics.var95 * 100).toFixed(2)}%`} />
              <RiskBadge label="CVAR 95%" value={`${(riskMetrics.cvar95 * 100).toFixed(2)}%`} />
            </div>
            {riskMetrics.betas.length > 0 && (
              <div>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.06em' }}>BETA vs SPY</div>
                {riskMetrics.betas.map((b: any) => (
                  <div key={b.ticker} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', borderBottom: '1px solid rgba(30,41,59,0.4)' }}>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-accent)', fontWeight: 700 }}>{b.ticker}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 60, height: 3, background: 'var(--border-color)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, Math.abs(b.beta) * 50)}%`, height: '100%', background: b.beta > 1.5 ? 'var(--text-negative)' : b.beta > 0.8 ? 'var(--text-warning)' : 'var(--text-positive)', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: b.beta > 1.5 ? 'var(--text-negative)' : b.beta > 0.8 ? 'var(--text-warning)' : 'var(--text-positive)', fontWeight: 600, minWidth: 30, textAlign: 'right' }}>
                        {b.beta.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {riskLoading && (
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#a78bfa', padding: 8 }}>
            COMPUTING RISK METRICS<span className="blink-cursor" />
          </div>
        )}

        {/* Correlation Matrix */}
        {riskMetrics?.corrMatrix && riskMetrics.corrMatrix.tickers.length >= 2 && (
          <div style={{ border: '1px solid #1e293b', borderLeft: '2px solid #38bdf8', background: 'var(--bg-panel)', padding: '10px 12px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 700, color: 'var(--text-accent)', letterSpacing: '0.08em', marginBottom: 8 }}>
              CORRELATION MATRIX (1Y)
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 9, fontFamily: 'IBM Plex Mono' }}>
                <thead>
                  <tr>
                    <td style={{ padding: '2px 4px', color: 'var(--text-muted)', minWidth: 36 }}></td>
                    {riskMetrics.corrMatrix.tickers.map((t: string) => (
                      <td key={t} style={{ padding: '2px 4px', color: 'var(--text-accent)', fontWeight: 700, textAlign: 'center', minWidth: 36 }}>{t}</td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {riskMetrics.corrMatrix.tickers.map((rowT: string, i: number) => (
                    <tr key={rowT}>
                      <td style={{ padding: '2px 4px', color: 'var(--text-accent)', fontWeight: 700 }}>{rowT}</td>
                      {riskMetrics.corrMatrix.matrix[i].map((c: number, j: number) => {
                        const isDiag = i === j
                        const bg = isDiag ? '#38bdf820'
                          : c >= 0.8  ? '#ef444430'
                          : c >= 0.5  ? '#f59e0b25'
                          : c >= 0.2  ? '#94a3b815'
                          : c >= 0    ? '#22c55e15'
                          : '#6366f120'
                        const color = isDiag ? 'var(--text-accent)'
                          : c >= 0.8  ? 'var(--text-negative)'
                          : c >= 0.5  ? 'var(--text-warning)'
                          : c >= 0.2  ? 'var(--text-secondary)'
                          : c >= 0    ? 'var(--text-positive)'
                          : '#a78bfa'
                        return (
                          <td key={j} title={`${rowT} vs ${riskMetrics.corrMatrix.tickers[j]}: ${c.toFixed(3)}`} style={{
                            padding: '2px 4px', textAlign: 'center', background: bg,
                            color, fontWeight: isDiag ? 700 : 500,
                            border: '1px solid rgba(30,41,59,0.4)', borderRadius: 2,
                          }}>
                            {c.toFixed(2)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                {[
                  { range: 'â‰¥0.8', color: 'var(--text-negative)', label: 'High' },
                  { range: 'â‰¥0.5', color: 'var(--text-warning)', label: 'Med' },
                  { range: 'â‰¥0.2', color: 'var(--text-secondary)', label: 'Low' },
                  { range: 'â‰¥0',   color: 'var(--text-positive)', label: '+Div' },
                  { range: '<0',   color: '#a78bfa', label: 'Neg' },
                ].map(l => (
                  <div key={l.range} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 1, background: l.color + '40', border: `1px solid ${l.color}` }} />
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 7, color: 'var(--text-muted)' }}>{l.range} {l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Allocation Pie */}
        {pieData.length > 0 && (
          <div style={{ border: '1px solid #1e293b', background: 'var(--bg-panel)' }}>
            <div className="panel-header">
              <span className="panel-header-title">ALLOCATION</span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={65} dataKey="value" isAnimationActive={false}
                  label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                  labelLine={{ stroke: 'var(--border-color)' }}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ background: 'var(--bg-panel)', border: '1px solid #1e293b', fontFamily: 'IBM Plex Mono', fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Add Holding */}
        <div style={{ border: '1px solid #1e293b', background: 'var(--bg-panel)' }}>
          <div className="panel-header">
            <span className="panel-header-title">ADD POSITION</span>
            <button onClick={() => setShowForm(s => !s)} style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
              {showForm ? 'â–¼' : 'â–¶'}
            </button>
          </div>
          {showForm && (
            <form onSubmit={addHolding} style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { key: 'ticker', label: 'TICKER', placeholder: 'AAPL' },
                { key: 'name', label: 'NAME', placeholder: 'Apple Inc.' },
                { key: 'quantity', label: 'QUANTITY', placeholder: '10', type: 'number' },
                { key: 'buyPrice', label: 'BUY PRICE ($)', placeholder: '150.00', type: 'number' },
                { key: 'buyDate', label: 'BUY DATE', placeholder: '', type: 'date' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)' }}>{f.label}</label>
                  <input value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} type={f.type || 'text'}
                    step={f.type === 'number' ? '0.0001' : undefined}
                    className="input-terminal w-full" style={{ marginTop: 2 }} required />
                </div>
              ))}
              <button type="submit" className="btn-terminal w-full">+ ADD POSITION</button>
            </form>
          )}
        </div>
      </div>

      {/* Right: Holdings Table + Transactions */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PanelWrapper title={`PORTFOLIO HOLDINGS â€” ${holdings.length} POSITIONS`} loading={loading} source="live" accentColor="#22c55e">
          {holdings.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12 }}>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)' }}>NO POSITIONS â€” ADD YOUR FIRST HOLDING</span>
              <button onClick={() => setShowForm(true)} className="btn-terminal">+ ADD POSITION</button>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>TICKER</th>
                  <th>QTY</th>
                  <th>BUY PRICE</th>
                  <th>CURR PRICE</th>
                  <th>MARKET VAL</th>
                  <th>WEIGHT%</th>
                  <th>P&L ($)</th>
                  <th>P&L (%)</th>
                  <th>DAY CHG</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {holdings.map(h => (
                  <tr key={h.id}>
                    <td style={{ textAlign: 'left' }}>
                      <span style={{ color: 'var(--text-accent)', fontWeight: 700 }}>{h.ticker}</span>
                      <br />
                      <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>{(h.name || '').slice(0, 16)}</span>
                    </td>
                    <td>{h.quantity}</td>
                    <td>{formatCurrency(h.buyPrice)}</td>
                    <td style={{ fontWeight: 600 }}>{h.currentPrice ? formatCurrency(h.currentPrice) : 'â€”'}</td>
                    <td style={{ color: 'var(--text-primary)' }}>{h.currentValue ? formatCurrency(h.currentValue) : 'â€”'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {totalValue > 0 && h.currentValue ? `${((h.currentValue / totalValue) * 100).toFixed(1)}%` : 'â€”'}
                    </td>
                    <td style={{ color: (h.pnl || 0) >= 0 ? 'var(--text-positive)' : 'var(--text-negative)', fontWeight: 600 }}>
                      {h.pnl !== undefined ? `${h.pnl >= 0 ? '+' : ''}${formatCurrency(Math.abs(h.pnl))}` : 'â€”'}
                    </td>
                    <td style={{ color: (h.pnlPct || 0) >= 0 ? 'var(--text-positive)' : 'var(--text-negative)' }}>
                      {h.pnlPct !== undefined ? formatPercent(h.pnlPct) : 'â€”'}
                    </td>
                    <td style={{ color: (h.dayChange || 0) >= 0 ? 'var(--text-positive)' : 'var(--text-negative)' }}>
                      {h.dayChange !== undefined ? `${h.dayChange >= 0 ? '+' : ''}$${Math.abs(h.dayChange).toFixed(2)}` : 'â€”'}
                    </td>
                    <td>
                      <button onClick={() => removeHolding(h.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-negative)', fontSize: 12, padding: '0 4px' }}>âœ•</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </PanelWrapper>

        {/* Transaction History */}
        <div style={{ border: '1px solid #1e293b', background: 'var(--bg-panel)' }}>
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px' }}>
            <span className="panel-header-title">TRANSACTION HISTORY ({txs.length})</span>
            <button onClick={() => setShowTxForm(s => !s)} style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-accent)', background: 'none', border: '1px solid #1b2e1b', padding: '2px 8px', cursor: 'pointer', borderRadius: 2 }}>
              {showTxForm ? 'â–¼ CANCEL' : '+ LOG TRADE'}
            </button>
          </div>
          {showTxForm && (
            <form onSubmit={addTx} style={{ padding: '8px 12px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', borderBottom: '1px solid #1e293b' }}>
              {[{ k:'ticker', l:'TICKER', p:'AAPL', w:70 }, { k:'quantity', l:'QTY', p:'10', w:60, t:'number' }, { k:'price', l:'PRICE', p:'150', w:80, t:'number' }, { k:'date', l:'DATE', p:'', w:120, t:'date' }, { k:'fee', l:'FEE', p:'0', w:60, t:'number' }].map(f => (
                <div key={f.k}>
                  <label style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>{f.l}</label>
                  <input value={txForm[f.k as keyof typeof txForm]} onChange={e => setTxForm(p => ({ ...p, [f.k]: f.k === 'ticker' ? e.target.value.toUpperCase() : e.target.value }))}
                    placeholder={f.p} type={f.t || 'text'} step={f.t === 'number' ? '0.0001' : undefined}
                    className="input-terminal" style={{ width: f.w }} required={f.k !== 'fee'} />
                </div>
              ))}
              <div>
                <label style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>TYPE</label>
                <select value={txForm.type} onChange={e => setTxForm(p => ({ ...p, type: e.target.value }))} className="input-terminal">
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>
              <button type="submit" className="btn-terminal" style={{ alignSelf: 'flex-end' }}>SAVE</button>
            </form>
          )}
          {txs.length === 0 ? (
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)', padding: 16, textAlign: 'center' }}>
              No transactions logged. Click + LOG TRADE to record.
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th style={{ textAlign: 'left' }}>DATE</th><th style={{ textAlign: 'left' }}>TICKER</th><th>TYPE</th><th>QTY</th><th>PRICE</th><th>VALUE</th><th>FEE</th><th>NOTES</th><th></th></tr></thead>
              <tbody>
                {txs.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 9 }}>{new Date(tx.date).toLocaleDateString()}</td>
                    <td style={{ textAlign: 'left', color: 'var(--text-accent)', fontWeight: 700 }}>{tx.ticker}</td>
                    <td><span style={{ fontSize: 9, fontWeight: 700, color: tx.type === 'BUY' ? 'var(--text-positive)' : 'var(--text-negative)', background: tx.type === 'BUY' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '1px 5px', borderRadius: 2 }}>{tx.type}</span></td>
                    <td>{tx.quantity}</td>
                    <td>{formatCurrency(tx.price)}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(tx.quantity * tx.price)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{tx.fee > 0 ? formatCurrency(tx.fee) : 'â€”'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 9, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.notes || 'â€”'}</td>
                    <td><button onClick={() => deleteTx(tx.id)} style={{ background: 'none', border: 'none', color: 'var(--text-negative)', cursor: 'pointer', fontSize: 11 }}>âœ•</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
