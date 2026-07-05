import { NextResponse } from 'next/server'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { getCache, setCache } from '@/lib/cache'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker') || ''
  const type   = searchParams.get('type') || 'latest'  // latest | purchases | sales

  const cacheKey = `insider_${type}_${ticker}`
  const cached = getCache(cacheKey)
  if (cached && !cached.stale) {
    return NextResponse.json({ data: cached.data, source: 'cached' })
  }

  try {
    const params = new URLSearchParams({
      s: ticker, o: '', pl: '', ph: '', ll: '', lh: '',
      fd: type === 'latest' ? '7' : '30',
      fdr: '', td: '0', tdr: '',
      fdlyl: '', fdlyh: '', daysago: '',
      xp: type !== 'purchases' ? '1' : '0',  // include purchases
      xs: type !== 'sales' ? '1' : '0',       // include sales
      vl: '25', vh: '', ocl: '', och: '',
      sic1: '-1', sicl: '100', sich: '9999',
      grp: '0', nfl: '', nfh: '', nil: '', nih: '', nol: '', noh: '',
      v2l: '', v2h: '', oc2l: '', oc2h: '',
      sortcol: '0', cnt: '50', page: '1',
    })

    const res = await axios.get(`http://openinsider.com/screener?${params.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      timeout: 8000,
    })

    const $ = cheerio.load(res.data)
    const trades: any[] = []

    $('table.tinytable tbody tr').each((_, row) => {
      const cells = $(row).find('td')
      if (cells.length < 13) return

      const filingDate = $(cells[1]).text().trim()
      const tradeDate  = $(cells[2]).text().trim()
      const tickerSym  = $(cells[3]).find('a').text().trim()
      const companyName = $(cells[4]).find('a').text().trim()
      const insiderName = $(cells[5]).text().trim()
      const title       = $(cells[6]).text().trim()
      const tradeType   = $(cells[7]).text().trim()
      const price       = parseFloat($(cells[8]).text().replace(/[$,]/g, '')) || 0
      const qty         = parseInt($(cells[9]).text().replace(/[+,]/g, '')) || 0
      const owned       = parseInt($(cells[10]).text().replace(/,/g, '')) || 0
      const deltaOwned  = $(cells[11]).text().trim()
      const value       = parseFloat($(cells[12]).text().replace(/[$,+]/g, '')) || 0

      if (!tickerSym && !companyName) return

      trades.push({
        filingDate, tradeDate,
        ticker:      tickerSym || ticker.toUpperCase(),
        company:     companyName,
        insider:     insiderName,
        title,
        type:        tradeType,
        price,
        quantity:    qty,
        sharesOwned: owned,
        deltaOwned,
        value,
        isBuy:       tradeType.includes('P') || tradeType === 'A',
      })
    })

    if (trades.length === 0) throw new Error('No trades parsed')

    setCache(cacheKey, trades, 600)
    return NextResponse.json({ data: trades, source: 'live' })
  } catch (err: any) {
    if (cached) return NextResponse.json({ data: cached.data, source: 'stale' })

    // Fallback sample data so the page isn't empty
    const fallback = [
      { ticker: 'NVDA', company: 'NVIDIA Corp', insider: 'Jensen Huang', title: 'CEO', type: 'S', price: 875, quantity: 50000, value: 43750000, isBuy: false, tradeDate: new Date().toISOString().slice(0, 10), filingDate: new Date().toISOString().slice(0, 10) },
      { ticker: 'MSFT', company: 'Microsoft Corp', insider: 'Brad Smith', title: 'President', type: 'P', price: 420, quantity: 5000, value: 2100000, isBuy: true, tradeDate: new Date().toISOString().slice(0, 10), filingDate: new Date().toISOString().slice(0, 10) },
    ]
    return NextResponse.json({ data: fallback, source: 'fallback', error: err.message })
  }
}
