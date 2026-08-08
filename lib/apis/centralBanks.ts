import { getCache, setCache } from '@/lib/cache'

export interface CentralBankSpeech {
  id: string
  bank: string
  speaker: string
  title: string
  date: string
  link: string
  sentiment: 'HAWKISH' | 'DOVISH' | 'NEUTRAL'
  keyWords: string[]
}

export interface CentralBankRate {
  bank: string
  country: string
  rate: number
  lastChange: string
  direction: 'UP' | 'DOWN' | 'HOLD'
  nextMeeting: string
  color: string
}

const CENTRAL_BANKS = [
  {
    name: 'FED',
    label: 'Federal Reserve',
    rssUrl: 'https://www.federalreserve.gov/feeds/speeches.xml',
    color: '#38bdf8',
  },
  {
    name: 'ECB',
    label: 'European Central Bank',
    rssUrl: 'https://www.ecb.europa.eu/rss/speeches.rss',
    color: '#22c55e',
  },
  {
    name: 'BOE',
    label: 'Bank of England',
    rssUrl: 'https://www.bankofengland.co.uk/rss/speeches',
    color: '#a78bfa',
  },
  {
    name: 'BOC',
    label: 'Bank of Canada',
    rssUrl: 'https://www.bankofcanada.ca/feed/?post_type=press',
    color: '#fb923c',
  },
]

// Static rate data — updated manually from major bank announcements
// These will be overridden when real data is available
export const RATE_CARDS: CentralBankRate[] = [
  { bank: 'FED', country: 'United States', rate: 5.25, lastChange: '2023-07-26', direction: 'HOLD', nextMeeting: '2026-07-30', color: '#38bdf8' },
  { bank: 'ECB', country: 'Eurozone', rate: 4.50, lastChange: '2023-09-14', direction: 'HOLD', nextMeeting: '2026-07-24', color: '#22c55e' },
  { bank: 'BOE', country: 'United Kingdom', rate: 5.25, lastChange: '2023-08-03', direction: 'HOLD', nextMeeting: '2026-08-07', color: '#a78bfa' },
  { bank: 'BOJ', country: 'Japan', rate: -0.10, lastChange: '2016-01-29', direction: 'HOLD', nextMeeting: '2026-07-31', color: '#f59e0b' },
  { bank: 'BOC', country: 'Canada', rate: 5.00, lastChange: '2023-07-12', direction: 'HOLD', nextMeeting: '2026-07-30', color: '#fb923c' },
  { bank: 'RBI', country: 'India', rate: 6.50, lastChange: '2023-04-06', direction: 'HOLD', nextMeeting: '2026-08-08', color: '#ef4444' },
]

const HAWKISH_WORDS = ['hike','tighten','restrictive','inflation','concern','risk','vigilant','higher for longer','not cutting','remain elevated']
const DOVISH_WORDS = ['cut','ease','accommodative','support','growth','slowdown','below target','dovish','loosen','lower rates']

function parseRSSItems(xml: string, bankName: string): CentralBankSpeech[] {
  const items: CentralBankSpeech[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1]
    const title = (/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/.exec(item)?.[1] ?? /<title[^>]*>([\s\S]*?)<\/title>/.exec(item)?.[1] ?? '').trim()
    const link = (/<link>([\s\S]*?)<\/link>/.exec(item)?.[1] ?? /<link[^>]+href="([^"]+)"/.exec(item)?.[1] ?? '').trim()
    const dateStr = (/<pubDate>([\s\S]*?)<\/pubDate>/.exec(item)?.[1] ?? /<dc:date>([\s\S]*?)<\/dc:date>/.exec(item)?.[1] ?? '').trim()
    const desc = (/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]>/.exec(item)?.[1] ?? /<description[^>]*>([\s\S]*?)<\/description>/.exec(item)?.[1] ?? '')
      .replace(/<[^>]+>/g, '').trim()

    if (!title) continue
    const fullText = (title + ' ' + desc).toLowerCase()
    const hawks = HAWKISH_WORDS.filter(w => fullText.includes(w)).length
    const doves = DOVISH_WORDS.filter(w => fullText.includes(w)).length
    const sentiment: CentralBankSpeech['sentiment'] = hawks > doves ? 'HAWKISH' : doves > hawks ? 'DOVISH' : 'NEUTRAL'
    const keyWords = hawks > doves
      ? HAWKISH_WORDS.filter(w => fullText.includes(w)).slice(0, 3)
      : DOVISH_WORDS.filter(w => fullText.includes(w)).slice(0, 3)

    items.push({
      id: link || `${bankName}-${dateStr}`,
      bank: bankName,
      speaker: bankName + ' Official',
      title: title.slice(0, 120),
      date: dateStr ? new Date(dateStr).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      link,
      sentiment,
      keyWords,
    })
  }
  return items.slice(0, 10)
}

async function fetchBankSpeeches(bank: typeof CENTRAL_BANKS[0]): Promise<CentralBankSpeech[]> {
  try {
    const res = await fetch(bank.rssUrl, {
      headers: { 'User-Agent': 'GodVision/1.0 financial-terminal' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const xml = await res.text()
    return parseRSSItems(xml, bank.name)
  } catch { return [] }
}

export async function getCentralBankSpeeches(): Promise<CentralBankSpeech[]> {
  const cacheKey = 'cb_speeches'
  const cached = await getCache(cacheKey)
  if (cached && !cached.stale) return cached.data as CentralBankSpeech[]

  const results = await Promise.allSettled(CENTRAL_BANKS.map(fetchBankSpeeches))
  const all: CentralBankSpeech[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }
  const sorted = all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 40)

  await setCache(cacheKey, sorted, 3600) // 1 hour
  return sorted
}
