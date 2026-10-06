/**
 * Evidence Engine checks.   npm run test:evidence
 *  1. Fixtures → expected drivers (market, sector, stock news, linked event, no driver)
 *  2. False-attribution traps   3. Wording rule   4. Flip/drift → recompute
 *  5. Timing   6. Live: today's real movers via a LOCAL server. Start the app first;
 *     BASE_URL defaults to http://localhost:3001.
 *  One throwaway account is reused across runs (sign-up is rate limited to 10/hour
 *  per IP); its credentials sit in the OS temp dir. Delete it when done:
 *     npm run test:evidence -- --cleanup
 */
import { signIn, cleanupAccount, CLEANUP } from './liveAccount.ts'
import { explain, headlineScore, sameStory, sessionWindow, SHOW_THRESHOLD } from '../lib/evidence/engine.ts'
import { BANNED, formatLine } from '../lib/evidence/summary.ts'
import { needsRecompute, isCurrent, isSameMarketDay } from '../lib/evidence/freshness.ts'
import type { Explanation, Headline, MarketContext, Quote } from '../lib/evidence/types.ts'
import { matchEntitiesInText } from '../lib/graph/index.ts'
import { scoreHeadlines } from '../lib/apis/newsSentiment.ts'

type Row = { check: string; pass: boolean; detail: string }
const rows: Row[] = []
const check = (c: string, pass: boolean, detail = '') => rows.push({ check: c, pass, detail })
const NOW = Date.parse('2026-10-05T15:00:00Z')
const H = 3600_000

const q = (symbol: string, changePct: number, name = symbol, extra: Partial<Quote> = {}): Quote => ({ symbol, name, price: 100, changePct, at: NOW, ...extra })
let hid = 0
const headline = (title: string, hoursAgo = 2, source = 'Test Wire'): Headline => ({
  id: hid++, title, source, url: `https://example.com/${hid}`, publishedAt: NOW - hoursAgo * H,
  entities: matchEntitiesInText(title).map(m => m.entity.id), sentiment: scoreHeadlines([title])[0].sentiment,
})
const ctx = (market: 'US' | 'IN', over: Partial<MarketContext> = {}): MarketContext => ({
  market, builtAt: NOW, indices: {}, sectorEtfs: {}, quotes: {}, commodities: {}, currencies: {},
  headlines: [], events: [], earnings: [], macro: [], globalIndices: {}, ...over,
})
const types = (e: Explanation) => e.drivers.map(d => d.type)
const show = (e: Explanation) => `${formatLine(e.id, e.snapshot.changePct, e.summary)}  [${e.drivers.map(d => `${d.type}:${d.score}`).join(', ')}]`
const all: Explanation[] = []
const run = (t: Quote, kind: 'stock' | 'index', c: MarketContext) => { const e = explain(t, kind, c); all.push(e); return e }

