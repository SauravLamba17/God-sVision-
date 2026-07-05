import axios from 'axios'

const BASE = 'https://api.coingecko.com/api/v3'
const BINANCE = 'https://api.binance.com/api/v3'

export async function getCryptoTop100() {
  const { data } = await axios.get(`${BASE}/coins/markets`, {
    params: {
      vs_currency: 'usd',
      order: 'market_cap_desc',
      per_page: 100,
      page: 1,
      sparkline: true,
      price_change_percentage: '1h,24h,7d'
    },
    timeout: 10000
  })
  return data
}

export async function getCryptoTrending() {
  const { data } = await axios.get(`${BASE}/search/trending`, { timeout: 8000 })
  return data.coins?.slice(0, 7) || []
}

export async function getGlobalMarket() {
  const { data } = await axios.get(`${BASE}/global`, { timeout: 8000 })
  return data.data
}

export async function getCoinChart(id: string, days = 30) {
  const { data } = await axios.get(`${BASE}/coins/${id}/ohlc`, {
    params: { vs_currency: 'usd', days },
    timeout: 10000
  })
  return data
}

export async function getFearGreed() {
  const { data } = await axios.get('https://api.alternative.me/fng/?limit=7', { timeout: 8000 })
  return data.data || []
}

export async function getBinanceAllTickers() {
  const { data } = await axios.get(`${BINANCE}/ticker/24hr`, { timeout: 10000 })
  return data
}

export async function getDeFiTVL() {
  const { data } = await axios.get('https://api.llama.fi/protocols', { timeout: 10000 })
  return data?.slice(0, 20) || []
}

export function getBTCHalvingCountdown(): { days: number; hours: number; minutes: number } {
  const halvingDate = new Date('2028-04-20T00:00:00Z')
  const now = new Date()
  const diff = halvingDate.getTime() - now.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return { days, hours, minutes }
}
