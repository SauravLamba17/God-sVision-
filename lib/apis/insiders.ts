import { getCache, setCache } from '@/lib/cache'

export interface InsiderTx {
  id: string
  company: string
  ticker: string
  insider: string
  // null when EDGAR's Atom entry doesn't state it. The feed carries no
  // transaction detail at all, so these are usually null — defaulting them to
  // "BUY"/"10% Owner" would label every filing as a purchase it never was.
  role: string | null
  transactionType: 'BUY' | 'SELL' | 'GIFT' | 'AWARD' | null
  // null when EDGAR's Atom summary doesn't disclose the figure — the feed
  // usually omits share counts and prices, which live in the filing itself.
  // Never fabricate these: they are financial figures users act on.
  shares: number | null
  pricePerShare: number | null
  totalValue: number | null
  filedDate: string
  link: string
  aiSignal?: string
}

// Parse EDGAR Atom feed XML (basic regex approach — DOMParser is browser-only)
function parseAtomEntries(xml: string): Array<{ title: string; link: string; summary: string; updated: string }> {
  const entries: Array<{ title: string; link: string; summary: string; updated: string }> = []
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
  let match
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1]
    const title = (/<title[^>]*>([\s\S]*?)<\/title>/.exec(entry)?.[1] ?? '').replace(/<!\[CDATA\[|\]\]>/g, '').trim()
    const link = /<link[^>]+href="([^"]+)"/.exec(entry)?.[1] ?? ''
    const summary = (/<summary[^>]*>([\s\S]*?)<\/summary>/.exec(entry)?.[1] ?? '').replace(/<[^>]+>/g, '').replace(/<!\[CDATA\[|\]\]>/g, '').trim()
    const updated = /<updated>([\s\S]*?)<\/updated>/.exec(entry)?.[1] ?? ''
    if (title) entries.push({ title, link, summary, updated })
  }
  return entries
}

// Extract company name and filer from Form 4 title format:
// "4 - Company Name (Ticker) (0001234567) (Filer)"
function parseFormTitle(title: string): { company: string; ticker: string; filer: string } {
  const tickerMatch = /\(([A-Z]{1,5})\)/.exec(title)
  const compMatch = /^4 - (.+?) \(/.exec(title)
  const filerMatch = /\)\s*\((.+?)\)\s*$/.exec(title)
  return {
    company: compMatch?.[1]?.trim() ?? title,
    ticker: tickerMatch?.[1] ?? '',
    filer: filerMatch?.[1]?.trim() ?? '',
  }
}

// Build a transaction from the filing info actually present in the Atom entry.
// Anything EDGAR doesn't disclose stays null rather than being invented.
function buildTxFromSummary(summary: string, link: string, updated: string, company: string, filer: string): InsiderTx {
  const isSell = /sale|sold|sell/i.test(summary)
  const isAward = /award|grant|option|vest/i.test(summary)
  const isGift = /gift/i.test(summary)
  const isBuy = /purchase|bought|acquir/i.test(summary)
  // Only claim a type the filing actually indicates — never default to BUY.
  const type: InsiderTx['transactionType'] =
    isGift ? 'GIFT' : isAward ? 'AWARD' : isSell ? 'SELL' : isBuy ? 'BUY' : null

  // Extract numbers from summary when possible
  const shareMatch = /(\d[\d,]*)\s+shares?/i.exec(summary)
  const priceMatch = /\$\s*(\d+\.?\d*)/i.exec(summary)
  const shares = shareMatch ? parseInt(shareMatch[1].replace(/,/g, '')) : null
  const price = priceMatch ? parseFloat(priceMatch[1]) : null

  // Get role from EDGAR title/summary hints
  const isDirector = /director|board/i.test(summary + filer)
  const isCEO = /chief exec|ceo|president/i.test(summary + filer)
  const isCFO = /chief fin|cfo/i.test(summary + filer)
  const role = isCEO ? 'CEO' : isCFO ? 'CFO' : isDirector ? 'Director' : null

  return {
    id: link,
    company,
    ticker: '',
    insider: filer || 'Unknown',
    role,
    transactionType: type,
    shares,
    pricePerShare: price,
    totalValue: shares !== null && price !== null ? shares * price : null,
    filedDate: updated.slice(0, 10),
    link: link.replace('-index.htm', '').replace('https://www.sec.gov', 'https://www.sec.gov'),
  }
}

export async function fetchInsiderTransactions(minValue = 100000): Promise<InsiderTx[]> {
  const cacheKey = `insiders_${minValue}`
  const cached = await getCache(cacheKey)
  if (cached && !cached.stale) return cached.data as InsiderTx[]

  try {
    const res = await fetch(
      // owner=only restricts to ownership filings. With owner=include, EDGAR's
      // `type=4` prefix-matches and the feed comes back full of 424B2/487/497
      // prospectuses and zero actual Form 4s.
      'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&dateb=&owner=only&count=40&search_text=&output=atom',
      {
        headers: { 'User-Agent': 'GodVision/1.0 operations@myhealthiq.io' },
        signal: AbortSignal.timeout(10000),
      }
    )
    if (!res.ok) throw new Error(`EDGAR HTTP ${res.status}`)
    const xml = await res.text()
    const entries = parseAtomEntries(xml)

    const txs: InsiderTx[] = entries
      // EDGAR's `type=4` prefix-matches, so the feed also returns 424B2, 487,
      // 497 etc. Keep only genuine Form 4 entries, whose titles start "4 - ".
      .filter(e => /^4\s*-\s/.test(e.title))
      .map(e => {
        const { company, ticker, filer } = parseFormTitle(e.title)
        const tx = buildTxFromSummary(e.summary, e.link, e.updated, company, filer)
        tx.ticker = ticker
        return tx
      })
      // Keep filings whose value EDGAR didn't disclose — they're real Form 4s,
      // just without a parseable amount. The floor only filters known values.
      .filter(tx => tx.totalValue === null || tx.totalValue >= minValue)
      .slice(0, 50)

    await setCache(cacheKey, txs, 900)
    return txs
  } catch (err) {
    // Return empty on failure — no mock data; show real EDGAR error
    console.error('EDGAR fetch failed:', err)
    return []
  }
}
