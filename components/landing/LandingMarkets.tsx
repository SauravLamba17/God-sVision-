'use client'
import { useEffect, useRef, useState } from 'react'
import { DOWN, INK, UP, sizeCanvas, type SizedCanvas } from '@/lib/canvas/globe'
import { ChartSeries, drawChart, type ChartQuote } from '@/lib/canvas/chart'

const COVERAGE: Array<[string, string]> = [
  ['Coverage', 'Equities · crypto · FX'],
  ['Intraday granularity', 'Intraday → daily'],
  ['History depth', 'Multi‑year'],
  ['Export', 'CSV · JSON · WS'],
]

const statBox: React.CSSProperties = {
  background: '#101114', padding: '12px 16px',
}
const statLabel: React.CSSProperties = {
  font: "500 9px/1 'Geist Mono', monospace", color: `rgba(${INK},.4)`,
}
const statValue: React.CSSProperties = {
  font: "500 12px/1 'Geist Mono', monospace", fontVariantNumeric: 'tabular-nums', marginTop: 7,
}

export default function LandingMarkets() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [quote, setQuote] = useState<ChartQuote | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current as SizedCanvas | null
    if (!canvas) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const series = new ChartSeries()

    sizeCanvas(canvas)
    drawChart(canvas, series.candles)

    const onResize = () => { sizeCanvas(canvas); drawChart(canvas, series.candles) }
    window.addEventListener('resize', onResize)

    // The reference drops the skeleton after 260ms, then re-ticks on an
    // interval that slows right down under reduced motion.
    const first = setTimeout(() => {
      setLoading(false)
      setQuote(series.tick())
      drawChart(canvas, series.candles)
    }, 260)

    const timer = setInterval(() => {
      if (document.hidden) return
      setQuote(series.tick())
      drawChart(canvas, series.candles)
    }, reduced ? 4000 : 1100)

    return () => {
      clearTimeout(first)
      clearInterval(timer)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <section id="markets" data-screen-label="Markets" style={{ borderBottom: `1px solid rgba(${INK},.1)` }}>
      <div style={{
        maxWidth: 1440, margin: '0 auto', padding: 'clamp(56px, 6.5vw, 104px) 24px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
        gap: 'clamp(28px, 4vw, 64px)', alignItems: 'start',
      }}>
        <div data-reveal style={{ maxWidth: '44ch' }}>
          <h2 style={{
            margin: 0, font: '600 clamp(24px, 2.7vw, 38px)/1.1 Geist, sans-serif',
            letterSpacing: '-.02em', textWrap: 'balance',
          }}>One tick engine for equities, crypto &amp; FX</h2>
          <p style={{
            margin: '18px 0 0', font: '400 16px/1.62 Geist, sans-serif',
            color: `rgba(${INK},.64)`, textWrap: 'pretty',
          }}>
            Candles, depth &amp; spread arrive on the same socket, so a rotation out of NIFTY into
            BTC is one screen, not three tabs. Quotes across major global venues, no
            data&#8209;licensing form in the way.
          </p>

          <dl style={{
            margin: '30px 0 0', display: 'grid', gap: 1,
            background: `rgba(${INK},.12)`, border: `1px solid rgba(${INK},.12)`,
          }}>
            {COVERAGE.map(([k, v]) => (
              <div key={k} style={{
                background: '#101114', padding: '15px 18px',
                display: 'flex', justifyContent: 'space-between', gap: 16,
              }}>
                <dt style={{ font: "500 12px/1.4 'Geist Mono', monospace", color: `rgba(${INK},.55)` }}>{k}</dt>
                <dd style={{ margin: 0, font: "500 12px/1.4 'Geist Mono', monospace" }}>{v}</dd>
              </div>
            ))}
          </dl>

          {/* Google Sheets add-on callout */}
          <div style={{
            margin: '22px 0 0', border: `1px solid rgba(${INK},.14)`, background: '#101114',
            boxShadow: '0 1px 1px rgba(0,0,0,.5), 0 18px 40px -30px rgba(0,0,0,1)',
          }}>
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
              gap: '8px 14px', borderBottom: `1px solid rgba(${INK},.12)`, padding: '11px 14px',
            }}>
              <span style={{ font: "600 11px/1 'Geist Mono', monospace", color: '#d99a5c' }}>
                Google Sheets add&#8209;on
              </span>
              <span style={{ font: "500 10px/1 'Geist Mono', monospace", color: `rgba(${INK},.42)` }}>
                live cells, no copy&#8209;paste
              </span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              borderBottom: `1px solid rgba(${INK},.1)`, padding: '10px 14px',
            }}>
              <span aria-hidden="true" style={{
                font: "500 11px/1 'Geist Mono', monospace", color: `rgba(${INK},.36)`,
                borderRight: `1px solid rgba(${INK},.14)`, paddingRight: 10,
              }}>fx</span>
              <code translate="no" style={{ font: "500 12px/1.4 'Geist Mono', monospace", color: '#e8e6e1' }}>
                =GV(&quot;AAPL&quot;,&quot;price&quot;)
              </code>
            </div>
            <div role="table" aria-label="Spreadsheet example" style={{
              display: 'grid', gridTemplateColumns: '34px 1.5fr 1fr', gap: 1, background: `rgba(${INK},.1)`,
              font: "500 11px/1 'Geist Mono', monospace", fontVariantNumeric: 'tabular-nums',
            }}>
              <div style={{ background: '#0d0e11', padding: '9px 8px', color: `rgba(${INK},.3)` }} />
              <div style={{ background: '#0d0e11', padding: '9px 10px', color: `rgba(${INK},.34)` }}>A</div>
              <div style={{ background: '#0d0e11', padding: '9px 10px', color: `rgba(${INK},.34)` }}>B</div>
              <div style={{ background: '#0d0e11', padding: '10px 8px', color: `rgba(${INK},.3)` }}>1</div>
              <div translate="no" style={{ background: '#101114', padding: 10, color: `rgba(${INK},.72)` }}>AAPL</div>
              <div style={{ background: '#101114', padding: 10, color: '#d99a5c' }}>241.86</div>
              <div style={{ background: '#0d0e11', padding: '10px 8px', color: `rgba(${INK},.3)` }}>2</div>
              <div translate="no" style={{ background: '#101114', padding: 10, color: `rgba(${INK},.72)` }}>BTC-USD</div>
              <div style={{ background: '#101114', padding: 10, color: '#d99a5c' }}>67,412</div>
            </div>
            <p style={{
              margin: 0, borderTop: `1px solid rgba(${INK},.12)`, padding: '12px 14px',
              font: '400 12.5px/1.55 Geist, sans-serif', color: `rgba(${INK},.56)`,
            }}>
              The same formula habit as the incumbent&#8217;s Excel plugin &#8212; price, change,
              volume or history pulled straight into your model, refreshed in place.
            </p>
          </div>
        </div>

        {/* Chart panel */}
        <div data-reveal data-delay="100" style={{
          border: `1px solid rgba(${INK},.14)`, background: '#101114',
          boxShadow: '0 1px 1px rgba(0,0,0,.5), 0 26px 60px -34px rgba(0,0,0,1)',
        }}>
          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
            gap: '10px 16px', borderBottom: `1px solid rgba(${INK},.12)`, padding: '12px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span translate="no" style={{ font: "600 14px/1 'Geist Mono', monospace" }}>AAPL</span>
              <span style={{ font: "500 10px/1 'Geist Mono', monospace", color: `rgba(${INK},.42)` }}>
                NASDAQ &#183; 5 m
              </span>
            </div>
            <div aria-live="polite" style={{
              display: 'flex', alignItems: 'baseline', gap: 12,
              font: "500 12px/1 'Geist Mono', monospace", fontVariantNumeric: 'tabular-nums',
            }}>
              <span id="gv-chart-last">{quote ? quote.last : '—'}</span>
              <span id="gv-chart-chg" style={{ color: quote ? (quote.changeUp ? UP : DOWN) : `rgba(${INK},.5)` }}>
                {quote ? quote.change : 'awaiting first tick…'}
              </span>
              <span data-pulse aria-hidden="true" style={{
                width: 6, height: 6, borderRadius: '50%', background: '#c98a4b',
                animation: 'gv-live 1.8s ease-in-out infinite',
              }} />
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <canvas
              ref={canvasRef}
              id="gv-chart"
              role="img"
              aria-label="Five-minute candlestick chart for AAPL"
              style={{ display: 'block', width: '100%', height: 'clamp(230px, 28vw, 320px)' }}
            />
            {loading && (
              <div id="gv-chart-skeleton" style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 10, background: '#101114',
                font: "500 11px/1 'Geist Mono', monospace", color: `rgba(${INK},.4)`,
                transition: 'opacity .25s ease',
              }}>
                <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: '#c98a4b' }} />
                <span>Loading 66 candles&#8230;</span>
              </div>
            )}
          </div>

          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 1,
            background: `rgba(${INK},.12)`, borderTop: `1px solid rgba(${INK},.12)`,
          }}>
            <div style={{ ...statBox, flex: '1.2 1 132px' }}>
              <div style={statLabel}>bid / ask</div>
              <div id="gv-book" style={statValue}>{quote ? quote.book : '—'}</div>
            </div>
            <div style={{ ...statBox, flex: '1 1 112px' }}>
              <div style={statLabel}>spread</div>
              <div id="gv-spread" style={statValue}>{quote ? quote.spread : '—'}</div>
            </div>
            <div style={{ ...statBox, flex: '1 1 112px' }}>
              <div style={statLabel}>volume</div>
              <div id="gv-vol" style={statValue}>{quote ? quote.volume : '—'}</div>
            </div>
            <div style={{ ...statBox, flex: '1.4 1 150px' }}>
              <div style={statLabel}>feed health</div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                font: "500 12px/1 'Geist Mono', monospace", marginTop: 7, color: UP,
              }}>
                <span aria-hidden="true">&#9679;</span><span>Healthy &#183; real&#8209;time</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
