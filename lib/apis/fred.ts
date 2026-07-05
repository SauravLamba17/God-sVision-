import axios from 'axios'

const BASE = 'https://api.stlouisfed.org/fred'

const KEY = process.env.FRED_API_KEY || ''
const KEY_VALID = KEY && KEY !== 'your_fred_key_here' && KEY !== 'demo' && KEY.length > 8

// MOCK DATA — used when FRED_API_KEY is not configured
const MACRO_MOCK = [
  { key: 'gdp',          label: 'GDP Growth',          series: 'A191RL1Q225SBEA', unit: '%', value: 2.8,   prevValue: 3.1,  change: -0.3,  date: '2024-10-01' },
  { key: 'cpi',          label: 'CPI YoY',             series: 'CPIAUCSL',        unit: '%', value: 3.2,   prevValue: 3.4,  change: -0.2,  date: '2024-12-01' },
  { key: 'core_cpi',     label: 'Core CPI',            series: 'CPILFESL',        unit: '%', value: 3.5,   prevValue: 3.6,  change: -0.1,  date: '2024-12-01' },
  { key: 'unemployment', label: 'Unemployment',        series: 'UNRATE',          unit: '%', value: 4.2,   prevValue: 4.1,  change: 0.1,   date: '2024-12-01' },
  { key: 'fed_funds',    label: 'Fed Funds Rate',      series: 'FEDFUNDS',        unit: '%', value: 5.33,  prevValue: 5.33, change: 0,     date: '2024-12-01' },
  { key: 't10y2y',       label: '10Y-2Y Spread',       series: 'T10Y2Y',          unit: 'bps',value: -0.18,prevValue: -0.25,change: 0.07,  date: '2024-12-31' },
  { key: 'retail_sales', label: 'Retail Sales',        series: 'RSAFS',           unit: 'B', value: 724.9, prevValue: 718.2,change: 6.7,   date: '2024-11-01' },
  { key: 'housing',      label: 'Housing Starts',      series: 'HOUST',           unit: 'K', value: 1289,  prevValue: 1311, change: -22,   date: '2024-11-01' },
  { key: 'consumer_conf',label: 'Consumer Confidence', series: 'UMCSENT',         unit: '',  value: 74.0,  prevValue: 71.8, change: 2.2,   date: '2024-12-01' },
  { key: 'industrial',   label: 'Industrial Production',series: 'INDPRO',         unit: '',  value: 102.8, prevValue: 102.4,change: 0.4,   date: '2024-11-01' },
  { key: 'fed_balance',  label: 'Fed Balance Sheet',   series: 'WALCL',           unit: 'T', value: 7.01,  prevValue: 7.12, change: -0.11, date: '2024-12-25' },
]

const YIELD_MOCK = [
  { label: '1M', value: 5.27 }, { label: '3M', value: 5.32 }, { label: '6M', value: 5.20 },
  { label: '1Y', value: 4.98 }, { label: '2Y', value: 4.43 }, { label: '5Y', value: 4.23 },
  { label: '7Y', value: 4.28 }, { label: '10Y', value: 4.25 }, { label: '20Y', value: 4.55 },
  { label: '30Y', value: 4.48 },
]

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

async function fetchSeries(seriesId: string, limit = 12) {
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
  if (!KEY_VALID) return YIELD_MOCK
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
  if (!KEY_VALID) return MACRO_MOCK
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
    indicators.map(i => fetchSeries(i.series, 13))
  )

  return indicators.map((ind, i) => {
    const obs = results[i].status === 'fulfilled' ? results[i].value : []
    const latest = obs?.[0]?.value
    const prev = obs?.[1]?.value
    const value = latest && latest !== '.' ? parseFloat(latest) : null
    const prevValue = prev && prev !== '.' ? parseFloat(prev) : null
    const change = value !== null && prevValue !== null ? value - prevValue : null
    return { ...ind, value, prevValue, change, date: obs?.[0]?.date || 'N/A' }
  })
}

const FED_BALANCE_MOCK = [
  { date:'2021-01-01', value:7.35 }, { date:'2021-04-01', value:7.69 },
  { date:'2021-07-01', value:8.06 }, { date:'2021-10-01', value:8.57 },
  { date:'2022-01-01', value:8.87 }, { date:'2022-04-01', value:8.96 },
  { date:'2022-07-01', value:8.89 }, { date:'2022-10-01', value:8.76 },
  { date:'2023-01-01', value:8.49 }, { date:'2023-04-01', value:8.59 },
  { date:'2023-07-01', value:8.17 }, { date:'2023-10-01', value:7.88 },
  { date:'2024-01-01', value:7.66 }, { date:'2024-04-01', value:7.43 },
  { date:'2024-07-01', value:7.18 }, { date:'2024-10-01', value:7.01 },
]

export async function getFedBalanceSheet() {
  if (!KEY_VALID) return FED_BALANCE_MOCK
  const obs = await fetchSeries('WALCL', 104)
  if (!obs.length) return FED_BALANCE_MOCK
  return obs.map((o: { date: string; value: string }) => ({
    date: o.date,
    value: o.value !== '.' ? parseFloat(o.value) / 1e6 : null
  })).reverse()
}
