import axios from 'axios'

const BASE = 'https://api.stlouisfed.org/fred'

const KEY = process.env.FRED_API_KEY || ''
const KEY_VALID = KEY && KEY !== 'your_fred_key_here' && KEY !== 'demo' && KEY.length > 8

// No mock fallbacks: on failure these return nulls/throw and the UI shows an
// unavailable state. (They used to return hardcoded 2024 numbers as 'live'.)

export const FRED_SERIES = {
  GDP: 'GDP',
  CPI: 'CPIAUCSL',
  CORE_CPI: 'CPILFESL',
  PCE: 'PCE',
  CORE_PCE: 'PCEPILFE',
  UNEMPLOYMENT: 'UNRATE',
  JOLTS: 'JTSJOL',
  RETAIL_SALES: 'RSAFS',
  INDUSTRIAL_PRODUCTION: 'INDPRO',
  HOUSING_STARTS: 'HOUST',
  CONSUMER_CONFIDENCE: 'UMCSENT',
  ISM_MANUFACTURING: 'MANEMP',
  FED_FUNDS_RATE: 'FEDFUNDS',
  FED_BALANCE_SHEET: 'WALCL',
  T10Y2Y: 'T10Y2Y',
  DGS2: 'DGS2',
  DGS10: 'DGS10',
  DGS30: 'DGS30',
  DGS1MO: 'DGS1MO',
  DGS3MO: 'DGS3MO',
  DGS6MO: 'DGS6MO',
  DGS1: 'DGS1',
  DGS5: 'DGS5',
  DGS7: 'DGS7',
  DGS20: 'DGS20',
}

