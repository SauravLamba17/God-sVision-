/**
 * Market Brain checks.   npm run test:brain
 *  1. Fixtures: broad rally, broad selloff, sector rotation, commodity shock, quiet day
 *  2. Theme rules   3. Wording   4. AI prose rules   5. Staleness   6. Events / upcoming
 *  7. CPU per build   8. Live: both markets via a LOCAL server (shared throwaway
 *     account, see liveAccount.ts; `npm run test:brain -- --cleanup` deletes it).
 */
import { buildBrain, buildThemes, outletKey, rebuildReason, TOPICS, withLive } from '../lib/brain/engine.ts'
import { renderBrain, assertWording, PREDICTIVE, SECTIONS, themeMovesText } from '../lib/brain/text.ts'
import { validBrainNarration } from '../lib/brain/narration.ts'
import type { Brain } from '../lib/brain/types.ts'
import { explain, fmtPct, isMarketNews } from '../lib/evidence/engine.ts'
import { BANNED, formatLine } from '../lib/evidence/summary.ts'
import { arrow, pct, signed } from '../lib/format.ts'
import type { Explanation, Headline, LinkedEventInput, MarketContext, Market, Quote } from '../lib/evidence/types.ts'
import { allEntities, matchEntitiesInText } from '../lib/graph/index.ts'
import { scoreHeadlines } from '../lib/apis/newsSentiment.ts'
import { signIn, cleanupAccount, CLEANUP } from './liveAccount.ts'

const rows: { check: string; pass: boolean; detail: string }[] = []
const check = (name: string, pass: boolean, detail = '') => rows.push({ check: name, pass, detail })

const NOW = Date.parse('2026-10-05T15:00:00Z')      // Mon 11:00 ET, 20:30 IST
const IN_CLOSE = Date.parse('2026-10-05T10:00:00Z') // Mon 15:30 IST
const H = 3600_000

const q = (symbol: string, changePct: number, name = symbol, extra: Partial<Quote> = {}): Quote =>
  ({ symbol, name, price: 100, changePct, at: NOW, marketTime: NOW, ...extra })
let hid = 0
const headline = (title: string, hoursAgo: number, source: string, at = NOW): Headline => ({
  id: hid++, title, source, url: `https://example.com/${hid}`, publishedAt: at - hoursAgo * H,
  entities: matchEntitiesInText(title).map(m => m.entity.id), sentiment: scoreHeadlines([title])[0].sentiment,
})
const ctx = (market: Market, over: Partial<MarketContext> = {}): MarketContext => ({
  market, builtAt: NOW, indices: {}, sectorEtfs: {}, quotes: {}, commodities: {}, currencies: {},
  headlines: [], events: [], earnings: [], macro: [], globalIndices: {}, rates: {}, ...over,
})
const US_SECTORS = allEntities().filter(e => e.type === 'sector' && e.symbols?.[0]?.startsWith('XL'))
const usSectors = (move: (etf: string, i: number) => number) =>
  Object.fromEntries(US_SECTORS.map((e, i) => [e.id, { ...q(e.symbols![0], move(e.symbols![0], i), e.name), etf: e.symbols![0] }]))
const NSE = allEntities().filter(e => e.type === 'company' && e.id.endsWith('.NS'))
const explainAll = (c: MarketContext, bench: string): Record<string, Explanation> => {
  const out: Record<string, Explanation> = {}
  for (const x of Object.values(c.quotes)) out[x.symbol] = explain(x, 'stock', c)
  if (c.indices[bench]) out[bench] = explain(c.indices[bench], 'index', c)
  return out
}
const brainOf = (c: MarketContext, status: string, bench: string) => buildBrain({ ctx: c, explanations: explainAll(c, bench), status })
const ownText = (t: string) => t.replace(/“[^”]*”/g, '')
const allTexts: string[] = []
const render = (b: Brain) => { const t = renderBrain(b); allTexts.push(t.summary, ...Object.values(t.sections)); return t }

