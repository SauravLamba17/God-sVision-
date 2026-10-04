import { NextResponse } from 'next/server'
import { getCentralBankSpeeches, BANK_COLORS } from '@/lib/apis/centralBanks'
import { getPolicyRates } from '@/lib/apis/fred'
import { getCache, setCache } from '@/lib/cache'

// ISR: regenerated at most every 3600s (macro/central-bank/daily-flow data). Without this the route was
// prerendered at build and served build-time data forever.
export const revalidate = 3600

async function rateCards() {
  const cached = await getCache<any>('policy_rates')
  const rates = cached && !cached.stale ? cached.data : await getPolicyRates().catch(() => null)
  if (rates && !(cached && !cached.stale)) await setCache('policy_rates', rates, 6 * 3600)
  return (rates ?? []).map((r: any) => ({
    bank: r.code, country: r.country, rate: r.rate, lastChange: r.asOf,
    direction: r.trend === 'hike' ? 'UP' : r.trend === 'cut' ? 'DOWN' : 'HOLD',
    color: BANK_COLORS[r.code] ?? 'var(--text-accent)',
  }))
}

export async function GET() {
  const [speeches, rates] = await Promise.all([
    getCentralBankSpeeches().catch(() => []),
    rateCards(),
  ])
  return NextResponse.json({
    speeches, rates,
    ...(rates.length ? {} : { ratesError: 'Policy rates unavailable — FRED unreachable' }),
  })
}
