'use client'
import { useCallback, useEffect, useState } from 'react'
import { useMode } from '@/lib/context/ModeContext'
import { FACTORS, MARKET_FACTORS, shockLabel, type FactorId, type Market } from '@/lib/scenario/factors'
import { PRESETS, presetBlurb, presetTitle, type Preset, type PresetId, type PresetSize } from '@/lib/scenario/presets'
import PRESET_SIZES from '@/data/scenario/preset-sizes.json'
import type { Impact, PortfolioResult, ScenarioResult, SectorBar } from '@/lib/scenario/engine'
import { pct } from '@/lib/format'

// Scenario Engine: "what if oil rises 20%?" — historical estimates from the
// precomputed sensitivity file (no AI, no live calls), shown as ranges.
const P = (n: number) => pct(n, 1, '−')
const color = (n: number | null) => (n == null ? 'var(--text-muted)' : n > 0 ? 'var(--text-positive)' : n < 0 ? 'var(--text-negative)' : 'var(--text-primary)')
const box: React.CSSProperties = { border: '1px solid var(--border-color)', background: 'var(--bg-panel)', padding: '10px 12px', minWidth: 0 }
const head: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-accent)', marginBottom: 8 }
const meta: React.CSSProperties = { fontSize: 10, color: 'var(--text-muted)' }
const QUALITY = { strong: 'var(--text-positive)', moderate: 'var(--text-warning)', fair: 'var(--text-muted)' }
// Preset sizes come from the same data build as the server's (95th/5th percentile 20-day moves).
const SIZES = PRESET_SIZES.sizes as Record<Market, Record<string, PresetSize>>
const cardText = (p: Preset, m: Market) => p.kind === 'event' ? { title: p.title, blurb: p.blurb } : { title: presetTitle(p, m, SIZES[m][p.id]), blurb: presetBlurb(p, m, SIZES[m][p.id]) }

const chip = (label: string, c: string, title?: string) => (
  <span title={title} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', padding: '0 5px', border: `1px solid ${c}`, color: c, borderRadius: 2, whiteSpace: 'nowrap' }}>{label}</span>
)

function Bars({ bars }: { bars: SectorBar[] }) {
  const max = Math.max(1, ...bars.map(b => Math.abs(b.total ?? 0)), ...bars.map(b => Math.max(Math.abs(b.low ?? 0), Math.abs(b.high ?? 0))))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {bars.map(b => (
        <div key={b.id} title={b.note} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 180px) 1fr minmax(64px, auto)', gap: 8, alignItems: 'center', fontSize: 11 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
          <div style={{ position: 'relative', height: 12, background: 'var(--bg-terminal)' }}>
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--border-color)' }} />
            {b.total != null && <>
              {b.low != null && b.high != null && <div style={{ position: 'absolute', top: 5, height: 2, background: color(b.total), opacity: 0.45, left: `${50 + (Math.min(b.low, b.high) / max) * 50}%`, width: `${(Math.abs(b.high - b.low) / max) * 50}%` }} />}
              <div style={{ position: 'absolute', top: 2, height: 8, background: color(b.total), left: `${b.total >= 0 ? 50 : 50 + (b.total / max) * 50}%`, width: `${(Math.abs(b.total) / max) * 50}%` }} />
            </>}
          </div>
          <span style={{ textAlign: 'right', color: color(b.total), whiteSpace: 'nowrap' }}>
            {b.total == null ? <span style={meta}>no reliable link</span> : P(b.total)}
            {b.basis === 'median' && b.count && <span style={meta}> ({b.count.reliable}/{b.count.of})</span>}
          </span>
        </div>
      ))}
      <div style={meta}>Sector funds/indices where they exist; otherwise the median of constituents with a reliable link, when at least 3 have one (count shown). Thin line = 90% range.</div>
    </div>
  )
}