// ── 1. Fixtures ──────────────────────────────────────────────────────────────
{ // broad rally (US, session open)
  const c = ctx('US', {
    indices: { '^GSPC': q('^GSPC', 1.8, 'S&P 500'), '^IXIC': q('^IXIC', 2.2, 'Nasdaq'), '^DJI': q('^DJI', 1.4, 'Dow Jones'), '^RUT': q('^RUT', 2.0, 'Russell 2000'), '^VIX': q('^VIX', -9.0, 'CBOE Volatility Index') },
    sectorEtfs: usSectors((_, i) => (i === 3 ? -0.2 : 0.8 + i * 0.15)),
    quotes: Object.fromEntries([q('NVDA', 4.1, 'NVIDIA'), q('TSLA', 5.0, 'Tesla'), q('AAPL', 2.5, 'Apple'), q('JPM', 1.5, 'JPMorgan'), q('XOM', -0.6, 'Exxon')].map(x => [x.symbol, x])),
  })
  const b = brainOf(c, 'OPEN', '^GSPC'), t = render(b)
  check('rally: summary higher, breadth broad, VIX drop notable',
    /US stocks are higher in today's session/.test(t.summary) && b.state.breadth!.advancing === 10 && b.sectors.strongest[0].changePct > 0
      && b.crossAsset.some(x => x.symbol === '^VIX') && b.movers[0].symbol === 'TSLA', t.summary)
}
{ // broad selloff (India, after the close)
  const quotes = Object.fromEntries(NSE.map((e, i) => [e.id, q(e.id, i % 10 === 0 ? 0.6 : -1.2 - (i % 7) * 0.4, e.name, { marketTime: IN_CLOSE })]))
  const c = ctx('IN', { indices: { '^NSEI': q('^NSEI', -2.1, 'Nifty 50', { marketTime: IN_CLOSE }), '^BSESN': q('^BSESN', -2.0, 'Sensex', { marketTime: IN_CLOSE }), '^NSEBANK': q('^NSEBANK', -2.6, 'Bank Nifty', { marketTime: IN_CLOSE }) }, quotes })
  const b = brainOf(c, 'CLOSED', '^NSEI'), t = render(b)
  check('selloff: summary lower, decliners dominate, weakest sector negative',
    /Indian stocks closed lower \(session 2026-10-05\)/.test(t.summary) && b.state.breadth!.declining > 3 * b.state.breadth!.advancing && b.sectors.weakest[0].changePct < 0,
    `${t.summary} | ${t.sections.sectors}`)
}
{ // sector rotation: flat index, tech up, energy down
  const c = ctx('US', {
    indices: { '^GSPC': q('^GSPC', 0.1, 'S&P 500'), '^IXIC': q('^IXIC', 0.6, 'Nasdaq') },
    sectorEtfs: usSectors(etf => (etf === 'XLK' ? 2.1 : etf === 'XLE' ? -2.4 : 0.1)),
  })
  const b = brainOf(c, 'OPEN', '^GSPC'), t = render(b)
  check('rotation: index little changed, strongest tech, weakest energy',
    /little changed/.test(t.summary) && /Information Technology/.test(b.sectors.strongest[0].name) && /Energy/.test(b.sectors.weakest[0].name), t.sections.sectors)
}
{ // commodity shock: crude +6.5% with coverage
  const c = ctx('US', {
    indices: { '^GSPC': q('^GSPC', -0.4, 'S&P 500') },
    sectorEtfs: usSectors(etf => (etf === 'XLE' ? 3.1 : -0.5)),
    commodities: { 'commodity:crude-oil': q('CL=F', 6.5, 'Crude oil') },
    quotes: Object.fromEntries([q('XOM', 4.2, 'Exxon Mobil'), q('CVX', 3.6, 'Chevron')].map(x => [x.symbol, x])),
    headlines: [
      headline('Crude oil jumps 6% after OPEC+ announces surprise output cut', 2, 'Reuters'),
      headline('Brent crude tops $95 as Middle East supply worries grow', 3, 'CNBC'),
      headline('Oil prices: refiners scramble as crude inventories fall sharply', 1, 'Bloomberg'),
    ],
  })
  const b = brainOf(c, 'OPEN', '^GSPC'), t = render(b)
  const th = b.themes.find(x => x.id === 'commodity:crude-oil')
  check('commodity shock: crude is the top cross-asset move and a theme with linked moves',
    b.crossAsset[0]?.symbol === 'CL=F' && /Alongside: Crude oil \+6\.5%/.test(t.summary) && !!th && th.moves.some(m => m.symbol === 'CL=F') && th.headlines.every(h => !!h.source.url),
    `${t.summary} | ${t.sections.themes}`)
}
{ // quiet day
  const c = ctx('US', {
    indices: { '^GSPC': q('^GSPC', 0.05, 'S&P 500'), '^IXIC': q('^IXIC', -0.08, 'Nasdaq') },
    sectorEtfs: usSectors((_, i) => (i % 2 ? 0.1 : -0.1)),
    commodities: { 'commodity:gold': q('GC=F', 0.2, 'Gold'), 'commodity:crude-oil': q('CL=F', -0.3, 'Crude oil') },
    rates: { '^TNX': q('^TNX', 0.3, 'US 10-year yield', { change: 0.01 }) },
  })
  const b = brainOf(c, 'OPEN', '^GSPC'), t = render(b)
  check('quiet day: little changed, nothing notable, no themes, no events',
    /little changed/.test(t.summary) && /^No notable moves \(checked Gold, Crude oil, US 10-year yield\)/.test(t.sections.crossAsset)
      && /^No theme met the bar/.test(t.sections.themes) && /^No major world events/.test(t.sections.events), `${t.sections.crossAsset} | ${t.sections.themes}`)
}

