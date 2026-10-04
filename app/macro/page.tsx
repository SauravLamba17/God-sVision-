'use client'
import { useEffect, useState } from 'react'
import PanelWrapper from '@/components/panels/PanelWrapper'
import MacroPanel from '@/components/panels/MacroPanel'
import YieldCurve from '@/components/charts/YieldCurve'
import LineChartComponent from '@/components/charts/LineChart'
import { usePolicyRates } from '@/lib/hooks/usePolicyRates'

interface FedBalancePoint {
  date: string
  value: number | null
}

interface CalEvent { date: string; time: string; event: string; currency: string; impact: string; forecast: string }

export default function MacroPage() {
  const [fedBalance, setFedBalance] = useState<FedBalancePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [fedSource, setFedSource] = useState<string | undefined>() // API status → PanelWrapper badge
  const [spread, setSpread] = useState<number | null>(null)
  // Upcoming US high-impact releases from the live calendar feed (replaced a
  // hardcoded list of July–September 2024 events).
  const [events, setEvents] = useState<CalEvent[] | null>(null)
  const { rates: cbRates, error: cbError } = usePolicyRates()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [balRes, yieldRes, calThis, calNext] = await Promise.allSettled([
          fetch('/api/macro?type=fed_balance'),
          fetch('/api/macro?type=yield_curve'),
          fetch('/api/calendar?week=this').then(r => r.json()),
          fetch('/api/calendar?week=next').then(r => r.json()),
        ])
        const today = new Date().toISOString().slice(0, 10)
        setEvents([calThis, calNext]
          .flatMap(r => (r.status === 'fulfilled' && Array.isArray(r.value?.data) ? r.value.data : []))
          .filter((e: CalEvent) => e.currency === 'USD' && e.impact === 'high' && e.date >= today)
          .slice(0, 10))
        if (balRes.status === 'fulfilled') {
          const j = await balRes.value.json()
          setFedSource(j.source)
          if (j.data) {
            setFedBalance(j.data.filter((d: FedBalancePoint) => d.value !== null).slice(-52).map((d: FedBalancePoint) => ({
              date: d.date,
              value: d.value
            })))
          }
        }
        if (yieldRes.status === 'fulfilled') {
          const j = await yieldRes.value.json()
          if (j.data) {
            const y2 = j.data.find((p: { label: string; value: number }) => p.label === '2Y')?.value
            const y10 = j.data.find((p: { label: string; value: number }) => p.label === '10Y')?.value
            if (y2 && y10) setSpread(y10 - y2)
          }
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // null when there's no live spread — previously defaulted to a made-up 20%.
  const recessionProb = spread !== null ? (spread < 0 ? Math.min(85, 50 + Math.abs(spread) * 40) : Math.max(5, 20 - spread * 10)) : null

  return (
    <div className="p-2 flex gap-2 h-full">
      {/* Left Column */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <MacroPanel />

        {/* Yield Curve */}
        <div style={{ border: '1px solid #1b2e1b', background: 'var(--bg-terminal)' }}>
          <YieldCurve />
        </div>

        {/* Fed Balance Sheet */}
        {fedBalance.length > 0 && (
          <PanelWrapper title="FED BALANCE SHEET (WALCL)" source={fedSource}>
            <LineChartComponent
              data={fedBalance.map(d => ({ date: d.date?.slice(0, 7) || '', value: d.value || 0 }))}
              color="#ff6d00"
              height={160}
              formatValue={(v) => `$${v.toFixed(1)}T`}
            />
          </PanelWrapper>
        )}
      </div>

      {/* Right Column */}
      <div style={{ width: 300, flexShrink: 0 }} className="space-y-2">
        {/* Recession Indicator */}
        <div style={{ border: '1px solid #1b2e1b', background: 'var(--bg-terminal)' }}>
          <div className="panel-header">
            <span className="panel-header-title">RECESSION PROBABILITY</span>
          </div>
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] text-muted">10Y-2Y SPREAD</span>
              <span className={`font-mono text-[12px] font-bold ${spread !== null && spread < 0 ? 'text-negative' : 'text-positive'}`}>
                {spread !== null ? `${spread >= 0 ? '+' : ''}${(spread * 100).toFixed(0)} bps` : 'N/A'}
              </span>
            </div>
            <div className="mb-1">
              <div className="flex justify-between mb-1">
                <span className="font-mono text-[9px] text-muted">12-MONTH PROBABILITY</span>
                <span className={`font-mono text-[11px] font-bold ${recessionProb === null ? 'text-muted' : recessionProb > 50 ? 'text-negative' : 'text-positive'}`}>
                  {recessionProb === null ? '—' : `${recessionProb.toFixed(0)}%`}
                </span>
              </div>
              <div style={{ background: 'var(--border-color)', height: 8, borderRadius: 2 }}>
                <div
                  style={{
                    height: '100%',
                    width: `${recessionProb ?? 0}%`,
                    background: recessionProb === null ? 'transparent' : recessionProb > 50 ? 'var(--text-negative)' : recessionProb > 30 ? 'var(--text-accent)' : 'var(--text-positive)',
                    borderRadius: 2,
                    transition: 'width 0.5s',
                  }}
                />
              </div>
            </div>
            <p className="font-mono text-[9px] text-muted mt-2">
              Based on 2Y-10Y spread inversion. Negative spread historically precedes recessions by 12-18 months.
            </p>
          </div>
        </div>

        {/* Global Central Bank Rates */}
        <PanelWrapper title="GLOBAL CB RATES" error={cbError}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>BANK</th>
                <th>RATE</th>
                <th>CCY</th>
                <th>TREND</th>
              </tr>
            </thead>
            <tbody>
              {cbRates.map(cb => (
                <tr key={cb.bank} title={`as of ${cb.asOf}`}>
                  <td style={{ textAlign: 'left' }}>
                    <span className="text-primary text-[10px]">{cb.bank}</span>
                  </td>
                  <td className="font-mono text-accent">{cb.rate.toFixed(2)}%</td>
                  <td className="text-muted">{cb.currency}</td>
                  <td className={cb.trend === 'hike' ? 'positive' : cb.trend === 'cut' ? 'negative' : 'neutral'}>
                    {cb.trend === 'hike' ? '▲' : cb.trend === 'cut' ? '▼' : '●'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PanelWrapper>

        {/* Economic Calendar */}
        <PanelWrapper title="ECONOMIC CALENDAR">
          <div className="divide-y" style={{ borderColor: 'var(--border-dim)' }}>
            {events === null && <div className="px-2 py-1.5 font-mono text-[9px] text-muted">Loading…</div>}
            {events?.length === 0 && <div className="px-2 py-1.5 font-mono text-[9px] text-muted">No upcoming high-impact US releases in the calendar feed.</div>}
            {events?.map((ev, i) => (
              <div key={i} className="px-2 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] text-muted">{ev.date} {ev.time} ET</span>
                  <span className="font-mono text-[8px] px-1 py-0.5 text-negative border border-negative">HIGH</span>
                </div>
                <p className="text-primary text-[10px] mt-0.5">{ev.event}</p>
                {ev.forecast && <p className="text-accent text-[9px]">Forecast: {ev.forecast}</p>}
              </div>
            ))}
          </div>
        </PanelWrapper>
      </div>
    </div>
  )
}