// ── 1. Fixtures ──────────────────────────────────────────────────────────────
{ // market-wide: NVDA falls with the Nasdaq and tech
  const c = ctx('US', {
    indices: { '^IXIC': q('^IXIC', -2.4, 'Nasdaq'), '^GSPC': q('^GSPC', -1.9, 'S&P 500') },
    sectorEtfs: { 'sector:information-technology': { ...q('XLK', -2.8, 'Information Technology'), etf: 'XLK' } },
  })
  const e = run(q('NVDA', -3.1, 'Nvidia'), 'stock', c)
  check('market-wide move → market + sector are the top two drivers', ['market', 'sector'].every(t => types(e).slice(0, 2).includes(t as any)) && e.summary.startsWith('moved with Nasdaq (−2.4%) and tech (−2.8%)'), show(e))
}
{ // sector move: Indian IT falls while the Nifty is flat
  const c = ctx('IN', {
    indices: { '^NSEI': q('^NSEI', -0.1, 'Nifty 50') },
    quotes: Object.fromEntries([q('TCS.NS', -3.0), q('INFY.NS', -2.6), q('WIPRO.NS', -2.2), q('HCLTECH.NS', -2.8), q('TECHM.NS', -2.4), q('RELIANCE.NS', 0.3)].map(x => [x.symbol, x])),
  })
  const e = run(c.quotes['TCS.NS'], 'stock', c)
  check('sector move → sector (+peers) lead, no market driver', ['sector', 'peers'].includes(types(e)[0]) && !types(e).includes('market'), show(e))
}
{ // stock-specific news
  const c = ctx('IN', {
    indices: { '^NSEI': q('^NSEI', 0.1, 'Nifty 50') },
    quotes: Object.fromEntries([q('ITC.NS', 4.5), q('HINDUNILVR.NS', 0.2), q('NESTLEIND.NS', -0.1), q('BRITANNIA.NS', 0.3)].map(x => [x.symbol, x])),
    headlines: [headline('ITC shares jump after Q2 profit beats estimates'), headline('Monsoon rains lift rural demand outlook', 3)],
  })
  const e = run(c.quotes['ITC.NS'], 'stock', c)
  check('stock-specific news → news driver leads (score ≥ 0.55)', types(e)[0] === 'news' && e.drivers[0].score >= 0.55, show(e))
}
{ // linked event: Taiwan earthquake, NVDA (TSMC supplier link) while Nasdaq is flat
  const c = ctx('US', {
    indices: { '^IXIC': q('^IXIC', 0.1, 'Nasdaq') },
    events: [{ kind: 'earthquake', title: 'M7.2 earthquake — 25 km E of Hualien City, Taiwan', url: 'https://earthquake.usgs.gov/x', at: NOW - 3 * H, magnitude: 7.2, countries: ['country:taiwan'] }],
  })
  const e = run(q('NVDA', -1.6, 'Nvidia'), 'stock', c)
  const d = e.drivers.find(x => x.type === 'linked_event')
  check('linked event → Taiwan quake via TSMC supplier link', !!d && /Taiwan/.test(d.label) && /supplier/.test(d.label) && d.score >= 0.4, show(e))
}
{ // no driver
  const c = ctx('IN', {
    indices: { '^NSEI': q('^NSEI', -0.1, 'Nifty 50') },
    quotes: Object.fromEntries([q('RELIANCE.NS', 2.0), q('ONGC.NS', -0.2), q('BPCL.NS', 0.1), q('COALINDIA.NS', -0.3)].map(x => [x.symbol, x])),
    commodities: { 'commodity:crude-oil': q('CL=F', 0.2, 'Crude oil') },
  })
  const e = run(c.quotes['RELIANCE.NS'], 'stock', c)
  check('no-driver move → "no clear driver found"', types(e)[0] === 'no_clear_driver' && e.summary === 'no clear driver found', show(e))
}
{ // index: breadth + global
  const c = ctx('US', {
    indices: { '^GSPC': q('^GSPC', -1.4, 'S&P 500') },
    sectorEtfs: Object.fromEntries(['XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLRE', 'XLB', 'XLC'].map((s, i) => [`s${i}`, { ...q(s, i < 10 ? -1.2 - i * 0.1 : 0.4, s), etf: s }])),
    globalIndices: { '^GDAXI': q('^GDAXI', -1.1, 'DAX'), '^FTSE': q('^FTSE', -0.8, 'FTSE 100'), '^N225': q('^N225', 0.5, 'Nikkei') },
  })
  const e = run(c.indices['^GSPC'], 'index', c)
  check('index move → breadth (strong, in the line) + global markets (weak, expanded view only)',
    types(e).includes('breadth') && types(e).includes('global') && /10 of 11 sectors down/.test(e.summary) && !/DAX/.test(e.summary), show(e))
}
{ // the line names and counts only STRONG drivers (≥0.5); WEAK ones stay in the expanded view
  const strong = headline('HCLTech shares crash 3.5% after deal slowdown warning', 1)
  const weak = { ...headline('HCLTech Q2 deal wins tracker: board to consider interim dividend', 30), sentiment: 'NEUTRAL' as const }
  const allWeak = run(q('HCLTECH.NS', -3.3, 'HCLTech'), 'stock', ctx('IN', { headlines: [weak] }))
  const mixed = run(q('HCLTECH.NS', -3.3, 'HCLTech'), 'stock', ctx('IN', { headlines: [strong, weak] }))
  const weakScores = allWeak.drivers.filter(d => d.type === 'news').map(d => d.score)
  check('line: all-WEAK drivers read "no clear driver found" but stay in the expanded view',
    allWeak.summary === 'no clear driver found' && weakScores.length === 1 && weakScores[0] < 0.5, show(allWeak))
  check('line: headline count includes only drivers ≥0.5',
    mixed.summary === '1 related headline' && mixed.drivers.filter(d => d.type === 'news').length === 2, show(mixed))
}