// ── 2. Theme rules ───────────────────────────────────────────────────────────
{
  const base = { indices: { '^GSPC': q('^GSPC', 0.2, 'S&P 500') }, commodities: { 'commodity:crude-oil': q('CL=F', 3.0, 'Crude oil') } }
  const win = { start: NOW - 24 * H, end: NOW }
  const themesOf = (hs: Headline[], over: Partial<MarketContext> = {}) => buildThemes(ctx('US', { ...base, ...over, headlines: hs }), win)
  const single = themesOf([
    headline('Crude oil jumps 6% after OPEC+ announces surprise output cut', 1, 'Reuters'),
    headline('Crude oil jumps 6% after OPEC+ announces a surprise output cut', 1, 'CNBC'),
    headline('Crude oil jumps 6% as OPEC+ announces surprise output cut', 2, 'Bloomberg'),
    headline('OPEC+ surprise output cut: crude oil jumps 6%', 2, 'MarketWatch'),
  ])
  check('themes: one story syndicated 4 times never makes a theme', single.length === 0, JSON.stringify(single.map(t => [t.title, t.stories])))
  const oneSource = themesOf([
    headline('Crude oil jumps after OPEC+ output cut', 1, 'Reuters'),
    headline('Refiners face higher crude costs this quarter', 2, 'Reuters'),
    headline('Oil prices lift energy shares across Asia', 3, 'Reuters'),
  ])
  check('themes: 3 headlines from one source make no theme', oneSource.length === 0, JSON.stringify(oneSource.map(t => t.title)))
  const sameOutlet = themesOf([
    headline('Crude oil jumps after OPEC+ output cut', 1, 'Economic Times'),
    headline('Refiners face higher crude costs this quarter', 2, 'Economic Times Markets'),
    headline('Oil prices lift energy shares across Asia', 3, 'The Economic Times'),
  ])
  check('themes: two feeds of one outlet count as one source', sameOutlet.length === 0 && outletKey('Economic Times Markets') === outletKey('The Economic Times')
      && outletKey('NDTV Profit') === outletKey('NDTV') && outletKey('The Guardian Business') === outletKey('The Guardian Politics') && outletKey('Reuters (Google News)') === outletKey('Reuters'),
    JSON.stringify(sameOutlet.map(t => t.title)))
  // Outlet keys for the US market feeds: one publisher = one outlet; Google News = each item's real publisher.
  await import('./serverModules.ts')
  const { MARKET_FEEDS } = await import('../lib/apis/marketNews.ts')
  const cnbcFeeds = MARKET_FEEDS.filter(f => f.id.startsWith('cnbc-'))
  const keys = new Set([...cnbcFeeds.map(f => outletKey(f.outlet!)), outletKey('CNBC'), outletKey('CNBC (Google News)')])
  check('outlets: CNBC Economy / Earnings / Finance, the general CNBC feed and CNBC via Google News are one outlet',
    cnbcFeeds.length === 3 && keys.size === 1, JSON.stringify([...keys]))
  check('outlets: Google News feeds key by publisher; short and full publisher names match',
    MARKET_FEEDS.filter(f => f.query).every(f => f.outlet === null) && outletKey('Reuters (Google News)') === 'reuters' && outletKey('Google News') !== outletKey('Reuters (Google News)')
      && outletKey('WSJ (Google News)') === outletKey('The Wall Street Journal') && outletKey('AP News') === outletKey('Associated Press') && outletKey('NYT') === outletKey('The New York Times')
      && outletKey('Investing.com (Google News)') === outletKey(MARKET_FEEDS.find(f => f.id === 'investing-stocks')!.outlet!),
    [outletKey('Reuters (Google News)'), outletKey('WSJ (Google News)'), outletKey('The Wall Street Journal')].join(','))
  const cnbcOnly = themesOf([
    headline('Crude oil jumps after OPEC+ output cut', 1, 'CNBC'),
    headline('Refiners face higher crude costs this quarter', 2, 'CNBC'),
    headline('Oil prices lift energy shares across Asia', 3, 'CNBC (Google News)'),
  ])
  const wsjTwice = themesOf([
    headline('Crude oil jumps after OPEC+ output cut', 1, 'WSJ (Google News)'),
    headline('Refiners face higher crude costs this quarter', 2, 'The Wall Street Journal'),
    headline('Oil prices lift energy shares across Asia', 3, 'WSJ (Google News)'),
  ])
  const twoPublishers = themesOf([
    headline('Crude oil jumps after OPEC+ output cut', 1, 'CNBC'),
    headline('Refiners face higher crude costs this quarter', 2, 'Reuters (Google News)'),
    headline('Oil prices lift energy shares across Asia', 3, 'CNBC'),
  ])
  check('themes: three CNBC feeds (or WSJ under two names) are one source — no theme; a second real publisher makes one',
    cnbcOnly.length === 0 && wsjTwice.length === 0 && twoPublishers.length === 1 && twoPublishers[0].sources === 2,
    JSON.stringify([cnbcOnly, wsjTwice, twoPublishers].map(ts => ts.map(t => [t.title, t.sources]))))
  // Theme noise from the market feeds (live samples): opinion, roundups, captions, routine notices, quote pages.
  const feedNoise = themesOf([
    headline('ASML: What We Think of the Stock After Earnings', 1, 'Morningstar (Google News)'),
    headline("CPI ahead; more banks to report; ASML earnings - what's moving markets", 2, 'Investing.com (Google News)'),
    headline('Current price of oil as of October 14, 2026', 1, 'Fortune (Google News)'),
    headline('Oil (USCrude) Price Forecast for Today, Tomorrow, Next Week, and Next 30 Days', 2, 'LiteFinance (Google News)'),
    headline('3 U.S. Energy Stocks With Direct Exposure to Rising Oil Prices', 3, 'Yahoo Finance (Google News)'),
    headline('Commentary: The oil market that sets today’s gas prices was invented in western Pennsylvania', 3, 'Pennsylvania Capital-Star (Google News)'),
  ])
  const feedReal = themesOf([
    headline('Oil prices rise as Iran deploys new tactics to target tankers', 1, 'Reuters (Google News)'),
    headline('Brent Gains More Than 4% on U.S.-Iran Tensions, Hurricane Isaias', 2, 'WSJ (Google News)'),
    headline('Oil Prices Rise as Traders Weigh Saudi Aramco Attack Report, Hormuz Shipping Risks', 3, 'The Wall Street Journal'),
    headline('Oil prices rise after IEA warns on market constraints; Saudi officials say Aramco facilities attacked', 3, 'CNBC'),
  ])
  check('themes: market-feed noise never forms a theme; the same day\'s real oil stories do (WSJ counted once)',
    feedNoise.length === 0 && feedReal.some(t => t.id === 'commodity:crude-oil' && t.stories === 4 && t.sources === 3),
    JSON.stringify([feedNoise.map(t => t.title), feedReal.map(t => [t.title, t.stories, t.sources])]))
  check('themes: "Wall St" and "rate-hike" read as market news; a 2035 forecast and an "In Focus" round-up do not',
    isMarketNews('Wall St slides as hot CPI data fuels rate-hike bets; chips, banks weigh') && !isMarketNews('India power demand to outpace energy by 2035')
      && !isMarketNews('Indexes Drift Lower Ahead Of Inflation Report: AMD, CAKE, URBN In Focus - Video') && isMarketNews('Inflation in focus as stocks slip ahead of Fed meeting'))

  const noMove = themesOf([
    headline('Crude oil jumps after OPEC+ output cut', 1, 'Reuters'),
    headline('Refiners face higher crude costs this quarter', 2, 'CNBC'),
    headline('Oil prices lift energy shares across Asia', 3, 'Bloomberg'),
  ], { commodities: { 'commodity:crude-oil': q('CL=F', 0.2, 'Crude oil (WTI)') } })
  const noQuote = themesOf([
    headline('Crude oil jumps after OPEC+ output cut', 1, 'Reuters'),
    headline('Refiners face higher crude costs this quarter', 2, 'CNBC'),
    headline('Oil prices lift energy shares across Asia', 3, 'Bloomberg'),
  ], { commodities: {} })
  const smallText = noMove[0] ? themeMovesText(noMove[0]) : ''
  check('themes: a small move shows its real number labelled "small move", never "coincides with"; no quoted instrument → no theme',
    noMove[0]?.moves[0]?.symbol === 'CL=F' && smallText === 'related: Crude oil (WTI) +0.2% (small move)' && noQuote.length === 0,
    `${smallText} | ${JSON.stringify(noQuote.map(t => t.title))}`)

  // From the live Part A run: oil stories showed "Natural gas −2.7%". An oil theme shows crude oil, whatever its size.
  const oilStories = [
    headline('Oil prices rise as Iran deploys new tactics to target tankers', 1, 'Reuters (Google News)'),
    headline('Brent gains more than 4% on U.S.-Iran tensions', 2, 'WSJ (Google News)'),
    headline('Oil prices climb as Iran threatens more tanker attacks', 3, 'CNBC'),
  ]
  const oilWith = (crude: number) => themesOf(oilStories, { commodities: { 'commodity:crude-oil': q('CL=F', crude, 'Crude oil (WTI)'), 'commodity:natural-gas': q('NG=F', -2.6, 'Natural gas') } })
  const [small, opposite, moved] = [oilWith(0.4), oilWith(-1.8), oilWith(2.1)]
  const texts = (ts: typeof small) => ts.map(t => `${t.title}: ${themeMovesText(t)}`)
  const all3 = [small, opposite, moved].flat()
  check('themes: oil stories + natural gas −2.6% + crude +0.4% → shows crude oil +0.4% (small move), never natural gas',
    small.length >= 1 && small.every(t => t.direction === 1 && t.moves[0].symbol === 'CL=F' && themeMovesText(t) === 'related: Crude oil (WTI) +0.4% (small move)')
      && all3.every(t => !t.moves.some(m => m.symbol === 'NG=F') && !/Natural gas/.test(themeMovesText(t))), texts(small).join(' | '))
  check('themes: crude moving against the headlines is shown but not claimed; a notable move with them is "coincides with"',
    opposite.every(t => themeMovesText(t) === 'related: Crude oil (WTI) −1.8% (opposite to the headlines)')
      && moved.every(t => themeMovesText(t) === 'coincides with Crude oil (WTI) +2.1%') && moved[0]?.score > small[0]?.score,
    `${texts(opposite).join(' | ')} || ${texts(moved).join(' | ')}`)
  const energy = TOPICS.find(t => t.id === 'energy')!
  const lng = headline("India's gas demand drops as Iran war hikes LNG spot prices", 2, 'OilPrice.com')
  const iranOil = energy.instruments([...oilStories, lng], 'country:iran', ctx('US', { commodities: { 'commodity:crude-oil': q('CL=F', 0.9, 'Crude oil (WTI)'), 'commodity:natural-gas': q('NG=F', -2.9, 'Natural gas') } }), [])
  check('themes: "Iran — oil / energy" with one LNG story among oil stories shows crude oil only (live Part B sample)',
    iranOil.map(m => m.symbol).join() === 'CL=F', iranOil.map(m => `${m.name} ${m.changePct}`).join(', '))
  const gas = themesOf([
    headline('Natural gas prices jump as cold snap lifts heating demand', 1, 'Reuters'),
    headline('LNG exports hit record as natural gas output rises', 2, 'CNBC'),
    headline('Natural gas prices climb as storage falls short of estimates', 3, 'Bloomberg'),
  ], { commodities: { 'commodity:crude-oil': q('CL=F', 3.0, 'Crude oil (WTI)'), 'commodity:natural-gas': q('NG=F', 4.2, 'Natural gas') } })
  check('themes: natural gas stories show natural gas, not crude oil', gas.length >= 1 && gas.every(t => t.moves[0].symbol === 'NG=F' && !t.moves.some(m => m.symbol === 'CL=F')),
    gas.map(t => `${t.title}: ${themeMovesText(t)}`).join(' | '))
  const ok = themesOf([
    headline('Crude oil jumps after OPEC+ output cut', 1, 'Reuters'),
    headline('Refiners face higher crude costs this quarter', 2, 'CNBC'),
    headline('Oil prices lift energy shares across Asia', 3, 'Bloomberg'),
  ])
  check('themes: 3 stories, 3 outlets and a related move make a theme with linked headlines',
    ok.length >= 1 && ok[0].id === 'commodity:crude-oil' && ok[0].stories === 3 && ok[0].sources === 3 && ok[0].headlines.every(h => h.source.url), JSON.stringify(ok.map(t => [t.title, t.stories, t.sources, t.score])))
  const old = themesOf([
    headline('Crude oil jumps after OPEC+ output cut', 30, 'Reuters'),
    headline('Refiners face higher crude costs this quarter', 31, 'CNBC'),
    headline('Oil prices lift energy shares across Asia', 2, 'Bloomberg'),
  ])
  check('themes: headlines outside the session window do not count', old.length === 0)
  const tickerOnly = themesOf([
    { ...headline('Crude oil jumps after OPEC+ output cut', 1, 'Reuters (Google News)'), via: 'ticker' as const },
    { ...headline('Refiners face higher crude costs this quarter', 2, 'CNBC (Google News)'), via: 'ticker' as const },
    { ...headline('Oil prices lift energy shares across Asia', 3, 'Bloomberg (Google News)'), via: 'ticker' as const },
  ])
  check('themes: per-ticker searches (biased toward movers) never form themes', tickerOnly.length === 0)
  const offTopic = themesOf([
    headline('Exxon sponsors city marathon for the tenth year', 1, 'Reuters'),
    headline('Top 5 oil stocks to buy now', 2, 'CNBC'),
    headline('Is crude oil headed for $100?', 3, 'Bloomberg'),
  ])
  check('themes: off-topic mentions, listicles and questions do not count toward a theme', offTopic.length === 0, JSON.stringify(offTopic.map(t => t.title)))
  // India brain: US-listed companies don't group into Indian sector themes.
  const inThemes = buildThemes(ctx('IN', {
    quotes: { 'HCLTECH.NS': q('HCLTECH.NS', -3.3, 'HCLTech') },
    headlines: [
      headline('Microsoft shares rise after cloud deal with OpenAI', 1, 'Reuters'),
      headline('Apple shares slip after iPhone sales data', 2, 'CNBC'),
      headline('Nvidia shares jump on record data-center revenue', 3, 'Bloomberg'),
    ],
  }), win)
  check('themes: foreign-listed companies do not form the Indian market\'s sector themes', inThemes.length === 0, JSON.stringify(inThemes.map(t => t.title)))

  // Country themes are split by a specific topic, never titled by the country alone.
  const usNews = (hs: Headline[]) => buildThemes(ctx('IN', { globalIndices: { '^GSPC': q('^GSPC', 0.7, 'S&P 500 (last session)') }, headlines: hs }), win)
  const split = usNews([
    headline('US Fed officials signal patience on interest rate cuts', 1, 'Reuters'),
    headline('US Treasury yields climb after strong jobs report', 2, 'CNBC'),
    headline('Federal Reserve minutes show US policymakers split on rate path', 3, 'Reuters'),
    headline('US tariffs on steel imports widen trade tensions', 1, 'Bloomberg'),
    headline('US and EU resume trade talks over tariffs', 2, 'AP News'),
    headline('US export curbs on chips hit trade flows', 3, 'Bloomberg'),
  ])
  const titles = split.map(t => t.title)
  check('themes: a country splits into specific topics ("United States — Fed / rates", "— tariffs / trade")',
    titles.includes('United States — Fed / rates') && titles.includes('United States — tariffs / trade') && !titles.includes('United States')
      && split.every(t => t.stories >= 3 && t.sources >= 2), JSON.stringify(split.map(t => [t.title, t.stories, t.sources])))
  const vague = usNews([
    headline('US Fed officials signal patience on interest rate cuts', 1, 'Reuters'),
    headline('US tariffs on steel imports widen trade tensions', 2, 'Bloomberg'),
    headline('US tech giants rally as AI spending jumps', 3, 'CNBC'),
  ])
  check('themes: 3 US stories on 3 different topics make no theme (no vague "United States")', vague.length === 0, JSON.stringify(vague.map(t => t.title)))
  const oneOutletTopic = usNews([
    headline('US Fed officials signal patience on interest rate cuts', 1, 'Economic Times Markets'),
    headline('US Treasury yields climb after strong jobs report', 2, 'Economic Times'),
    headline('Federal Reserve minutes show US policymakers split on rate path', 3, 'The Economic Times'),
  ])
  check('themes: a country topic from one outlet is dropped', oneOutletTopic.length === 0, JSON.stringify(oneOutletTopic.map(t => t.title)))
}

