'use client'
import { useEffect, useState, useCallback } from 'react'
import PanelWrapper from '@/components/panels/PanelWrapper'

function fmt(v: number | null, type: 'currency' | 'pct' | 'ratio' | 'shares' = 'currency'): string {
  if (v === null || v === undefined || isNaN(v as number)) return '—'
  if (type === 'pct')    return `${(v * 100).toFixed(2)}%`
  if (type === 'ratio')  return v.toFixed(2)
  if (type === 'shares') {
    if (Math.abs(v) >= 1e12) return `${(v/1e12).toFixed(2)}T`
    if (Math.abs(v) >= 1e9)  return `${(v/1e9).toFixed(2)}B`
    if (Math.abs(v) >= 1e6)  return `${(v/1e6).toFixed(0)}M`
    return v.toLocaleString()
  }
  if (Math.abs(v) >= 1e12) return `$${(v/1e12).toFixed(2)}T`
  if (Math.abs(v) >= 1e9)  return `$${(v/1e9).toFixed(2)}B`
  if (Math.abs(v) >= 1e6)  return `$${(v/1e6).toFixed(0)}M`
  return `$${v.toFixed(2)}`
}

function StatRow({ label, value, type, good }: { label: string; value: number | null; type?: any; good?: boolean }) {
  const display = fmt(value, type)
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: 'var(--bw) solid var(--divider)' }}>
      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{label}</span>
      <span className="gv-num" style={{ fontSize: 11, fontWeight: 600, color: display === '—' ? 'var(--text-muted)' : (good === true ? 'var(--text-positive)' : good === false ? 'var(--text-negative)' : 'var(--text-primary)') }}>
        {display}
      </span>
    </div>
  )
}

const POPULAR = ['AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','BRK-B','JPM','V','WMT','JNJ']
const TABS = ['income', 'balance', 'cashflow', 'metrics'] as const
type Tab = typeof TABS[number]

