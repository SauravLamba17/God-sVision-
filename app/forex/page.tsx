'use client'
import { useEffect, useState } from 'react'
import PanelWrapper from '@/components/panels/PanelWrapper'
import ForexPanel from '@/components/panels/ForexPanel'
import { CENTRAL_BANK_RATES, MAJOR_PAIRS } from '@/lib/apis/forex'

const MATRIX_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY']

interface PairData {
  pair: string
  base: string
  quote: string
  rate: number
  bid: number
  ask: number
  spread: number
  change: number
  changePct: number
}

export default function ForexPage() {
  const [pairs, setPairs] = useState<PairData[]>([])
  const [rates, setRates] = useState<Record<string, number>>({})
  const [selectedPair, setSelectedPair] = useState('EUR/USD')
  const [loading, setLoading] = useState(true)
  const [carryBase, setCarryBase] = useState('JPY')
  const [carryQuote, setCarryQuote] = useState('AUD')

  const cbRate = (currency: string) => {
    const cb = CENTRAL_BANK_RATES.find(r => r.currency === currency)
    return cb?.rate || 0
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/forex?type=pairs')
        const json = await res.json()
        if (json.data?.rates) {
          const r = json.data.rates
          setRates(r)
          const pairData: PairData[] = MAJOR_PAIRS.map(p => {
            let rate: number
            if (p.base === 'USD') rate = r[p.quote]
            else if (p.quote === 'USD') rate = 1 / r[p.base]
            else rate = r[p.quote] / r[p.base]
            const spread = rate * 0.0002
            return {
              ...p,
              rate: rate || 0,
              bid: (rate || 0) - spread,
              ask: (rate || 0) + spread,
              spread: spread * 10000,
              change: ((rate || 0) - (rate || 0) * 0.998) * (Math.random() > 0.5 ? 1 : -1),
              changePct: (Math.random() - 0.5) * 0.4,
            }
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

  const carryReturn = cbRate(carryQuote) - cbRate(carryBase)

  return (
    <div className="p-2 flex gap-2 h-full">
      {/* Left: Cross Rate Matrix */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <ForexPanel />

        {/* Major Pairs Table */}
        <PanelWrapper title="MAJOR FX PAIRS" loading={loading}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>PAIR</th>
                <th>BID</th>
                <th>ASK</th>
                <th>SPREAD (pips)</th>
                <th>CHG%</th>
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
                  <td className="font-mono text-positive">
                    {p.rate >= 100 ? p.bid.toFixed(2) : p.rate >= 10 ? p.bid.toFixed(3) : p.bid.toFixed(4)}
                  </td>
                  <td className="font-mono text-negative">
                    {p.rate >= 100 ? p.ask.toFixed(2) : p.rate >= 10 ? p.ask.toFixed(3) : p.ask.toFixed(4)}
                  </td>
                  <td className="font-mono text-neutral">{p.spread.toFixed(1)}</td>
                  <td className={p.changePct >= 0 ? 'positive' : 'negative'}>
                    {p.changePct >= 0 ? '+' : ''}{p.changePct.toFixed(2)}%
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
        <PanelWrapper title="CENTRAL BANK RATES">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>BANK</th>
                <th>RATE</th>
                <th>TREND</th>
              </tr>
            </thead>
            <tbody>
              {CENTRAL_BANK_RATES.map(cb => (
                <tr key={cb.bank}>
                  <td style={{ textAlign: 'left' }}>
                    <span className="text-primary text-[10px]">{cb.bank}</span>
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
                <div className="font-mono text-[9px] text-muted mb-1">BORROW (LOW RATE)</div>
                <select
                  value={carryBase}
                  onChange={e => setCarryBase(e.target.value)}
                  className="input-terminal w-full"
                  style={{ padding: '4px 6px', fontSize: 11 }}
                >
                  {CENTRAL_BANK_RATES.map(r => (
                    <option key={r.currency} value={r.currency}>{r.currency} ({r.rate}%)</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <div className="font-mono text-[9px] text-muted mb-1">INVEST (HIGH RATE)</div>
                <select
                  value={carryQuote}
                  onChange={e => setCarryQuote(e.target.value)}
                  className="input-terminal w-full"
                  style={{ padding: '4px 6px', fontSize: 11 }}
                >
                  {CENTRAL_BANK_RATES.map(r => (
                    <option key={r.currency} value={r.currency}>{r.currency} ({r.rate}%)</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="font-mono text-[10px] text-muted">BORROW RATE</span>
                <span className="font-mono text-[10px] text-negative">{cbRate(carryBase).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-[10px] text-muted">INVEST RATE</span>
                <span className="font-mono text-[10px] text-positive">{cbRate(carryQuote).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between" style={{ borderTop: '1px solid #1b2e1b', paddingTop: 4 }}>
                <span className="font-mono text-[10px] text-accent font-bold">CARRY RETURN</span>
                <span className={`font-mono text-[12px] font-bold ${carryReturn >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {carryReturn >= 0 ? '+' : ''}{carryReturn.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </PanelWrapper>
      </div>
    </div>
  )
}