// ── 2b. Percent formatting: anything that rounds to zero is "0.0%" ───────────
{
  const cases: [string, string][] = [
    [pct(-0.04), '0.0%'], [pct(0.04), '0.0%'], [pct(0), '0.0%'], [pct(-0), '0.0%'], [pct(-0.004, 2), '0.00%'],
    [pct(1.23), '+1.2%'], [pct(-1.26, 1, '−'), '−1.3%'], [signed(-0.0001, 3), '0.000'], [arrow(0.001), ''], [arrow(-0.5), '▼'],
    [fmtPct(-0.03), '0.0%'], [fmtPct(0.02), '0.0%'], [formatLine('XLV', -0.02, 'x'), 'XLV 0.0% · x'],
  ]
  const bad = cases.filter(([got, want]) => got !== want)
  const c = ctx('US', { indices: { '^GSPC': q('^GSPC', -0.03, 'S&P 500') }, sectorEtfs: usSectors((_, i) => (i === 0 ? -0.03 : i === 1 ? 0.02 : 0.4)) })
  const t = renderBrain(brainOf(c, 'OPEN', '^GSPC'))
  const all = [t.summary, ...Object.values(t.sections)].join(' ')
  check('format: values that round to zero show "0.0%", never "+0.0%" / "−0.0%"',
    bad.length === 0 && /S&P 500 0\.0%/.test(all) && !/[+−-]0\.0%/.test(all), JSON.stringify(bad) + ' | ' + t.sections.state)
}

