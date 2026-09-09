import { INK } from '@/lib/canvas/globe'

/* No interactivity in this section — it stays a server component. */
const LEDGER: Array<{ item: string; gv: string; bb: string }> = [
  { item: 'Real-time equities & FX feed', gv: 'included', bb: 'extra' },
  { item: 'Crypto coverage', gv: 'included', bb: 'extra' },
  { item: 'News & wire analytics', gv: 'included', bb: 'extra' },
  { item: 'AI morning brief', gv: 'included', bb: 'not offered' },
  { item: 'Strategy backtesting', gv: 'included', bb: 'separate module' },
  { item: 'Spreadsheet formulas', gv: 'included', bb: 'included' },
  { item: 'World intelligence layer', gv: 'included', bb: 'not offered' },
  { item: 'Dual currency / timezone base', gv: 'included', bb: 'manual' },
  { item: 'Data-licensing paperwork', gv: 'none', bb: 'required' },
]

const headCell: React.CSSProperties = {
  padding: '12px 20px', font: "500 10px/1 'Geist Mono', monospace", color: `rgba(${INK},.45)`,
}

export default function LandingLedger() {
  return (
    <section id="ledger" data-screen-label="Comparison ledger" style={{
      borderBottom: `1px solid rgba(${INK},.1)`, background: '#0d0e11',
    }}>
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: 'clamp(56px, 6.5vw, 104px) 24px' }}>
        <div data-reveal style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: 20, marginBottom: 34,
        }}>
          <h2 style={{
            margin: 0, maxWidth: '22ch', font: '600 clamp(24px, 2.7vw, 38px)/1.1 Geist, sans-serif',
            letterSpacing: '-.02em', textWrap: 'balance',
          }}>Feature for feature. One invoice is blank.</h2>
          <p style={{
            margin: 0, maxWidth: '36ch', font: '400 14px/1.6 Geist, sans-serif', color: `rgba(${INK},.55)`,
          }}>
            Annual, one seat. The cost line is illustrative &#8212; we compare what is included,
            not a quoted invoice.
          </p>
        </div>

        <div data-reveal data-delay="80" style={{ border: `1px solid rgba(${INK},.16)`, overflowX: 'auto' }}>
          <table style={{
            width: '100%', minWidth: 520, borderCollapse: 'collapse',
            font: "500 13px/1.4 'Geist Mono', monospace", fontVariantNumeric: 'tabular-nums',
          }}>
            <caption style={{
              textAlign: 'left', padding: '13px 20px', background: '#08090b',
              borderBottom: `1px solid rgba(${INK},.16)`,
              font: "500 10px/1 'Geist Mono', monospace", color: `rgba(${INK},.45)`,
            }}>What&#8217;s included, feature by feature</caption>
            <thead>
              <tr style={{ background: '#08090b', borderBottom: `1px solid rgba(${INK},.16)` }}>
                <th scope="col" style={{ ...headCell, textAlign: 'left' }}>Capability</th>
                <th scope="col" style={{
                  ...headCell, textAlign: 'right',
                  font: "600 10px/1 'Geist Mono', monospace", color: '#d99a5c',
                }}>GOD&#8217;s Vision</th>
                <th scope="col" style={{ ...headCell, textAlign: 'right' }}>Incumbent terminal</th>
              </tr>
            </thead>
            <tbody>
              {LEDGER.map(row => (
                <tr key={row.item} style={{ borderBottom: `1px solid rgba(${INK},.09)` }}>
                  <th scope="row" style={{
                    textAlign: 'left', padding: '14px 20px', fontWeight: 500, color: `rgba(${INK},.78)`,
                  }}>{row.item}</th>
                  <td style={{ textAlign: 'right', padding: '14px 20px', color: '#e8e6e1' }}>{row.gv}</td>
                  <td style={{ textAlign: 'right', padding: '14px 20px', color: `rgba(${INK},.6)` }}>{row.bb}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#08090b' }}>
                <th scope="row" style={{
                  textAlign: 'left', padding: 20,
                  font: "500 11px/1 'Geist Mono', monospace", color: `rgba(${INK},.45)`,
                }}>Total / year / seat</th>
                <td style={{
                  textAlign: 'right', padding: 20,
                  font: "600 clamp(21px, 2.6vw, 32px)/1 'Geist Mono', monospace", color: '#d99a5c',
                }}>$0</td>
                <td style={{
                  textAlign: 'right', padding: 20,
                  font: "600 clamp(21px, 2.6vw, 32px)/1 'Geist Mono', monospace",
                  color: `rgba(${INK},.62)`, textDecoration: 'line-through',
                  textDecorationThickness: 2, textDecorationColor: '#b8664a',
                }}>~$32,000</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p data-reveal data-delay="140" style={{
          margin: '18px 0 0', font: "400 12px/1.6 'Geist Mono', monospace", color: `rgba(${INK},.62)`,
        }}>
          The ~$32,000 figure is illustrative, based on commonly cited single&#8209;seat
          professional terminal pricing &#8212; not a quote or published rate. Ours is $0: no trial
          window, no seat minimum, no licensing department needed to switch it on.
        </p>
      </div>
    </section>
  )
}
