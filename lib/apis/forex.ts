import axios from 'axios'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR', 'MXN', 'BRL', 'SGD', 'HKD', 'NOK', 'SEK']

export const MAJOR_PAIRS = [
  { pair: 'EUR/USD', base: 'EUR', quote: 'USD' },
  { pair: 'GBP/USD', base: 'GBP', quote: 'USD' },
  { pair: 'USD/JPY', base: 'USD', quote: 'JPY' },
  { pair: 'USD/CHF', base: 'USD', quote: 'CHF' },
  { pair: 'AUD/USD', base: 'AUD', quote: 'USD' },
  { pair: 'USD/CAD', base: 'USD', quote: 'CAD' },
  { pair: 'NZD/USD', base: 'NZD', quote: 'USD' },
  { pair: 'EUR/GBP', base: 'EUR', quote: 'GBP' },
  { pair: 'EUR/JPY', base: 'EUR', quote: 'JPY' },
  { pair: 'GBP/JPY', base: 'GBP', quote: 'JPY' },
  { pair: 'AUD/JPY', base: 'AUD', quote: 'JPY' },
  { pair: 'EUR/CHF', base: 'EUR', quote: 'CHF' },
  { pair: 'USD/CNY', base: 'USD', quote: 'CNY' },
  { pair: 'USD/INR', base: 'USD', quote: 'INR' },
  { pair: 'USD/MXN', base: 'USD', quote: 'MXN' },
  { pair: 'USD/BRL', base: 'USD', quote: 'BRL' },
]

export const CENTRAL_BANK_RATES = [
  { bank: 'Fed (US)', rate: 5.33, currency: 'USD', nextMeeting: '2024-09-18', trend: 'hold' },
  { bank: 'ECB (EU)', rate: 4.25, currency: 'EUR', nextMeeting: '2024-09-12', trend: 'cut' },
  { bank: 'BOE (UK)', rate: 5.25, currency: 'GBP', nextMeeting: '2024-08-01', trend: 'hold' },
  { bank: 'BOJ (JP)', rate: 0.10, currency: 'JPY', nextMeeting: '2024-08-01', trend: 'hike' },
  { bank: 'RBA (AU)', rate: 4.35, currency: 'AUD', nextMeeting: '2024-08-06', trend: 'hold' },
  { bank: 'BOC (CA)', rate: 4.75, currency: 'CAD', nextMeeting: '2024-07-24', trend: 'cut' },
  { bank: 'SNB (CH)', rate: 1.25, currency: 'CHF', nextMeeting: '2024-09-26', trend: 'cut' },
  { bank: 'PBOC (CN)', rate: 3.45, currency: 'CNY', nextMeeting: '2024-08-20', trend: 'cut' },
  { bank: 'RBI (IN)', rate: 6.50, currency: 'INR', nextMeeting: '2024-08-08', trend: 'hold' },
]

export async function getForexRates(base = 'USD') {
  const { data } = await axios.get(`https://api.exchangerate-api.com/v4/latest/${base}`, { timeout: 8000 })
  return data
}

export async function getForexMatrix() {
  const rates: Record<string, Record<string, number>> = {}
  const baseCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY']
  const { data: usdRates } = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', { timeout: 8000 })

  for (const base of baseCurrencies) {
    rates[base] = {}
    for (const quote of baseCurrencies) {
      if (base === quote) { rates[base][quote] = 1; continue }
      if (base === 'USD') {
        rates[base][quote] = usdRates.rates[quote]
      } else {
        const baseInUSD = 1 / usdRates.rates[base]
        rates[base][quote] = baseInUSD * usdRates.rates[quote]
      }
    }
  }
  return rates
}