// ── 3. Wording ───────────────────────────────────────────────────────────────
{
  const bad = allTexts.filter(t => BANNED.test(ownText(t)) || PREDICTIVE.test(ownText(t)))
  let throwsCause = false, throwsPredict = false, quotedOk = true
  try { assertWording('Stocks rose because of the Fed') } catch { throwsCause = true }
  try { assertWording('Stocks will rise tomorrow') } catch { throwsPredict = true }
  try { assertWording('Next: “BOJ Outlook Report” (high impact)') } catch { quotedOk = false }
  check(`wording: no cause/prediction/advice words in ${allTexts.length} brain texts; guard throws`, bad.length === 0 && throwsCause && throwsPredict && quotedOk, bad.join(' | '))
}

// ── 4. AI prose rules ────────────────────────────────────────────────────────
{
  const c = ctx('US', {
    indices: { '^GSPC': q('^GSPC', 0.7, 'S&P 500'), '^IXIC': q('^IXIC', 1.2, 'Nasdaq') },
    sectorEtfs: usSectors((_, i) => (i < 9 ? 0.5 + i * 0.1 : -0.3)),
    commodities: { 'commodity:crude-oil': q('CL=F', -1.6, 'Crude oil') },
  })
  const b = brainOf(c, 'OPEN', '^GSPC'), t = renderBrain(b)
  const good = 'US stocks are higher in today\'s session, with the S&P 500 and Nasdaq both up and most sector funds advancing. Crude oil moved lower alongside the rally.'
  const verdicts = {
    good: validBrainNarration(good, b, t),
    cause: validBrainNarration('US stocks rose because crude oil fell, with the S&P 500 and Nasdaq up across most sectors today.', b, t),
    number: validBrainNarration('US stocks rose, with the S&P 500 up 0.7% and the Nasdaq higher across most sector funds today.', b, t),
    predict: validBrainNarration('US stocks are higher and the S&P 500 will likely extend gains as most sector funds advance today.', b, t),
    newEntity: validBrainNarration('US stocks are higher in today\'s session, with Tesla and the S&P 500 up and most sector funds advancing.', b, t),
  }
  check('AI prose: accepts evidence-only prose; rejects causes, numbers, predictions and new entities',
    verdicts.good && !verdicts.cause && !verdicts.number && !verdicts.predict && !verdicts.newEntity, JSON.stringify(verdicts))
}

