import axios from 'axios'
import '@/lib/feedHealth' // registers axios feed-health interceptors

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
