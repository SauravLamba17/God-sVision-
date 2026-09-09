import { INK, UP } from '@/lib/canvas/globe'

const BULLETS = [
  'Three strategy templates out of the box, each with editable parameters.',
  'Benchmarked against buy‑and‑hold on the same window, so an edge has to prove itself.',
  'Every run is reproducible — parameters and price window travel with the result.',
]

const STATS: Array<[string, string, string | undefined, string]> = [
  ['win rate', '57.4%', undefined, '1 1 118px'],
  ['Sharpe', '1.18', '#d99a5c', '1 1 118px'],
  ['max drawdown', '−14.6%', '#c07a5e', '1 1 128px'],
  ['vs buy & hold', '+9.2 pts', UP, '1 1 118px'],
]

export default function LandingBacktest() {
  return (
    <section id="backtest" data-screen-label="Backtesting" style={{ borderBottom: `1px solid rgba(${INK},.1)` }}>
      <div style={{
        maxWidth: 1440, margin: '0 auto', padding: 'clamp(56px, 6.5vw, 104px) 24px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
        gap: 'clamp(28px, 4vw, 64px)', alignItems: 'start',
      }}>
        <div data-reveal style={{ maxWidth: '44ch' }}>
          <h2 style={{
            margin: 0, font: '600 clamp(24px, 2.7vw, 38px)/1.1 Geist, sans-serif',
            letterSpacing: '-.02em', textWrap: 'balance',
          }}>Test the strategy before you trust it</h2>
          <p style={{
            margin: '18px 0 0', font: '400 16px/1.62 Geist, sans-serif',
            color: `rgba(${INK},.64)`, textWrap: 'pretty',
          }}>
            Run an SMA crossover, an RSI signal or plain buy&#8209;and&#8209;hold against real
            historical prices &#8212; the same series the chart draws from. You get the equity
            curve, the win rate, the drawdown you would actually have sat through, and a Sharpe
            ratio to compare runs. Most free tools don&#8217;t offer this at all.
          </p>
          <ul style={{
            listStyle: 'none', margin: '28px 0 0', padding: 0, display: 'grid', gap: 14,
            font: '400 14px/1.55 Geist, sans-serif', color: `rgba(${INK},.7)`,
          }}>
            {BULLETS.map(b => (
              <li key={b} style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: 12 }}>
                <span aria-hidden="true" style={{
                  color: '#c98a4b', font: "500 12px/1.6 'Geist Mono', monospace",
                }}>&#8250;</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <div data-reveal data-delay="100" style={{
          border: `1px solid rgba(${INK},.14)`, background: '#101114',
          boxShadow: '0 1px 1px rgba(0,0,0,.5), 0 26px 60px -34px rgba(0,0,0,1)',
        }}>
          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
            gap: '10px 16px', borderBottom: `1px solid rgba(${INK},.12)`, padding: '12px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span translate="no" style={{ font: "600 13px/1 'Geist Mono', monospace" }}>
                SMA 20/50 crossover
              </span>
              <span translate="no" style={{
                font: "500 10px/1 'Geist Mono', monospace", color: `rgba(${INK},.42)`,
              }}>AAPL &#183; 5 y daily</span>
            </div>
            <span style={{ font: "500 10px/1 'Geist Mono', monospace", color: UP }}>run complete</span>
          </div>

          <div style={{ position: 'relative', padding: '16px 16px 8px' }}>
            <svg
              viewBox="0 0 520 210"
              role="img"
              aria-label="Equity curve for the SMA 20/50 crossover backtest, ending above the buy-and-hold benchmark"
              style={{ display: 'block', width: '100%', height: 'auto' }}
            >
              <g stroke={`rgba(${INK},.08)`} strokeWidth="1">
                <line x1="0" y1="42" x2="520" y2="42" />
                <line x1="0" y1="98" x2="520" y2="98" />
                <line x1="0" y1="154" x2="520" y2="154" />
              </g>
              <polyline
                points="4,182 48,176 92,168 136,172 180,158 224,150 268,156 312,138 356,132 400,126 444,116 488,110 516,106"
                fill="none" stroke={`rgba(${INK},.34)`} strokeWidth="1.5" strokeDasharray="5 4"
              />
              <polyline
                points="4,184 40,170 76,174 112,150 148,158 184,128 220,136 256,104 292,118 328,88 364,74 400,86 436,58 472,44 516,30"
                fill="none" stroke="#c98a4b" strokeWidth="2.2" strokeLinejoin="round"
              />
              <circle cx="516" cy="30" r="3.4" fill="#c98a4b" />
            </svg>

            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '8px 20px', padding: '6px 0 4px',
              font: "500 10px/1 'Geist Mono', monospace", color: `rgba(${INK},.42)`,
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <span aria-hidden="true" style={{ width: 14, height: 2, background: '#c98a4b' }} />
                strategy equity
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <span aria-hidden="true" style={{
                  width: 14, height: 0, borderTop: `2px dashed rgba(${INK},.42)`,
                }} />
                buy &amp; hold
              </span>
            </div>
          </div>

          <dl style={{
            display: 'flex', flexWrap: 'wrap', gap: 1, margin: 0,
            background: `rgba(${INK},.12)`, borderTop: `1px solid rgba(${INK},.12)`,
          }}>
            {STATS.map(([label, value, color, flex]) => (
              <div key={label} style={{ flex, background: '#101114', padding: '14px 16px' }}>
                <dt style={{ font: "500 9px/1 'Geist Mono', monospace", color: `rgba(${INK},.4)` }}>
                  {label}
                </dt>
                <dd style={{
                  margin: '9px 0 0', font: "600 18px/1 'Geist Mono', monospace",
                  fontVariantNumeric: 'tabular-nums', color,
                }}>{value}</dd>
              </div>
            ))}
          </dl>

          <p style={{
            margin: 0, borderTop: `1px solid rgba(${INK},.12)`, padding: '12px 16px',
            font: "400 11px/1.5 'Geist Mono', monospace", color: `rgba(${INK},.62)`,
          }}>
            Example run. Past performance of a backtest is not a forecast.
          </p>
        </div>
      </div>
    </section>
  )
}