function StatementTable({ data, type }: { data: any[]; type: Tab }) {
  if (!data?.length) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 10 }}>No data available</div>

  const INCOME_ROWS = [
    { key: 'totalRevenue', label: 'Revenue' },
    { key: 'grossProfit', label: 'Gross Profit' },
    { key: 'operatingIncome', label: 'Operating Income' },
    { key: 'ebit', label: 'EBIT' },
    { key: 'ebitda', label: 'EBITDA' },
    { key: 'netIncome', label: 'Net Income' },
    { key: 'totalOperatingExpenses', label: 'Operating Expenses' },
    { key: 'researchDevelopment', label: 'R&D' },
    { key: 'sellingGeneralAdministrative', label: 'SG&A' },
    { key: 'interestExpense', label: 'Interest Expense' },
    { key: 'incomeTaxExpense', label: 'Tax Expense' },
    { key: 'dilutedEPS', label: 'Diluted EPS' },
  ]
  const BALANCE_ROWS = [
    { key: 'totalAssets', label: 'Total Assets' },
    { key: 'totalCurrentAssets', label: 'Current Assets' },
    { key: 'cash', label: 'Cash & Equivalents' },
    { key: 'shortTermInvestments', label: 'Short-term Investments' },
    { key: 'netReceivables', label: 'Net Receivables' },
    { key: 'inventory', label: 'Inventory' },
    { key: 'totalLiab', label: 'Total Liabilities' },
    { key: 'totalCurrentLiabilities', label: 'Current Liabilities' },
    { key: 'longTermDebt', label: 'Long-term Debt' },
    { key: 'totalStockholderEquity', label: 'Total Equity' },
    { key: 'retainedEarnings', label: 'Retained Earnings' },
    { key: 'commonStock', label: 'Common Stock' },
  ]
  const CASHFLOW_ROWS = [
    { key: 'totalCashFromOperatingActivities', label: 'Operating CF' },
    { key: 'capitalExpenditures', label: 'CapEx' },
    { key: 'totalCashFromInvestingActivities', label: 'Investing CF' },
    { key: 'totalCashFromFinancingActivities', label: 'Financing CF' },
    { key: 'changeInCash', label: 'Net Change in Cash' },
    { key: 'freeCashFlow', label: 'Free Cash Flow' },
    { key: 'dividendsPaid', label: 'Dividends Paid' },
    { key: 'repurchaseOfStock', label: 'Share Buybacks' },
    { key: 'depreciation', label: 'Depreciation' },
  ]

  const rows = type === 'income' ? INCOME_ROWS : type === 'balance' ? BALANCE_ROWS : CASHFLOW_ROWS
  const periods = data.map(d => {
    const raw = d.endDate
    if (!raw) return '—'
    return typeof raw === 'string' ? raw.slice(0, 7) : new Date(raw).toISOString().slice(0, 7)
  })

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table" style={{ minWidth: 500 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>ITEM</th>
            {periods.map((p, i) => <th key={i}>{p}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const vals = data.map(d => d[row.key] ?? null)
            return (
              <tr key={row.key}>
                <td style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>{row.label}</td>
                {vals.map((v, i) => (
                  <td key={i} style={{ color: v !== null && v < 0 ? 'var(--text-negative)' : 'var(--text-primary)', fontWeight: 500 }}>
                    {fmt(v)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function FinancialsPage() {
  const [ticker,  setTicker]  = useState('AAPL')
  const [input,   setInput]   = useState('AAPL')
  const [period,  setPeriod]  = useState<'annual'|'quarterly'>('annual')
  const [tab,     setTab]     = useState<Tab>('income')
  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState<string | undefined>() // API status → PanelWrapper badge
  const [error,   setError]   = useState<string|null>(null)

  const fetchData = useCallback(async (t: string, p: string) => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`/api/financials?ticker=${t}&period=${p}`)
      const json = await res.json()
      setSource(json.source)
      if (json.rateLimited) {
        setError('Yahoo Finance rate limit — auto-retrying in 30s...')
        setTimeout(() => fetchData(t, p), 30000)
        setLoading(false)
        return
      }
      if (json.error) throw new Error(json.error)
      setData(json.data)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(ticker, period) }, [ticker, period, fetchData])

  const km = data?.keyMetrics

  return (
    <div style={{ padding: 8, height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header */}
      <div className="gv-card" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 16px', flexShrink: 0, overflow: 'visible' }}>
        <span style={{ fontSize: 'var(--fs-header)', fontWeight: 700, color: 'var(--text)' }}>
          FINANCIAL STATEMENTS
        </span>
        <form onSubmit={e => { e.preventDefault(); setTicker(input.toUpperCase()) }} style={{ display: 'flex', gap: 6 }}>
          <input value={input} onChange={e => setInput(e.target.value.toUpperCase())} className="input-terminal" style={{ width: 100 }} placeholder="TICKER" aria-label="Ticker" />
          <button type="submit" className="btn-terminal">LOAD</button>
        </form>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['annual','quarterly'] as const).map(p => (
            <button key={p} type="button" className="gv-tab" aria-pressed={period === p} onClick={() => setPeriod(p)}>
              {p.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {POPULAR.map(t => (
            <button key={t} type="button" className="gv-tab" aria-pressed={ticker === t} onClick={() => { setTicker(t); setInput(t) }} style={{ padding: '2px 8px' }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 8, minHeight: 0 }}>
        {/* Left: key metrics */}
        {km && (
          <div style={{ width: 220, flexShrink: 0, overflowY: 'auto' }}>
            <div className="gv-card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 'var(--fs-header)', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                {ticker} — KEY METRICS
              </div>
              <StatRow label="Revenue"          value={km.revenue} />
              <StatRow label="Gross Profit"     value={km.grossProfit} />
              <StatRow label="EBITDA"           value={km.ebitda} />
              <StatRow label="Net Income"       value={km.netIncome} />
              <StatRow label="Free Cash Flow"   value={km.freeCashFlow} good={km.freeCashFlow > 0 ? true : false} />
              <StatRow label="Total Debt"       value={km.totalDebt} />
              <StatRow label="Total Cash"       value={km.totalCash} />
              <StatRow label="D/E Ratio"        value={km.debtToEquity}  type="ratio" />
              <StatRow label="Current Ratio"    value={km.currentRatio}  type="ratio" good={km.currentRatio > 1.5 ? true : km.currentRatio < 1 ? false : undefined} />
              <StatRow label="ROE"              value={km.returnOnEquity} type="pct" good={km.returnOnEquity > 0.15 ? true : undefined} />
              <StatRow label="ROA"              value={km.returnOnAssets} type="pct" good={km.returnOnAssets > 0.05 ? true : undefined} />
              <StatRow label="Profit Margin"    value={km.profitMargin}   type="pct" good={km.profitMargin > 0.1 ? true : undefined} />
              <StatRow label="Operating Margin" value={km.operatingMargin} type="pct" />
              <StatRow label="Gross Margin"     value={km.grossMargin}    type="pct" />
              <StatRow label="Revenue Growth"   value={km.revenueGrowth}  type="pct" good={km.revenueGrowth > 0 ? true : false} />
              <StatRow label="EPS (TTM)"        value={km.eps}            type="ratio" />
              <StatRow label="Book Value/Share" value={km.bookValue}      type="ratio" />
              <StatRow label="P/B Ratio"        value={km.priceToBook}    type="ratio" />
              <StatRow label="Beta"             value={km.beta}           type="ratio" />
              <StatRow label="Shares Out"       value={km.sharesOutstanding} type="shares" />
              <StatRow label="Short Ratio"      value={km.shortRatio}     type="ratio" />
              <StatRow label="Dividend Yield"   value={km.dividendYield}  type="pct" />
              <StatRow label="52W High"         value={km.fiftyTwoWeekHigh} type="ratio" />
              <StatRow label="52W Low"          value={km.fiftyTwoWeekLow}  type="ratio" />
            </div>
          </div>
        )}

        {/* Right: statements */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Tabs */}
          <div role="tablist" style={{ display: 'flex', gap: 2, borderBottom: 'var(--bw) solid var(--divider)' }}>
            {TABS.map(t => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} style={{ fontSize: 10, padding: '6px 14px', border: 'none', borderBottom: tab === t ? '3px solid var(--accent)' : '3px solid transparent', cursor: 'pointer', background: 'transparent', color: tab === t ? 'var(--text-accent)' : 'var(--text-2)', fontWeight: tab === t ? 700 : 500 }}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          <PanelWrapper title={`${ticker} — ${tab.toUpperCase()} STATEMENT (${period.toUpperCase()})`} loading={loading} error={error} source={source}>
            {data && tab !== 'metrics' && <StatementTable data={data[tab]} type={tab} />}
            {data && tab === 'metrics' && km && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: 8 }}>
                {[
                  { label: 'Revenue',       value: km.revenue         },
                  { label: 'Gross Profit',  value: km.grossProfit     },
                  { label: 'EBITDA',        value: km.ebitda          },
                  { label: 'Net Income',    value: km.netIncome       },
                  { label: 'Free CF',       value: km.freeCashFlow    },
                  { label: 'Op CF',         value: km.operatingCashFlow },
                  { label: 'Total Debt',    value: km.totalDebt       },
                  { label: 'Cash',          value: km.totalCash       },
                  { label: 'ROE',           value: km.returnOnEquity, type: 'pct' as const },
                  { label: 'ROA',           value: km.returnOnAssets, type: 'pct' as const },
                  { label: 'Net Margin',    value: km.profitMargin,   type: 'pct' as const },
                  { label: 'Op Margin',     value: km.operatingMargin, type: 'pct' as const },
                ].map(m => (
                  <div key={m.label} style={{ background: 'var(--surface-2)', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius-inner)', padding: '8px 12px' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{m.label}</div>
                    <div className="gv-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{fmt(m.value, m.type)}</div>
                  </div>
                ))}
              </div>
            )}
          </PanelWrapper>
        </div>
      </div>
    </div>
  )
}
