'use client'
import { useEffect, useState } from 'react'
import PanelWrapper from '@/components/panels/PanelWrapper'
import ForexPanel from '@/components/panels/ForexPanel'
import { MAJOR_PAIRS } from '@/lib/apis/forex'
import { usePolicyRates } from '@/lib/hooks/usePolicyRates'
import { pct } from '@/lib/format'

const MATRIX_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY']

interface PairData {
  pair: string
  base: string
  quote: string
  rate: number
  changePct: number | null
}

export default function ForexPage() {
  const [pairs, setPairs] = useState<PairData[]>([])
  const [rates, setRates] = useState<Record<string, number>>({})
  const [selectedPair, setSelectedPair] = useState('EUR/USD')
  const [loading, setLoading] = useState(true)
  const [pairsSource, setPairsSource] = useState<string | undefined>() // API status → PanelWrapper badge
  const [carryBase, setCarryBase] = useState('EUR')
  const [carryQuote, setCarryQuote] = useState('USD')

  const { rates: cbRates, error: cbError } = usePolicyRates()
  const cbRate = (currency: string) => cbRates.find(r => r.currency === currency)?.rate ?? null

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Daily change comes from Yahoo FX quotes. It used to be Math.random()
        // (and BID/ASK/SPREAD were the mid ± a made-up 0.02%); the rates feed
        // only carries a mid, so that's all the table shows now.
        const yahooSym = (p: { base: string; quote: string }) => `${p.base}${p.quote}=X`
        const [res, chgRes] = await Promise.all([
          fetch('/api/forex?type=pairs'),
          fetch(`/api/stocks?tickers=${MAJOR_PAIRS.map(yahooSym).join(',')}`).catch(() => null),
        ])
        const json = await res.json()
        setPairsSource(json.source)
        const chg: Record<string, number> = {}
        try {
          for (const q of (await chgRes?.json())?.data ?? []) {
            if (typeof q?.regularMarketChangePercent === 'number') chg[q.symbol] = q.regularMarketChangePercent
          }
        } catch { /* change stays null */ }
        if (json.data?.rates) {
          const r = json.data.rates
          setRates(r)
          const pairData: PairData[] = MAJOR_PAIRS.map(p => {
            let rate: number
            if (p.base === 'USD') rate = r[p.quote]
            else if (p.quote === 'USD') rate = 1 / r[p.base]
            else rate = r[p.quote] / r[p.base]
            return { ...p, rate: rate || 0, changePct: chg[yahooSym(p)] ?? null }
          })
          setPairs(pairData)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    fetchData()
    const id = setInterval(fetchData, 60000)
    return () => clearInterval(id)
  }, [])

  const borrowRate = cbRate(carryBase), investRate = cbRate(carryQuote)
  const carryReturn = borrowRate !== null && investRate !== null ? investRate - borrowRate : null

  return (
    <div className="p-2 flex gap-2 h-full">
      {/* Left: Cross Rate Matrix */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <ForexPanel />

        {/* Major Pairs Table */}
        <PanelWrapper title="MAJOR FX PAIRS" loading={loading} source={pairsSource}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>PAIR</th>
                <th>RATE (MID)</th>
                <th>CHG% (1D)</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map(p => (
                <tr
                  key={p.pair}
                  onClick={() => setSelectedPair(p.pair)}
                  style={{ cursor: 'pointer', background: selectedPair === p.pair ? '#0a140a' : 'transparent' }}
                >
                  <td style={{ textAlign: 'left' }}>
                    <span className={`font-bold ${selectedPair === p.pair ? 'text-accent' : 'text-primary'}`}>{p.pair}</span>
                  </td>
                  <td className="font-mono text-primary">
                    {p.rate >= 100 ? p.rate.toFixed(2) : p.rate >= 10 ? p.rate.toFixed(3) : p.rate.toFixed(4)}
                  </td>
                  <td className={p.changePct === null ? 'neutral' : p.changePct >= 0 ? 'positive' : 'negative'}>
                    {p.changePct === null ? '—' : pct(p.changePct, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PanelWrapper>
      </div>

      {/* Right Sidebar */}
      <div style={{ width: 260, flexShrink: 0 }} className="space-y-2">
        {/* Central Bank Rates */}
        <PanelWrapper title="CENTRAL BANK RATES" error={cbError}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>BANK</th>
                <th>RATE</th>
                <th>TREND</th>
              </tr>
            </thead>
            <tbody>
              {cbRates.map(cb => (
                <tr key={cb.bank} title={`as of ${cb.asOf}`}>
                  <td style={{ textAlign: 'left' }}>
                    <span className="text-primary text-[13px]">{cb.bank}</span>
                  </td>
                  <td className="font-mono text-accent">{cb.rate.toFixed(2)}%</td>
                  <td className={cb.trend === 'hike' ? 'positive' : cb.trend === 'cut' ? 'negative' : 'neutral'}>
                    {cb.trend === 'hike' ? '▲ HIKE' : cb.trend === 'cut' ? '▼ CUT' : '● HOLD'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PanelWrapper>

        {/* Carry Trade Calculator */}
        <PanelWrapper title="CARRY TRADE CALC">
          <div className="px-2 py-2 space-y-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="font-mono text-[11px] text-muted mb-1" style={{ minHeight: '2.6em', lineHeight: 1.3 }}>BORROW (LOW RATE)</div>
                <select
                  value={carryBase}
                  onChange={e => setCarryBase(e.target.value)}
                  className="input-terminal w-full"
                  style={{ padding: '5px 7px', fontSize: 'var(--fs-body)' }}
                >
                  {cbRates.map(r => (
                    <option key={r.currency} value={r.currency}>{r.currency} ({r.rate}%)</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <div className="font-mono text-[11px] text-muted mb-1" style={{ minHeight: '2.6em', lineHeight: 1.3 }}>INVEST (HIGH RATE)</div>
                <select
                  value={carryQuote}
                  onChange={e => setCarryQuote(e.target.value)}
                  className="input-terminal w-full"
                  style={{ padding: '5px 7px', fontSize: 'var(--fs-body)' }}
                >
                  {cbRates.map(r => (
                    <option key={r.currency} value={r.currency}>{r.currency} ({r.rate}%)</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="font-mono text-[11px] text-muted">BORROW RATE</span>
                <span className="font-mono text-[13px] text-negative">{borrowRate !== null ? `${borrowRate.toFixed(2)}%` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-[11px] text-muted">INVEST RATE</span>
                <span className="font-mono text-[13px] text-positive">{investRate !== null ? `${investRate.toFixed(2)}%` : '—'}</span>
              </div>
              <div className="flex justify-between" style={{ borderTop: '1px solid #1b2e1b', paddingTop: 4 }}>
                <span className="font-mono text-[11px] text-accent font-bold">CARRY RETURN</span>
                <span className={`font-mono text-[15px] font-bold ${carryReturn === null ? 'text-muted' : carryReturn >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {carryReturn === null ? '—' : pct(carryReturn, 2)}
                </span>
              </div>
            </div>
          </div>
        </PanelWrapper>
      </div>
    </div>
  )
}