// ── 5. Staleness ─────────────────────────────────────────────────────────────
{
  const c = ctx('US', { indices: { '^GSPC': q('^GSPC', 1.8, 'S&P 500'), '^IXIC': q('^IXIC', 2.2, 'Nasdaq') }, sectorEtfs: usSectors(() => 1) })
  const b = brainOf(c, 'OPEN', '^GSPC')
  const small = rebuildReason(b, { '^GSPC': 1.9, '^IXIC': 2.0 }, NOW + H)
  const flip = rebuildReason(b, { '^GSPC': -0.4, '^IXIC': 2.0 }, NOW + H)
  const drift = rebuildReason(b, { '^GSPC': 3.4, '^IXIC': 2.2 }, NOW + H)
  const nextDay = rebuildReason(b, { '^GSPC': 1.8, '^IXIC': 2.2 }, NOW + 20 * H)
  check('staleness: small change reuses; flip, >1.5pt drift and a new day rebuild', small === null && !!flip && !!drift && nextDay === 'built on a previous day', JSON.stringify({ small, flip, drift, nextDay }))
  const shown = renderBrain(withLive(b, { '^GSPC': { changePct: 2.6, at: NOW + H } }))
  check('live numbers: rendered text uses the live % (not the snapshot)', /S&P 500 \+2\.6%/.test(shown.summary) && !/S&P 500 \+1\.8%/.test(shown.summary), shown.summary)
}

