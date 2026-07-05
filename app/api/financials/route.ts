import { NextRequest, NextResponse } from 'next/server'
import yahooFinance from 'yahoo-finance2'
import axios from 'axios'
import { getCache, setCache } from '@/lib/cache'

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json,text/plain,*/*',
  'Referer': 'https://finance.yahoo.com/',
}

function safeNum(v: any): number | null {
  if (v === null || v === undefined) return null
  const raw = typeof v === 'object' && v !== null && 'raw' in v ? v.raw : v
  const n = Number(raw)
  return isFinite(n) ? n : null
}

function flattenStatement(items: any[]): any[] {
  return (items || []).map(item => {
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(item)) {
      if (k === 'maxAge') continue
      out[k] = (v && typeof v === 'object' && 'raw' in (v as any)) ? (v as any).raw : v
    }
    return out
  })
}

function buildKeyMetrics(fd: any, ks: any, sd: any) {
  return {
    revenue:           safeNum(fd.totalRevenue),
    grossProfit:       safeNum(fd.grossProfits),
    ebitda:            safeNum(fd.ebitda),
    netIncome:         safeNum(fd.netIncomeToCommon),
    freeCashFlow:      safeNum(fd.freeCashflow),
    operatingCashFlow: safeNum(fd.operatingCashflow),
    totalDebt:         safeNum(fd.totalDebt),
    totalCash:         safeNum(fd.totalCash),
    debtToEquity:      safeNum(fd.debtToEquity),
    returnOnEquity:    safeNum(fd.returnOnEquity),
    returnOnAssets:    safeNum(fd.returnOnAssets),
    profitMargin:      safeNum(fd.profitMargins),
    operatingMargin:   safeNum(fd.operatingMargins),
    grossMargin:       safeNum(fd.grossMargins),
    revenueGrowth:     safeNum(fd.revenueGrowth),
    earningsGrowth:    safeNum(fd.earningsGrowth),
    currentRatio:      safeNum(fd.currentRatio),
    quickRatio:        safeNum(fd.quickRatio),
    eps:               safeNum(ks.trailingEps),
    bookValue:         safeNum(ks.bookValue),
    priceToBook:       safeNum(ks.priceToBook),
    beta:              safeNum(ks.beta),
    sharesOutstanding: safeNum(ks.sharesOutstanding),
    shortRatio:        safeNum(ks.shortRatio),
    dividendYield:     safeNum(sd.dividendYield),
    fiftyTwoWeekHigh:  safeNum(sd.fiftyTwoWeekHigh),
    fiftyTwoWeekLow:   safeNum(sd.fiftyTwoWeekLow),
  }
}

async function fetchViaPackage(ticker: string, modules: string[]): Promise<any> {
  for (let i = 0; i < 3; i++) {
    try {
      return await (yahooFinance as any).quoteSummary(ticker, { modules })
    } catch (err: any) {
      const msg = err?.message || ''
      if ((msg.includes('Too Many Requests') || msg.includes('429') || msg.includes('invalid json')) && i < 2) {
        await new Promise(r => setTimeout(r, 4000 * (i + 1)))
        continue
      }
      throw err
    }
  }
}

// Fallback: query2 direct with crumb extracted from package internals
async function fetchViaDirect(ticker: string, moduleStr: string): Promise<any> {
  const res = await axios.get(
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}`,
    { params: { modules: moduleStr, formatted: false }, headers: YF_HEADERS, timeout: 12000 }
  )
  return (res.data as any).quoteSummary?.result?.[0]
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const ticker = (searchParams.get('ticker') || '').toUpperCase().trim()
  const period = searchParams.get('period') || 'annual'

  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const cacheKey = `financials:${ticker}:${period}`
  const cached = getCache(cacheKey)
  if (cached) return NextResponse.json({ data: cached, source: 'cache' })

  const moduleArr = period === 'quarterly'
    ? ['incomeStatementHistoryQuarterly', 'balanceSheetHistoryQuarterly', 'cashflowStatementHistoryQuarterly', 'financialData', 'defaultKeyStatistics', 'summaryDetail']
    : ['incomeStatementHistory', 'balanceSheetHistory', 'cashflowStatementHistory', 'financialData', 'defaultKeyStatistics', 'summaryDetail']
  const moduleStr = moduleArr.join(',')

  let s: any = null

  // Try yahoo-finance2 package (handles crumb internally)
  try {
    s = await fetchViaPackage(ticker, moduleArr as any)
  } catch (pkgErr: any) {
    const msg = pkgErr?.message || ''
    if (!msg.includes('Too Many Requests') && !msg.includes('429') && !msg.includes('invalid json')) {
      return NextResponse.json({ error: msg })
    }
    // Rate limited â€” try direct without crumb (some modules don't require it)
    try {
      s = await fetchViaDirect(ticker, moduleStr)
    } catch {
      return NextResponse.json({ error: 'Yahoo Finance rate limit reached â€” try again in a moment', rateLimited: true }, { status: 429 })
    }
  }

  if (!s) return NextResponse.json({ error: 'No data returned', rateLimited: true }, { status: 429 })

  try {
    const incomeKey   = period === 'quarterly' ? 'incomeStatementHistoryQuarterly' : 'incomeStatementHistory'
    const balanceKey  = period === 'quarterly' ? 'balanceSheetHistoryQuarterly'    : 'balanceSheetHistory'
    const cashflowKey = period === 'quarterly' ? 'cashflowStatementHistoryQuarterly' : 'cashflowStatementHistory'

    const income   = flattenStatement(s[incomeKey]?.incomeStatementHistory    || s[incomeKey]?.statements    || [])
    const balance  = flattenStatement(s[balanceKey]?.balanceSheetStatements   || s[balanceKey]?.statements   || [])
    const cashflow = flattenStatement(s[cashflowKey]?.cashflowStatements      || s[cashflowKey]?.statements  || [])

    const keyMetrics = buildKeyMetrics(s.financialData || {}, s.defaultKeyStatistics || {}, s.summaryDetail || {})
    const data = { income, balance, cashflow, keyMetrics, ticker, period }
    setCache(cacheKey, data, 3600)
    return NextResponse.json({ data, source: 'live' })
  } catch (parseErr: any) {
    return NextResponse.json({ error: parseErr?.message || 'Parse error' })
  }
}