function ImpactRow({ i }: { i: Impact }) {
  return (
    <div style={{ borderTop: '1px solid var(--border-color)', padding: '6px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700 }}>{i.name}</span>
        <span style={meta}>{i.symbol.replace(/\.NS$/, '')}</span>
        <span style={{ marginLeft: 'auto', color: color(i.total), fontWeight: 700 }}>{P(i.total)}</span>
        <span style={meta}>{P(i.low)} to {P(i.high)}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {chip(`FIT ${i.fit.quality.toUpperCase()}`, QUALITY[i.fit.quality], `t = ${i.fit.t.toFixed(1)}, R² = ${i.fit.r2.toFixed(2)}, ${i.fit.n} ${i.fit.freq === 'weekly' ? 'weeks' : 'days'}`)}
        {i.path && <span style={{ ...meta, overflowWrap: 'anywhere' }}>{i.path}</span>}
      </div>
      {Math.abs(i.marketPart) >= 0.05 && <div style={meta}>{P(i.direct)} direct · {P(i.marketPart)} with the market&apos;s typical reaction</div>}
    </div>
  )
}

export default function ScenariosPage() {
  const { mode } = useMode()
  const market: Market = mode === 'INDIA' ? 'IN' : 'US'
  const presets = PRESETS.filter(p => p.markets.includes(market))
  const [query, setQuery] = useState<{ preset: PresetId } | { factor: FactorId; shock: number }>({ preset: 'oil-up' })
  const [factor, setFactor] = useState<FactorId>('us10y')
  const [shock, setShock] = useState('50')
  const [result, setResult] = useState<ScenarioResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [portfolio, setPortfolio] = useState<(PortfolioResult & { holdings: number }) | null>(null)
  const [pError, setPError] = useState('')
  const [pLoading, setPLoading] = useState(false)

  // A preset that doesn't exist in this market falls back to oil.
  useEffect(() => { if ('preset' in query && !presets.some(p => p.id === query.preset)) setQuery({ preset: 'oil-up' }) }, [market]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!MARKET_FACTORS[market].includes(factor)) setFactor(MARKET_FACTORS[market][0]) }, [market, factor])

  useEffect(() => {
    let live = true
    setLoading(true); setError(''); setPortfolio(null); setPError('')
    const qs = new URLSearchParams({ market, ...('preset' in query ? { preset: query.preset } : { factor: query.factor, shock: String(query.shock) }) })
    fetch(`/api/scenario?${qs}`)
      .then(r => r.json())
      .then(j => { if (!live) return; if (j.data) setResult(j.data); else { setResult(null); setError(j.error ?? 'Scenario unavailable') } })
      .catch(() => { if (live) { setResult(null); setError('Network error — scenario unavailable') } })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [market, query])

  const f = FACTORS[factor]
  const shockNum = Number(shock)
  const shockError = shock.trim() === '' || !Number.isFinite(shockNum) ? 'Enter a number' : Math.abs(shockNum) > f.maxShock ? `Between −${f.maxShock} and +${f.maxShock}` : ''

  const stress = useCallback(async () => {
    setPLoading(true); setPError('')
    try {
      const r = await fetch('/api/scenario/portfolio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(query) })
      const j = await r.json()
      if (r.status === 401) setPError('Sign in to stress your portfolio.')
      else if (j.data) setPortfolio(j.data)
      else setPError(j.error ?? 'Unavailable')
    } catch { setPError('Network error') } finally { setPLoading(false) }
  }, [query])

  const active = 'preset' in query ? query.preset : null
  return (
    <div style={{ fontFamily: 'IBM Plex Mono, monospace', background: 'var(--bg-terminal)', minHeight: '100%', color: 'var(--text-primary)', fontSize: 11 }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-accent)', letterSpacing: '0.1em' }}>SCENARIO ENGINE — {market === 'US' ? 'USA' : 'INDIA'}</div>
        <div style={{ ...meta, marginTop: 2 }}>
          What tended to happen historically when a factor moved · {market === 'US' ? 'US stocks vs the S&P 500, oil = WTI' : 'Nifty 50 stocks vs the Nifty, oil = Brent, USD/INR in rupees'} · no AI, no live calls
        </div>
      </div>

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
          {presets.map(p => (
            <button key={p.id} onClick={() => setQuery({ preset: p.id })} aria-pressed={active === p.id}
              style={{ ...box, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: 'inherit', borderColor: active === p.id ? 'var(--text-accent)' : 'var(--border-color)' }}>
              <div style={{ fontWeight: 700, color: active === p.id ? 'var(--text-accent)' : 'var(--text-primary)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {cardText(p, market).title}{p.kind === 'event' && chip('DIRECTIONAL', 'var(--text-warning)', 'No measurable history: no percentages')}
              </div>
              <div style={{ ...meta, marginTop: 3 }}>{cardText(p, market).blurb}</div>
            </button>
          ))}
        </div>

        <div style={{ ...box, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={head}>CUSTOM SHOCK</span>
          <select value={factor} onChange={e => setFactor(e.target.value as FactorId)} aria-label="Factor"
            style={{ background: 'var(--bg-terminal)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', fontFamily: 'inherit', fontSize: 11, padding: '3px 4px' }}>
            {MARKET_FACTORS[market].map(id => <option key={id} value={id}>{FACTORS[id].name}</option>)}
          </select>
          <input value={shock} onChange={e => setShock(e.target.value)} inputMode="decimal" aria-label={`Shock in ${f.unit === 'pct' ? 'percent' : f.unit === 'bp' ? 'basis points' : 'points'}`}
            style={{ width: 80, background: 'var(--bg-terminal)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', fontFamily: 'inherit', fontSize: 11, padding: '3px 6px' }} />
          <span style={meta}>{f.unit === 'pct' ? '%' : f.unit === 'bp' ? 'bp' : 'pts'} (±{f.maxShock})</span>
          <button disabled={!!shockError} onClick={() => setQuery({ factor, shock: shockNum })}
            style={{ background: 'transparent', color: shockError ? 'var(--text-muted)' : 'var(--text-accent)', border: '1px solid currentColor', fontFamily: 'inherit', fontSize: 11, padding: '3px 10px', cursor: shockError ? 'not-allowed' : 'pointer' }}>RUN</button>
          {shockError && <span style={{ ...meta, color: 'var(--text-warning)' }}>{shockError}</span>}
        </div>

        {loading && <div style={{ ...box, color: 'var(--text-accent)' }}>COMPUTING HISTORICAL ESTIMATES…</div>}
        {!loading && error && <div style={{ ...box, color: 'var(--text-negative)' }}>{error}</div>}

        {!loading && result && (
          <>
            <div style={box}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-accent)' }}>{result.title}</span>
                {result.range?.beyond && chip('BEYOND HISTORICAL RANGE', 'var(--text-warning)', result.range.text)}
                {result.kind === 'event' && chip('DIRECTIONAL ONLY', 'var(--text-warning)')}
                {chip('HISTORICAL ESTIMATE', 'var(--text-muted)')}
              </div>
              <div style={{ marginTop: 4 }}>{result.description}</div>
              {result.range && <div style={{ ...meta, marginTop: 4, color: result.range.beyond ? 'var(--text-warning)' : 'var(--text-muted)' }}>{result.range.text}</div>}
              {result.marketReaction && <div style={{ marginTop: 4 }}>{result.marketReaction.text}</div>}
              <div style={{ ...meta, marginTop: 4 }}>
                Data window {result.window.start} to {result.window.end} ({result.window.freq} moves) · built {result.generatedAt.slice(0, 10)}
                {result.kind === 'factor' && ` · ${result.stocks.length} stocks with a reliable link, ${result.notEstimated.length} without`}
              </div>
            </div>

            {result.kind === 'event' ? (
              <div style={box}>
                <div style={head}>LINKED COMPANIES (DIRECTION ONLY)</div>
                {result.event?.length ? result.event.map(e => (
                  <div key={e.symbol} style={{ borderTop: '1px solid var(--border-color)', padding: '5px 0', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                    {chip(e.direction.toUpperCase(), e.direction === 'hurt' ? 'var(--text-negative)' : 'var(--text-positive)')}
                    <span style={{ fontWeight: 700 }}>{e.name}</span>
                    <span style={{ ...meta, overflowWrap: 'anywhere' }}>{e.path} — {e.reason}</span>
                  </div>
                )) : <div style={meta}>No listed company in this market is linked to the event.</div>}
              </div>
            ) : (
              <>
                <div style={box}>
                  <div style={head}>SECTORS</div>
                  <Bars bars={result.sectors} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 }}>
                  {([['TOP HURT', result.hurt], ['TOP HELPED', result.helped]] as const).map(([t, list]) => (
                    <div key={t} style={box}>
                      <div style={head}>{t} (90% RANGE)</div>
                      {list.length ? list.map(i => <ImpactRow key={i.symbol} i={i} />) : <div style={meta}>None with a reliable historical link.</div>}
                    </div>
                  ))}
                </div>
                {result.indirect.length > 0 && (
                  <div style={box}>
                    <div style={head}>INDIRECT (GRAPH LINKS — NOT ESTIMATED)</div>
                    {result.indirect.map(x => <div key={`${x.symbol}-${x.from.symbol}`} style={{ ...meta, padding: '2px 0' }}>{x.text}</div>)}
                  </div>
                )}
                {result.notEstimated.length > 0 && (
                  <details style={box}>
                    <summary style={{ cursor: 'pointer', ...meta }}>No reliable historical link ({result.notEstimated.length})</summary>
                    <div style={{ ...meta, marginTop: 6, overflowWrap: 'anywhere' }}>{result.notEstimated.map(n => n.name).join(' · ')}</div>
                  </details>
                )}
              </>
            )}

            <div style={box}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={head}>STRESS MY PORTFOLIO</span>
                <button onClick={stress} disabled={pLoading}
                  style={{ background: 'transparent', color: 'var(--text-accent)', border: '1px solid currentColor', fontFamily: 'inherit', fontSize: 11, padding: '3px 10px', cursor: 'pointer' }}>
                  {pLoading ? 'RUNNING…' : `RUN “${result.title}”`}
                </button>
              </div>
              {pError && <div style={{ ...meta, color: 'var(--text-warning)', marginTop: 6 }}>{pError}</div>}
              {portfolio && (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {portfolio.holdings === 0 && <div style={meta}>No holdings yet — add some on the Portfolio page.</div>}
                  {portfolio.groups.map(g => <div key={g.market} style={{ color: color(g.total) }}>{g.text}</div>)}
                  {portfolio.lines.map(l => (
                    <div key={l.symbol} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: 3 }}>
                      <span style={{ fontWeight: 700 }}>{l.name}</span>
                      {l.impact && <><span style={{ color: color(l.impact.total) }}>{P(l.impact.total)}</span><span style={meta}>{P(l.impact.low)} to {P(l.impact.high)}</span></>}
                      <span style={{ ...meta, color: l.weightBasis === 'cost' ? 'var(--text-warning)' : 'var(--text-muted)' }}>{l.weightNote}</span>
                      {l.event && <>{chip(l.event.direction.toUpperCase(), l.event.direction === 'hurt' ? 'var(--text-negative)' : 'var(--text-positive)')}<span style={meta}>{l.event.reason}</span></>}
                    </div>
                  ))}
                  {portfolio.notEstimated.length > 0 && <div style={meta}>Not estimated: {portfolio.notEstimated.map(l => `${l.ticker} (${l.reason})`).join(' · ')}</div>}
                  {portfolio.notes.map(n => <div key={n} style={meta}>{n}</div>)}
                </div>
              )}
            </div>

            <div style={{ ...meta, lineHeight: 1.6 }}>
              {result.notes.map(n => <div key={n}>{n}</div>)}
              {result.factor && <div>Shock: {result.factor.name} ({result.factor.symbol}) {shockLabel(result.factor.shock, result.factor.unit)}.</div>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