// ── 6. Events and upcoming ───────────────────────────────────────────────────
{
  const ev = (title: string, hoursAgo: number, magnitude: number, countries: string[]): LinkedEventInput => ({ kind: 'earthquake', title, at: NOW - hoursAgo * H, magnitude, countries, url: 'https://earthquake.usgs.gov/x' })
  const c = ctx('US', {
    indices: { '^GSPC': q('^GSPC', -0.6, 'S&P 500') },
    events: [ev('M 7.2 - 30 km E of Hualien, Taiwan', 5, 7.2, ['country:taiwan']), ev('M 6.8 - old quake', 60, 6.8, ['country:japan']), ev('M 5.1 - small quake', 2, 5.1, ['country:taiwan'])],
    macro: [
      { title: 'CPI m/m', currency: 'USD', date: '2026-10-07', time: '08:30', impact: 'high' },
      { title: 'Retail Sales', currency: 'USD', date: '2026-10-02', time: '08:30', impact: 'high' },
      { title: 'Crude Oil Inventories', currency: 'USD', date: '2026-10-06', time: '10:30', impact: 'low' },
    ],
    earnings: [{ symbol: 'JPM', date: '2026-10-07', timing: 'BMO' }, { symbol: 'ZZZZ', date: '2026-10-06', timing: 'AMC' }],
  })
  const b = brainOf(c, 'OPEN', '^GSPC'), t = render(b)
  const tw = b.events[0]
  check('events: recent M7.2 Taiwan quake touches TSMC and its customers; old and small quakes excluded',
    b.events.length === 1 && tw.score === 0.55 && tw.touches.some(x => x.id === 'TSM') && tw.touches.some(x => /customer of/.test(x.via)), t.sections.events)
  check('upcoming: future high/medium macro and followed companies\' earnings only',
    b.upcoming.map(u => u.title).join('|') === 'CPI m/m (USD)|JPMorgan Chase earnings' && /before open/.test(t.sections.upcoming), t.sections.upcoming)
}