// ── 2. False-attribution traps ───────────────────────────────────────────────
{
  const trap = headline("Infosys co-founder's foundation opens public library in Mysuru", 2)
  const s = headlineScore(trap, -2.0, NOW)
  const c = ctx('IN', { indices: { '^NSEI': q('^NSEI', 0.0) }, quotes: { 'INFY.NS': q('INFY.NS', -2.0) }, headlines: [trap] })
  const e = run(c.quotes['INFY.NS'], 'stock', c)
  check('trap: unrelated mention of the company scores low', s < 0.3 && types(e)[0] === 'no_clear_driver', `headline score ${s}; ${show(e)}`)
  const roundup = headline('Stocks to watch: TCS, Infosys, Wipro, HCLTech, ITC, Reliance Industries', 2)
  check('trap: round-up list scores below a focused headline', headlineScore(roundup, -2.0, NOW) < headlineScore(headline('Infosys shares fall after guidance cut', 2), -2.0, NOW),
    `round-up ${headlineScore(roundup, -2.0, NOW)}`)
  const old = headline('Infosys shares fall after guidance cut', 40)
  check('trap: 40h-old headline scores below a fresh one', headlineScore(old, -2.0, NOW) < headlineScore(headline('Infosys shares fall after guidance cut', 1), -2.0, NOW),
    `old ${headlineScore(old, -2.0, NOW)}`)
  const usMover = q('TGT', -3.0, 'Target Corporation')
  const c2 = ctx('US', { indices: { '^GSPC': q('^GSPC', 0.0) }, headlines: [headline('Fed sets new inflation target for 2027', 1)] })
  const e2 = run(usMover, 'stock', c2)
  check('trap: common-word company name ("Target") not matched to an unrelated headline', !types(e2).includes('news'), show(e2))
  // From a live run: HDFC Bank −2.1% while the only headline said "shares rise 2%" (another session).
  const opp = headline('HDFC Bank shares rise 2% after appointing new CEO', 3)
  const c3 = ctx('IN', { indices: { '^NSEI': q('^NSEI', 0.2) }, quotes: { 'HDFCBANK.NS': q('HDFCBANK.NS', -2.1, 'HDFC Bank') }, headlines: [opp] })
  const e3 = run(q('HDFCBANK.NS', -2.1, 'HDFC Bank'), 'stock', c3)
  check('trap: headline stating the opposite direction is not attached', headlineScore(opp, -2.1, NOW) === 0 && !types(e3).includes('news'), show(e3))
  // From a live run: a geopolitics headline naming the US attached to the S&P 500.
  const geo = headline('Radical repositioning of US, rise of China: minister on changing global order', 2)
  const mkt = headline('Wall Street stocks climb as US yields ease', 2)
  const c4 = ctx('US', { indices: { '^GSPC': q('^GSPC', 0.7, 'S&P 500') }, headlines: [geo, mkt] })
  const e4 = run(q('^GSPC', 0.7, 'S&P 500'), 'index', c4)
  const ev4 = e4.drivers.filter(d => d.type === 'news').map(d => d.evidence)
  check('trap: index ignores country headlines without a market term', !ev4.includes(geo.title) && ev4.includes(mkt.title), show(e4))

  // After-close: the quote's last trade was Friday's close (Fri 2 Oct, 16:00 ET = 20:00Z);
  // it is now Monday. Only headlines between Thursday's close and Friday's close may attach.
  const friClose = Date.parse('2026-10-02T20:00:00Z')
  const at = (iso: string, title: string) => ({ ...headline(title), publishedAt: Date.parse(iso) })
  const during = at('2026-10-02T17:00:00Z', 'Oracle shares climb after cloud contract win')
  const after = at('2026-10-02T22:30:00Z', 'Oracle shares jump in after-hours trading on upgrade')
  const before = at('2026-10-01T18:00:00Z', 'Oracle shares rise on analyst upgrade')
  const orcl = q('ORCL', 3.1, 'Oracle Corporation', { marketTime: friClose })
  const w = sessionWindow(orcl, 'US', NOW)
  const e5 = run(orcl, 'stock', ctx('US', { indices: { '^GSPC': q('^GSPC', 0.0) }, headlines: [during, after, before] }))
  const ev5 = e5.drivers.filter(d => d.type === 'news').map(d => d.evidence)
  check('trap: after-close and pre-window headlines do not attach to the session\'s move',
    ev5.includes(during.title) && !ev5.includes(after.title) && !ev5.includes(before.title),
    `window ${new Date(w.start).toISOString()} → ${new Date(w.end).toISOString()}; ${show(e5)}`)
  const inClose = Date.parse('2026-10-05T10:00:00Z') // 15:30 IST
  const wIn = sessionWindow({ marketTime: inClose }, 'IN', NOW)
  check('session window (India): previous close Fri 15:30 IST → Mon close', wIn.start === Date.parse('2026-10-02T10:00:00Z') && wIn.end === inClose,
    `${new Date(wIn.start).toISOString()} → ${new Date(wIn.end).toISOString()}`)

  // Weak relevance: the name alone, without financial context, is not evidence.
  const symphony = headline('Oracle rescues Nashville Symphony with $10M investment and partnership', 1)
  const e6 = run(q('ORCL', 3.1, 'Oracle Corporation'), 'stock', ctx('US', { indices: { '^GSPC': q('^GSPC', 0.0) }, headlines: [symphony] }))
  check('trap: "Oracle rescues Nashville Symphony" scores below the display threshold',
    headlineScore(symphony, 3.1, NOW) < SHOW_THRESHOLD && !types(e6).includes('news'), `score ${headlineScore(symphony, 3.1, NOW)}; ${show(e6)}`)
  const pie = headline('Apple pie recipe: the only one you need this fall', 1)
  const e7 = run(q('AAPL', 2.0, 'Apple Inc.'), 'stock', ctx('US', { indices: { '^IXIC': q('^IXIC', 0.0) }, headlines: [pie] }))
  check('trap: "Apple pie recipe" is not attached to AAPL', headlineScore(pie, 2.0, NOW) < SHOW_THRESHOLD && !types(e7).includes('news'), show(e7))
  // From a live run: "shares"/"beats" as verbs passed as financial context for AVGO via Alphabet.
  const verbs = headline("Google employee shares why workplace culture beats the company's lavish perks", 1)
  const e11 = run(q('AVGO', 3.3, 'Broadcom'), 'stock', ctx('US', { headlines: [verbs] }))
  check('trap: "shares"/"beats" used as verbs are not financial context', headlineScore(verbs, 3.3, NOW) === 0 && !types(e11).includes('related_news'), show(e11))
  // From a live run: a Wall Street story about India attached to the Nifty.
  const ws = headline("Wall Street's $10B India hospital bet stirs bill fight", 1)
  const e12 = run(q('^NSEI', 0.6, 'Nifty 50'), 'index', ctx('IN', { headlines: [ws] }))
  check('trap: a US-market term does not make an India headline Nifty news', !types(e12).includes('news'), show(e12))
  // From a live run: one company's story attached to the Nifty, Sensex and Bank Nifty.
  const one = headline('Novartis India share price jumps 10% | What lies ahead for the stock?', 1)
  const e13 = run(q('^NSEI', 0.6, 'Nifty 50'), 'index', ctx('IN', { headlines: [one] }))
  check('trap: a single-company headline is not index news', !types(e13).includes('news'), show(e13))
  // From a live run: a year-to-date slump attached to a −1.7% day; a same-session cue keeps a headline.
  const ytd = headline('Asian Paints, Kansai Nerolac, Berger Paints slump up to 27% YTD. Is it time to buy paints stocks?', 1)
  const today = headline('35% dip in one year! ITC shares rise on better Q2 results buzz', 1)
  check('trap: a long-horizon move ("27% YTD") is not evidence for today', headlineScore(ytd, -1.7, NOW) === 0 && headlineScore(today, 5.1, NOW) >= 0.3,
    `ytd ${headlineScore(ytd, -1.7, NOW)}, same-session ${headlineScore(today, 5.1, NOW)}`)

  // Listicles / recommendations are opinions, not a reason for a move.
  const lists = [
    'TCS, HCL Tech to Mphasis: IT stocks to add in portfolio ahead of Q2 results | Check target price',
    'Stocks to buy today: HCLTech, ITC among top picks for October 5',
    'Best shares for Diwali 2026: ITC, Bajaj Finance and 3 more',
    'Stocks to watch: Bajaj Finance, ITC, HCLTech in focus on Q2 updates',
    'Accenture vs. Microsoft: Which Technology Stock Is a Better Buy in 2026?',
    'Accenture And 2 Stocks That May Be Priced Below Their Estimated Value',
    'Broadcom And 2 Other Top Growth Stocks',
  ].map(t => headline(t, 1))
  const scores = lists.map(h => headlineScore(h, -3.3, NOW))
  const e14 = run(q('HCLTECH.NS', -3.3, 'HCLTech'), 'stock', ctx('IN', { headlines: [lists[0], lists[1], lists[3]] }))
  check('trap: listicles ("stocks to add/buy/watch", "top picks", "best shares for") never explain a move',
    scores.every(s => s === 0) && !types(e14).includes('news'), `scores ${scores.join(',')}; ${show(e14)}`)
  // From the per-ticker news live run: opinion/valuation, holdings filings, move recaps.
  const junk = [
    'Did You Miss Accenture Stock?',
    'Broadcom (AVGO) Could Be 46% Undervalued After Weaker Jobs Data Lifted Chip Stocks',
    'Violich Capital Management Inc. Decreases Stock Holdings in Oracle Corporation $ORCL',
    'Accenture vs. Microsoft: Which Technology Stock Is a Better Buy?',
    'Stocks making the biggest moves midday: Bajaj Finance, HCLTech, Nykaa, DMart and more',
    'Texas Instruments Inc. stock outperforms competitors on strong trading day',
    'Opening Bell: Nifty 50, Sensex Rise Over 0.5% as Global Equities Advance; Bajaj Finance, Shriram Finance, ITC Lead',
    'AI Custom Chip Stocks Roundup: Beyond Broadcom, Which Deserves More Attention Among Marvell Technology, TSMC',
    'Broadcom: Sideways for Nearly Two Months After Earnings, Is Now a Buying Opportunity?',
    'MACOM, Texas Instruments, Semtech, Amkor, and Teradyne Stocks Trade Up, What You Need To Know',
    "Broadcom's 2028 Projection Makes the Stock a Screaming Buy",
  ].map(t => headline(t, 1))
  const jScores = junk.map((h, i) => headlineScore(h, i === 0 ? -6.3 : 3.0, NOW))
  check('trap: opinion/valuation pieces, holdings filings and move recaps never explain a move', jScores.every(s => s === 0), `scores ${jScores.join(',')}`)
  const real = headline('HCLTech shares crash 3.5% as investors turn nervous over deal slowdown', 1)
  check('listicle rule keeps a real event headline', headlineScore(real, -3.3, NOW) >= 0.3, `score ${headlineScore(real, -3.3, NOW)}`)

  // Near-duplicates: the same story from two outlets counts once.
  const ndtv1 = headline('HCLTech Meltdown: Stock Crashes 3.5% As Investors Turn Nervous', 1, 'NDTV')
  const ndtv2 = headline('HCLTech shares crash 3.5% as investors turn nervous', 2, 'NDTV Profit')
  const other = headline('HCLTech wins $500 million deal from European bank', 1)
  const e15 = run(q('HCLTECH.NS', -3.3, 'HCLTech'), 'stock', ctx('IN', { headlines: [ndtv1, ndtv2] }))
  const acq1 = 'Accenture Completes Acquisition of Mjølner Informatics, Bringing Deep Software Engineering Expertise for Energy'
  const acq2 = 'Accenture Completes Mjølner Acquisition, Adding 400 Specialists in Denmark'
  const acq3 = 'Accenture Completes Acquisition of Cientra to Expand Semiconductor Design Capabilities'
  const tsla1 = 'Tesla: Shares Rise on Third-Quarter Deliveries Ahead of Consensus Estimates'
  const tsla2 = 'Tesla sales continue to soar amid lineup expansion'
  check('near-duplicate titles count once; different stories stay separate',
    sameStory(ndtv1.title, ndtv2.title) && sameStory(acq1, acq2) && !sameStory(ndtv1.title, other.title) && !sameStory(acq1, acq3) && !sameStory(tsla1, tsla2)
      && e15.drivers.filter(d => d.type === 'news').length === 1, show(e15))

  // Tone vs move: positive news on a big drop (and the reverse) is not a related headline.
  const ptUp = headline('Berenberg Raises Price Target on Accenture to $235 From $220, Keeps Buy Rating', 1)
  const ptUp2 = headline('Deutsche Bank Adjusts Price Target on Accenture to $200 From $175, Keeps Hold Rating', 1)
  const ptDown = headline('UBS cuts price target on Accenture to $180 from $210', 1)
  const lifted = headline('Accenture forecast boosts Indian IT stocks, lifts Nifty IT index', 1)
  const e16 = run(q('ACN', -6.3, 'Accenture plc'), 'stock', ctx('US', { indices: { '^GSPC': q('^GSPC', 0.0) }, headlines: [ptUp, ptUp2, lifted] }))
  const e17 = run(q('ACN', -6.3, 'Accenture plc'), 'stock', ctx('US', { indices: { '^GSPC': q('^GSPC', 0.0) }, headlines: [ptUp, ptDown] }))
  const infyCut = headline('Jefferies cuts price target on Infosys to ₹1,500 from ₹1,750', 1)
  const e18 = run(q('INFY.NS', 3.0, 'Infosys'), 'stock', ctx('IN', { headlines: [infyCut] }))
  check('trap: ACN −6.3% with "price target raised" is not a related headline (tone opposite)',
    !types(e16).includes('news') && e16.summary === 'no clear driver found', show(e16))
  check('tone: a price-target cut still counts on a drop; a cut on a rise does not',
    e17.drivers.filter(d => d.type === 'news').map(d => d.evidence).join('|') === ptDown.title && !types(e18).includes('news'), `${show(e17)} | ${show(e18)}`)

  // Questions and opinion phrasing score below the WEAK line (0.5) and never make a clear driver.
  const canQ = headline('Can Mid-Market Deals Save HCLTech From the Great AI Tech Squeeze?', 1)
  const risk = headline('Billionaire Larry Ellison risk: Oracle and Paramount debt', 1)
  const why = headline("ITC shares: Citi raises rating to 'Buy' despite headwinds, sees 17% upside; here's why", 1)
  const e19 = run(q('HCLTECH.NS', -3.3, 'HCLTech'), 'stock', ctx('IN', { headlines: [canQ] }))
  const e20 = run(q('ORCL', 3.1, 'Oracle Corporation'), 'stock', ctx('US', { indices: { '^GSPC': q('^GSPC', 0.0) }, headlines: [risk] }))
  const oq = [headlineScore(canQ, -3.3, NOW), headlineScore(risk, 3.1, NOW), headlineScore(why, 5.1, NOW)]
  check('trap: opinion questions / "risk:" / "here\'s why" score below the WEAK line (HCLTech, Oracle)',
    oq.every(s => s < 0.5 && s < 0.3) && e19.summary === 'no clear driver found' && e20.summary === 'no clear driver found',
    `scores ${oq.join(',')}; ${show(e19)} | ${show(e20)}`)
  check('opinion rule keeps a reported "Why … shares jump" headline (no question mark)',
    headlineScore(headline('Why Bajaj Finance shares jump 3% amid ₹17,500-cr capital raise plans', 1), 2.3, NOW) >= 0.5)

  // Relationship labels come from the graph, not "peers" for everything.
  const e8 = run(q('NVDA', -3.0, 'NVIDIA'), 'stock', ctx('US', { quotes: { TSM: q('TSM', -2.8, 'Taiwan Semiconductor Manufacturing'), AMD: q('AMD', -2.5, 'Advanced Micro Devices'), MSFT: q('MSFT', -1.5, 'Microsoft') } }))
  const peerLabel = e8.drivers.find(d => d.type === 'peers')?.label ?? ''
  check('labels: supplier / peer / customer from graph roles', /supplier [^;]*Taiwan/.test(peerLabel) && /peer [^;]*Advanced Micro/.test(peerLabel) && /customer [^;]*Microsoft/.test(peerLabel), peerLabel)
  const e9 = run(q('AVGO', 3.3, 'Broadcom'), 'stock', ctx('US', { headlines: [headline('Alphabet shares rise after cloud revenue beats estimates', 1)] }))
  const relLabel = e9.drivers.find(d => d.type === 'related_news')?.label ?? ''
  check('labels: related news names the role (Alphabet is a Broadcom customer)', /customer Alphabet/.test(relLabel), relLabel)
  const e10 = run(q('INFY.NS', -2.4, 'Infosys'), 'stock', ctx('IN', { quotes: { 'TCS.NS': q('TCS.NS', -2.6, 'TCS'), 'WIPRO.NS': q('WIPRO.NS', -2.2, 'Wipro'), 'HCLTECH.NS': q('HCLTECH.NS', -2.0, 'HCLTech') } }))
  const sec10 = e10.drivers.find(d => d.type === 'sector')?.evidence ?? ''
  check('labels: India sector evidence names its same-sector stocks', /same sector: /.test(sec10), sec10)
}

