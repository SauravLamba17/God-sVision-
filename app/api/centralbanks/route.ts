import { NextResponse } from 'next/server'
import { getCentralBankSpeeches, BANK_COLORS } from '@/lib/apis/centralBanks'
import { getPolicyRates } from '@/lib/apis/fred'
import { getCache, setCache } from '@/lib/cache'

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
