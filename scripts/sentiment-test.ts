// Keyword headline-sentiment checks.   npm run test:sentiment
import { scoreHeadlines } from '../lib/apis/newsSentiment.ts'

const cases: [string, 'BULLISH' | 'BEARISH' | 'NEUTRAL'][] = [
  ['Nifty hits record high', 'BULLISH'],
  ['Stocks rally as Fed signals rate cut', 'BULLISH'],
  ['Oil prices fall on demand fears', 'BEARISH'],
  ['Shares tumble after earnings miss', 'BEARISH'],
  ['Enterprise software firm reports again', 'NEUTRAL'],   // "rise"/"gain" inside words must not count
  ['Company announces buyout talks', 'NEUTRAL'],
]
let failed = 0
for (const [h, want] of cases) {
  const got = scoreHeadlines([h])[0].sentiment
  if (got !== want) failed++
  console.log(`${got === want ? 'PASS' : 'FAIL'}  ${got.padEnd(8)} ${h}${got === want ? '' : `  (want ${want})`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