// ── 3. Wording rule ──────────────────────────────────────────────────────────
const texts = all.flatMap(e => [e.summary, ...e.drivers.flatMap(d => [d.label, d.evidence])])
const bad = texts.filter(t => BANNED.test(t) || /\bbecause\b|\bcaused?\b/i.test(t))
check(`wording: no "because"/"caused" in ${texts.length} summary/driver texts`, bad.length === 0, bad.join(' | '))

// ── 4. Flip / drift / previous day → recompute ───────────────────────────────
check('flip −2.0% → +0.5% needs recompute', needsRecompute({ changePct: -2.0 }, 0.5))
check('drift −2.0% → −3.6% (1.6pt) needs recompute', needsRecompute({ changePct: -2.0 }, -3.6))
check('drift −2.0% → −3.0% (1.0pt) stays current', !needsRecompute({ changePct: -2.0 }, -3.0))
check('previous day is never current', !isSameMarketDay(NOW - 24 * H, NOW, 'US'))
{
  // The UI flow: show a cached explanation only if isCurrent(); otherwise recompute.
  let recomputes = 0
  const c = ctx('US', { indices: { '^IXIC': q('^IXIC', -2.4, 'Nasdaq') } })
  const cached = explain(q('NVDA', -3.1, 'Nvidia'), 'stock', c)
  const showFor = (live: number) => {
    if (isCurrent(cached, live, NOW)) return cached
    recomputes++
    return explain(q('NVDA', live, 'Nvidia'), 'stock', ctx('US', { indices: { '^IXIC': q('^IXIC', live > 0 ? 1.0 : -2.4, 'Nasdaq') } }))
  }
  const same = showFor(-3.4), flipped = showFor(1.2), drifted = showFor(-4.9)
  check('UI flow: small change reuses, flip and drift recompute', recomputes === 2 && same === cached && flipped.snapshot.changePct === 1.2 && drifted.snapshot.changePct === -4.9,
    `recomputes=${recomputes}; flipped → ${flipped.summary}`)
}