// Newest-first observations. With a key: the FRED API. Without one: FRED's
// public CSV download (no key needed — /api/yield-curve already uses it).
export async function fetchSeries(seriesId: string, limit = 12) {
  if (!KEY_VALID) {
    try {
      const { data } = await axios.get(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`, { timeout: 15000, responseType: 'text' })
      return (data as string).trim().split(/\r?\n/).slice(1).reverse().slice(0, limit).map(line => {
        const [date, value] = line.split(',')
        return { date: date.trim(), value: value?.trim() || '.' }
      })
    } catch {
      return []
    }
  }
  try {
    const { data } = await axios.get(`${BASE}/series/observations`, {
      params: {
        series_id: seriesId,
        api_key: KEY,
        file_type: 'json',
        limit,
        sort_order: 'desc'
      },
      timeout: 10000
    })
    return data.observations || []
  } catch {
    return []
  }
}

export async function getYieldCurve() {
  const maturities = [
    { label: '1M', series: 'DGS1MO' },
    { label: '3M', series: 'DGS3MO' },
    { label: '6M', series: 'DGS6MO' },
    { label: '1Y', series: 'DGS1' },
    { label: '2Y', series: 'DGS2' },
    { label: '5Y', series: 'DGS5' },
    { label: '7Y', series: 'DGS7' },
    { label: '10Y', series: 'DGS10' },
    { label: '20Y', series: 'DGS20' },
    { label: '30Y', series: 'DGS30' },
  ]

  const results = await Promise.allSettled(
    maturities.map(m => fetchSeries(m.series, 1))
  )

  return maturities.map((m, i) => {
    const obs = results[i].status === 'fulfilled' ? results[i].value : []
    const val = obs?.[0]?.value
    return { label: m.label, value: val && val !== '.' ? parseFloat(val) : null }
  })
}

export async function getMacroIndicators() {
  const indicators = [
    { key: 'gdp', label: 'GDP Growth', series: 'A191RL1Q225SBEA', unit: '%' },
    { key: 'cpi', label: 'CPI YoY', series: 'CPIAUCSL', unit: '%' },
    { key: 'core_cpi', label: 'Core CPI', series: 'CPILFESL', unit: '%' },
    { key: 'unemployment', label: 'Unemployment', series: 'UNRATE', unit: '%' },
    { key: 'fed_funds', label: 'Fed Funds Rate', series: 'FEDFUNDS', unit: '%' },
    { key: 't10y2y', label: '10Y-2Y Spread', series: 'T10Y2Y', unit: 'bps' },
    { key: 'retail_sales', label: 'Retail Sales', series: 'RSAFS', unit: 'B' },
    { key: 'housing', label: 'Housing Starts', series: 'HOUST', unit: 'K' },
    { key: 'consumer_conf', label: 'Consumer Confidence', series: 'UMCSENT', unit: '' },
    { key: 'industrial', label: 'Industrial Production', series: 'INDPRO', unit: '' },
    { key: 'fed_balance', label: 'Fed Balance Sheet', series: 'WALCL', unit: 'T' },
  ]

  const results = await Promise.allSettled(
    indicators.map(i => fetchSeries(i.series, 14))
  )

  return indicators.map((ind, i) => {
    const obs = results[i].status === 'fulfilled' ? results[i].value : []
    const num = (o: any) => (o?.value && o.value !== '.' ? parseFloat(o.value) : null)
    // CPIAUCSL / CPILFESL are index levels, not rates — the "YoY" rows showed
    // ~310%. Convert to year-over-year % using the observation 12 months back.
    const yoy = (a: any, b: any) => (num(a) !== null && num(b) ? (num(a)! / num(b)! - 1) * 100 : null)
    const isIndex = ind.key === 'cpi' || ind.key === 'core_cpi'
    const value = isIndex ? yoy(obs?.[0], obs?.[12]) : num(obs?.[0])
    const prevValue = isIndex ? yoy(obs?.[1], obs?.[13]) : num(obs?.[1])
    const change = value !== null && prevValue !== null ? value - prevValue : null
    return { ...ind, value, prevValue, change, date: obs?.[0]?.date || 'N/A' }
  })
}

export async function getFedBalanceSheet() {
  const obs = await fetchSeries('WALCL', 104)
  if (!obs.length) throw new Error('FRED WALCL unavailable')
  return obs.map((o: { date: string; value: string }) => ({
    date: o.date,
    value: o.value !== '.' ? parseFloat(o.value) / 1e6 : null
  })).reverse()
}

// Central-bank policy rates. These were hardcoded 2023/2024 values (Fed 5.33%
// vs a real 4.00%, BOJ at -0.10%, "next meeting" dates months in the past)
// shown as current. FRED only carries CURRENT daily policy rates for the Fed
// and ECB — the OECD IRSTCB01* series for other banks stopped in 2023 — so
// those two are shown and the rest are omitted rather than shown stale.
export const POLICY_RATE_SERIES = [
  { code: 'FED', bank: 'Fed (US)', country: 'United States', currency: 'USD', series: 'DFEDTARU' },
  { code: 'ECB', bank: 'ECB (EU)', country: 'Eurozone', currency: 'EUR', series: 'ECBDFR' },
]

export interface PolicyRate {
  code: string; bank: string; country: string; currency: string
  rate: number; asOf: string
  trend: 'hike' | 'cut' | 'hold' // direction of the most recent change in the fetched window
}

export async function getPolicyRates(): Promise<PolicyRate[] | null> {
  const rows = await Promise.all(POLICY_RATE_SERIES.map(async s => {
    const obs = (await fetchSeries(s.series, 400)).filter((o: any) => o.value !== '.')
    // Never present a stale series as the current rate.
    if (!obs.length || Date.now() - new Date(obs[0].date).getTime() > 120 * 86400000) return null
    const rate = parseFloat(obs[0].value)
    const prev = obs.find((o: any) => parseFloat(o.value) !== rate)
    const trend: PolicyRate['trend'] = !prev ? 'hold' : parseFloat(prev.value) < rate ? 'hike' : 'cut'
    const { series, ...meta } = s
    return { ...meta, rate, asOf: obs[0].date, trend }
  }))
  const live = rows.filter((r): r is PolicyRate => r !== null)
  return live.length ? live : null
}