// ── 7. CPU per build ─────────────────────────────────────────────────────────
{
  const quotes = Object.fromEntries(NSE.map((e, i) => [e.id, q(e.id, ((i * 37) % 90) / 10 - 4.5, e.name, { marketTime: IN_CLOSE })]))
  const titles = ['Crude oil jumps after OPEC+ output cut', 'Bank stocks rally as RBI holds rates', 'IT stocks fall as rupee firms', 'Reliance shares rise on retail growth', 'Infosys wins large deal', 'Gold prices hit record high']
  const hs = Array.from({ length: 300 }, (_, i) => headline(`${titles[i % titles.length]} — report ${i}`, 6 + (i % 10), ['Reuters', 'Livemint', 'NDTV Profit', 'Economic Times'][i % 4], NOW))
  const c = ctx('IN', { indices: { '^NSEI': q('^NSEI', -0.8, 'Nifty 50', { marketTime: IN_CLOSE }) }, quotes, headlines: hs, commodities: { 'commodity:crude-oil': q('CL=F', 2.4, 'Crude oil'), 'commodity:gold': q('GC=F', 1.2, 'Gold') } })
  const ex = explainAll(c, '^NSEI')
  const n = 20, t0 = performance.now()
  for (let i = 0; i < n; i++) renderBrain(buildBrain({ ctx: c, explanations: ex, status: 'CLOSED' }))
  const per = (performance.now() - t0) / n
  check(`CPU: ${per.toFixed(1)} ms per brain build + render (50 stocks, 300 headlines)`, per < 200)
}

// ── 8. Live ──────────────────────────────────────────────────────────────────
const live: string[] = []
{
  const session = await signIn()
  if (typeof session === 'string') check('live check', false, `skipped: ${session}`)
  else {
    try {
      for (const m of ['us', 'in']) {
        const t0 = performance.now()
        const j = await (await session.req(`/api/brain/${m}`)).json()
        const ms = performance.now() - t0
        const d = j.data
        const t0b = performance.now()
        const again = (await (await session.req(`/api/brain/${m}`)).json()).data
        const msCached = performance.now() - t0b
        const texts: string[] = d ? [d.text.summary, ...SECTIONS.map(s => d.text.sections[s])] : []
        const bad = texts.filter(t => BANNED.test(ownText(t)) || PREDICTIVE.test(ownText(t)))
        check(`live ${m.toUpperCase()}: brain returned, all sections present, wording clean`, !!d && texts.every(Boolean) && bad.length === 0, j.error ?? bad.join(' | '))
        check(`live ${m.toUpperCase()}: second request served from cache (no rebuild)`, !!again && again.generatedAt === d?.generatedAt && again.rebuilt === null, `rebuilt=${again?.rebuilt}`)
        if (!d) continue
        live.push(`${m.toUpperCase()} · build ${d.buildMs} ms (engine only) · first request ${ms.toFixed(0)} ms · cached request ${msCached.toFixed(0)} ms · generated ${new Date(d.generatedAt).toISOString()} · AI shown: ${d.showNarration}`)
        live.push(`  SUMMARY  ${d.text.summary}`)
        for (const s of SECTIONS) live.push(`  ${s.toUpperCase().padEnd(10)} ${d.text.sections[s]}`)
        for (const th of d.brain.themes) {
          live.push(`  THEME ${th.title} [${th.kind}] score ${th.score} · ${th.stories} stories · ${th.sources} sources · tone +${th.tone.positive}/−${th.tone.negative}`)
          for (const h of th.headlines.slice(0, 4)) live.push(`      - ${h.title.slice(0, 100)} [${h.source.name}]`)
        }
      }
    } finally {
      if (CLEANUP) check('live: throwaway account deleted', (await cleanupAccount()) === true)
    }
  }
  if (CLEANUP && typeof session === 'string') await cleanupAccount()
}

// ── Report ───────────────────────────────────────────────────────────────────
for (const r of rows) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.check}${r.detail ? `\n        ${r.detail}` : ''}`)
if (live.length) console.log(`\nLive results:\n${live.join('\n')}`)
const failed = rows.filter(r => !r.pass).length
console.log(`\n${rows.length - failed}/${rows.length} checks passed`)
process.exit(failed ? 1 : 0)