// ── 5. Timing ────────────────────────────────────────────────────────────────
{
  const sample = ['TSMC raises forecast on Nvidia AI chip demand', 'Oil prices climb as OPEC+ extends cuts', 'Infosys shares fall after guidance cut', 'Sensex ends higher as banks gain', 'Gold hits record as dollar weakens']
  const heads = Array.from({ length: 200 }, (_, i) => headline(`${sample[i % 5]} (${i})`, (i % 30) + 1))
  const quotes = Object.fromEntries(['TCS.NS', 'INFY.NS', 'WIPRO.NS', 'HCLTECH.NS', 'TECHM.NS', 'RELIANCE.NS', 'ONGC.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'SBIN.NS'].map((s, i) => [s, q(s, (i - 5) * 0.7)]))
  const c = ctx('IN', { indices: { '^NSEI': q('^NSEI', -0.6), '^NSEBANK': q('^NSEBANK', -0.9) }, quotes, headlines: heads, commodities: { 'commodity:crude-oil': q('CL=F', 1.8, 'Crude oil') } })
  const t0 = performance.now(); let n = 0
  for (let r = 0; r < 20; r++) for (const s of Object.keys(quotes)) { explain(quotes[s], 'stock', c); n++ }
  const per = (performance.now() - t0) / n
  check(`timing: ${per.toFixed(2)} ms per explanation (200 headlines); ~${(per * 23).toFixed(0)} ms per dashboard (23 items)`, per < 25, '')
}

// ── 6. Live: today's real movers via the local app ───────────────────────────
async function live(): Promise<string[] | string> {
  const session = await signIn()
  if (typeof session === 'string') return session
  const { req } = session
  const out: string[] = []
  try {
    for (const m of ['us', 'in']) {
      const t0 = performance.now()
      const j = await (await req(`/api/why/${m}`)).json()
      const ms = performance.now() - t0
      const ex: Explanation[] = Object.values(j.data?.explanations ?? {})
      const stocks = ex.filter(e => e.kind === 'stock').sort((a, b) => Math.abs(b.snapshot.changePct) - Math.abs(a.snapshot.changePct)).slice(0, 5)
      const idx = ex.filter(e => e.kind === 'index')
      out.push(`${m.toUpperCase()} · ${ex.length} explanations · engine ${j.data?.computeMs} ms · request ${ms.toFixed(0)} ms · inputs ${JSON.stringify(j.data?.inputs)}`)
      const print = (e: Explanation) => {
        out.push(`  ${formatLine(e.id, e.snapshot.changePct, e.summary)}${e.narration ? `\n      AI (${e.narration.provider}): ${e.narration.text}` : ''}`)
        for (const d of e.drivers.slice(0, 3)) out.push(`      · ${d.type} ${d.score.toFixed(2)} — ${d.evidence.slice(0, 110)}${d.source.url ? ` [${d.source.name}]` : ''}`)
      }
      ;[...stocks, ...idx].forEach(print)
      // Optional fixed list for before/after comparisons: WHY_COMPARE_US=ACN,TSLA  WHY_COMPARE_IN=ITC.NS,…
      const fixed = (process.env[`WHY_COMPARE_${m.toUpperCase()}`] ?? '').split(',').filter(Boolean)
      if (fixed.length) {
        const r = await (await req('/api/why/recompute', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ market: m.toUpperCase(), symbols: fixed }) })).json()
        out.push(`  — comparison list (${fixed.join(', ')}) —`)
        for (const sym of fixed) { const e = r.data?.explanations?.[sym] ?? r.data?.explanations?.[`${sym}.NS`]; if (e) { print(e); ex.push(e) } else out.push(`  ${sym}: no quote`) }
      }
      const bad = ex.flatMap(e => [e.summary, ...e.drivers.map(d => d.label)]).filter(t => BANNED.test(t))
      check(`live ${m.toUpperCase()}: explanations returned, wording clean`, ex.length > 0 && bad.length === 0, bad.join(' | '))
    }
    return out
  } finally {
    if (CLEANUP) check('live: throwaway account deleted', (await cleanupAccount()) === true)
  }
}

const liveOut = await live()
// --cleanup still removes the saved account when the live check couldn't run.
if (CLEANUP && typeof liveOut === 'string') await cleanupAccount()
if (typeof liveOut === 'string') check('live check', false, `skipped: ${liveOut}`)

// ── Report ───────────────────────────────────────────────────────────────────
for (const r of rows) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.check}${r.detail ? `\n        ${r.detail}` : ''}`)
if (Array.isArray(liveOut)) console.log(`\nLive results:\n${liveOut.join('\n')}`)
const failed = rows.filter(r => !r.pass).length
console.log(`\n${rows.length - failed}/${rows.length} checks passed`)
process.exit(failed ? 1 : 0)
