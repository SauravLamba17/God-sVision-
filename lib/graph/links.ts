import type { Entity, Link, LinkType } from './types.ts'
import { ENTITIES, NIFTY50_IDS } from './entities.ts'

// Only well-known, verifiable relationships. When unsure, leave it out.
// Index memberships change periodically — they're reviewed as of GRAPH_META.lastReviewed.

const l = (from: string, type: LinkType, to: string, reason: string): Link => ({ from, to, type, reason })
const each = (ids: string[], type: LinkType, to: string, reason: string) => ids.map(id => l(id, type, to, reason))

// ── Index constituents ───────────────────────────────────────────────────────
const SP500 = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AVGO', 'AMD', 'PLTR', 'JPM', 'V', 'UNH', 'JNJ', 'LLY', 'XOM', 'WMT']
const NASDAQ_LISTED = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AVGO', 'AMD', 'PLTR', 'ASML']
const DOW30 = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'JPM', 'V', 'UNH', 'JNJ', 'WMT']
const BANK_NIFTY = ['HDFCBANK.NS', 'ICICIBANK.NS', 'SBIN.NS', 'KOTAKBANK.NS', 'AXISBANK.NS', 'INDUSINDBK.NS']
// Long-standing Sensex members only (the full 30 rotates).
const SENSEX_CORE = ['RELIANCE.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'INFY.NS', 'TCS.NS', 'BHARTIARTL.NS', 'ITC.NS', 'LT.NS', 'SBIN.NS', 'KOTAKBANK.NS', 'AXISBANK.NS', 'HINDUNILVR.NS', 'M&M.NS']

const MEMBER = 'Index member as of the last review (memberships change at rebalances)'
const CONSTITUENTS: Link[] = [
  ...each(SP500, 'constituent_of', 'index:sp500', MEMBER),
  ...each(NASDAQ_LISTED, 'constituent_of', 'index:nasdaq', 'Listed on Nasdaq, so included in the Nasdaq Composite'),
  ...each(NASDAQ_LISTED, 'constituent_of', 'index:nasdaq100', MEMBER),
  ...each(DOW30, 'constituent_of', 'index:dow', MEMBER),
  ...each(NIFTY50_IDS, 'constituent_of', 'index:nifty50', 'Nifty 50 member (matches the list this app tracks)'),
  ...each(BANK_NIFTY, 'constituent_of', 'index:banknifty', MEMBER),
  ...each(SENSEX_CORE, 'constituent_of', 'index:sensex', MEMBER),
]

// ── Supply chain ─────────────────────────────────────────────────────────────
const SUPPLY: Link[] = [
  l('TSM', 'supplier_of', 'NVDA', "TSMC manufactures Nvidia's GPUs"),
  l('TSM', 'supplier_of', 'AAPL', "TSMC manufactures Apple's A- and M-series chips"),
  l('TSM', 'supplier_of', 'AMD', "TSMC manufactures AMD's CPUs and GPUs"),
  l('TSM', 'supplier_of', 'AVGO', "TSMC fabricates Broadcom's chips"),
  l('ASML', 'supplier_of', 'TSM', "ASML supplies TSMC's chipmaking lithography machines, including EUV"),
  l('NVDA', 'supplier_of', 'MSFT', "Nvidia data-center GPUs power Microsoft's Azure AI infrastructure"),
  l('NVDA', 'supplier_of', 'META', "Nvidia data-center GPUs power Meta's AI infrastructure"),
  l('NVDA', 'supplier_of', 'AMZN', "Nvidia data-center GPUs power Amazon's AWS AI infrastructure"),
  l('NVDA', 'supplier_of', 'GOOGL', "Nvidia data-center GPUs are offered in Google Cloud"),
  l('AMD', 'supplier_of', 'MSFT', 'AMD Instinct data-center GPUs are deployed in Microsoft Azure'),
  l('AMD', 'supplier_of', 'META', "AMD Instinct data-center GPUs are deployed in Meta's AI infrastructure"),
  l('AVGO', 'supplier_of', 'AAPL', 'Broadcom supplies wireless and RF components for iPhones'),
  l('AVGO', 'supplier_of', 'GOOGL', "Broadcom co-designs Google's TPU AI chips"),
  l('COALINDIA.NS', 'supplier_of', 'NTPC.NS', "Coal India is the main supplier of coal for NTPC's power plants"),
]

// ── Competitors (symmetric) ──────────────────────────────────────────────────
const COMPETITION: Link[] = [
  l('AMD', 'competitor_of', 'NVDA', 'Rival GPU and AI-accelerator makers'),
  l('MSFT', 'competitor_of', 'AMZN', 'Azure and AWS compete in cloud computing'),
  l('MSFT', 'competitor_of', 'GOOGL', 'Compete in cloud computing, search and productivity software'),
  l('AMZN', 'competitor_of', 'GOOGL', 'AWS and Google Cloud compete in cloud computing'),
  l('GOOGL', 'competitor_of', 'META', 'Compete for digital advertising spend'),
  l('AAPL', 'competitor_of', 'GOOGL', 'iOS and Android compete as smartphone platforms'),
  l('AMZN', 'competitor_of', 'WMT', 'Compete in US retail and e-commerce'),
  l('TCS.NS', 'competitor_of', 'INFY.NS', 'Rival Indian IT services majors'),
  l('INFY.NS', 'competitor_of', 'WIPRO.NS', 'Rival Indian IT services majors'),
  l('HCLTECH.NS', 'competitor_of', 'TCS.NS', 'Rival Indian IT services majors'),
  l('TECHM.NS', 'competitor_of', 'HCLTECH.NS', 'Rival Indian IT services majors'),
  l('HDFCBANK.NS', 'competitor_of', 'ICICIBANK.NS', "India's largest private-sector banks"),
  l('ICICIBANK.NS', 'competitor_of', 'AXISBANK.NS', 'Large Indian private-sector banks'),
  l('KOTAKBANK.NS', 'competitor_of', 'AXISBANK.NS', 'Large Indian private-sector banks'),
  l('SBIN.NS', 'competitor_of', 'HDFCBANK.NS', "India's two largest banks by assets"),
  l('BHARTIARTL.NS', 'competitor_of', 'RELIANCE.NS', "Airtel and Reliance's Jio are India's two largest mobile operators"),
  l('MARUTI.NS', 'competitor_of', 'TMPV.NS', 'Rival Indian passenger-car makers'),
  l('MARUTI.NS', 'competitor_of', 'M&M.NS', 'Rival Indian passenger-vehicle makers'),
  l('TMPV.NS', 'competitor_of', 'M&M.NS', 'Rival Indian passenger-vehicle makers'),
  l('HEROMOTOCO.NS', 'competitor_of', 'BAJAJ-AUTO.NS', 'Rival Indian two-wheeler makers'),
  l('TATASTEEL.NS', 'competitor_of', 'JSWSTEEL.NS', "Two of India's largest steelmakers"),
  l('ULTRACEMCO.NS', 'competitor_of', 'SHREECEM.NS', 'Large Indian cement makers'),
  l('HINDUNILVR.NS', 'competitor_of', 'ITC.NS', 'Rival Indian FMCG companies'),
  l('BRITANNIA.NS', 'competitor_of', 'ITC.NS', "Britannia and ITC's Sunfeast compete in biscuits"),
  l('ASIANPAINT.NS', 'competitor_of', 'GRASIM.NS', "Grasim's Birla Opus competes with Asian Paints in decorative paints"),
  l('SUNPHARMA.NS', 'competitor_of', 'DRREDDY.NS', 'Rival Indian generic-drug makers'),
  l('DRREDDY.NS', 'competitor_of', 'CIPLA.NS', 'Rival Indian generic-drug makers'),
  l('SBILIFE.NS', 'competitor_of', 'HDFCLIFE.NS', 'Large Indian private life insurers'),
]

// ── Exposures ────────────────────────────────────────────────────────────────
const USD_IT = 'Most revenue is billed in US dollars, so a weaker rupee lifts rupee earnings'
const US_IT = 'North America is its largest market'
const EXPOSURE: Link[] = [
  l('XOM', 'exposed_to', 'commodity:crude-oil', 'Earnings track oil prices as a major oil producer'),
  l('XOM', 'exposed_to', 'commodity:natural-gas', 'Major natural-gas producer'),
  l('AAPL', 'exposed_to', 'country:china', 'China is a major market and its main manufacturing base'),
  l('TSLA', 'exposed_to', 'country:china', 'Builds cars at its Shanghai factory and sells heavily in China'),
  l('NVDA', 'exposed_to', 'country:china', 'US export controls on advanced AI chips limit its China sales'),
  l('RELIANCE.NS', 'exposed_to', 'commodity:crude-oil', 'Large oil refiner; crude prices drive refining margins'),
  l('ONGC.NS', 'exposed_to', 'commodity:crude-oil', "India's largest crude oil producer"),
  l('ONGC.NS', 'exposed_to', 'commodity:natural-gas', "India's largest natural-gas producer"),
  l('BPCL.NS', 'exposed_to', 'commodity:crude-oil', 'Oil refiner and fuel retailer; crude is its main input cost'),
  l('ASIANPAINT.NS', 'exposed_to', 'commodity:crude-oil', 'Crude-oil derivatives are a major raw-material cost'),
  l('TITAN.NS', 'exposed_to', 'commodity:gold', 'Jewellery (Tanishq) is its largest business'),
  l('HINDALCO.NS', 'exposed_to', 'commodity:copper', 'Runs one of India\'s largest copper businesses'),
  ...['TCS.NS', 'INFY.NS', 'WIPRO.NS', 'HCLTECH.NS', 'TECHM.NS'].flatMap(id => [
    l(id, 'exposed_to', 'currency:usd', USD_IT),
    l(id, 'exposed_to', 'country:us', US_IT),
  ]),
  l('SUNPHARMA.NS', 'exposed_to', 'country:us', 'The US is one of its largest markets'),
  l('DRREDDY.NS', 'exposed_to', 'country:us', 'North American generics are its largest business'),
  l('CIPLA.NS', 'exposed_to', 'country:us', 'Sells a large share of its generics in the US'),
  l('DIVISLAB.NS', 'exposed_to', 'currency:usd', 'Most revenue comes from exports'),
]

// ── Ownership ────────────────────────────────────────────────────────────────
const OWNERSHIP: Link[] = [
  l('ULTRACEMCO.NS', 'subsidiary_of', 'GRASIM.NS', 'Grasim holds a majority stake in UltraTech Cement'),
  l('BAJFINANCE.NS', 'subsidiary_of', 'BAJAJFINSV.NS', 'Bajaj Finserv holds a majority stake in Bajaj Finance'),
  l('SBILIFE.NS', 'subsidiary_of', 'SBIN.NS', 'State Bank of India holds a majority stake in SBI Life'),
  l('HDFCLIFE.NS', 'subsidiary_of', 'HDFCBANK.NS', 'HDFC Bank holds a majority stake in HDFC Life'),
]

// ── Countries, currencies, regions, commodities ──────────────────────────────
const GEOGRAPHY: Link[] = [
  l('currency:usd', 'currency_of', 'country:us', 'Currency of the United States'),
  l('currency:inr', 'currency_of', 'country:india', 'Currency of India'),
  l('currency:jpy', 'currency_of', 'country:japan', 'Currency of Japan'),
  l('currency:gbp', 'currency_of', 'country:uk', 'Currency of the United Kingdom'),
  l('currency:chf', 'currency_of', 'country:switzerland', 'Currency of Switzerland'),
  l('currency:aud', 'currency_of', 'country:australia', 'Currency of Australia'),
  l('currency:cad', 'currency_of', 'country:canada', 'Currency of Canada'),
  l('currency:nzd', 'currency_of', 'country:new-zealand', 'Currency of New Zealand'),
  l('currency:cny', 'currency_of', 'country:china', 'Currency of China'),
  l('currency:eur', 'currency_of', 'region:eurozone', 'Currency of the eurozone'),
  ...each(['country:us', 'country:canada', 'country:mexico'], 'part_of', 'region:north-america', 'North American country'),
  ...each(['country:uk', 'country:germany', 'country:france', 'country:netherlands', 'country:switzerland', 'country:ukraine'], 'part_of', 'region:europe', 'European country'),
  ...each(['country:germany', 'country:france', 'country:netherlands'], 'part_of', 'region:eurozone', 'Uses the euro'),
  ...each(['country:japan', 'country:china', 'country:hong-kong', 'country:taiwan', 'country:south-korea', 'country:australia', 'country:new-zealand'], 'part_of', 'region:asia-pacific', 'Asia-Pacific economy'),
  l('country:india', 'part_of', 'region:south-asia', 'South Asian country'),
  ...each(['country:saudi-arabia', 'country:iran', 'country:israel'], 'part_of', 'region:middle-east', 'Middle Eastern country'),
  ...each(['country:brazil', 'country:chile', 'country:mexico'], 'part_of', 'region:latin-america', 'Latin American country'),
  l('country:us', 'major_producer_of', 'commodity:crude-oil', "World's largest crude oil producer"),
  l('country:us', 'major_producer_of', 'commodity:natural-gas', "World's largest natural-gas producer"),
  l('country:saudi-arabia', 'major_producer_of', 'commodity:crude-oil', "One of the world's largest oil exporters; leads OPEC"),
  l('country:russia', 'major_producer_of', 'commodity:crude-oil', "One of the world's largest oil producers"),
  l('country:russia', 'major_producer_of', 'commodity:natural-gas', "One of the world's largest natural-gas producers"),
  l('country:iran', 'major_producer_of', 'commodity:crude-oil', 'Major OPEC oil producer'),
  l('country:chile', 'major_producer_of', 'commodity:copper', "World's largest copper producer"),
  l('country:china', 'major_producer_of', 'commodity:gold', "World's largest gold-mining country"),
  l('country:mexico', 'major_producer_of', 'commodity:silver', "World's largest silver producer"),
]

const BENCHMARKS: [string, string][] = [
  ['index:sp500', 'country:us'], ['index:nasdaq', 'country:us'], ['index:nasdaq100', 'country:us'], ['index:dow', 'country:us'],
  ['index:russell2000', 'country:us'], ['index:vix', 'country:us'],
  ['index:nifty50', 'country:india'], ['index:banknifty', 'country:india'], ['index:sensex', 'country:india'], ['index:indiavix', 'country:india'],
  ['index:nikkei225', 'country:japan'], ['index:shanghai', 'country:china'], ['index:hangseng', 'country:hong-kong'],
  ['index:asx200', 'country:australia'], ['index:ftse100', 'country:uk'], ['index:dax', 'country:germany'], ['index:cac40', 'country:france'],
  ['index:eurostoxx50', 'region:eurozone'], ['index:tsx', 'country:canada'], ['index:bovespa', 'country:brazil'],
]

// ── Generated from entity fields: sector and headquarters for every company ──
const byId = new Map(ENTITIES.map(e => [e.id, e]))
const companies = ENTITIES.filter((e): e is Entity & { sector: string; country: string } => e.type === 'company' && !!e.sector && !!e.country)
const STRUCTURE: Link[] = companies.flatMap(c => [
  l(c.id, 'in_sector', c.sector, c.industry ? `Industry: ${c.industry}` : 'GICS sector classification'),
  l(c.id, 'headquartered_in', c.country, `Headquartered in ${byId.get(c.country)?.name ?? c.country}`),
])

export const LINKS: Link[] = [
  ...STRUCTURE, ...CONSTITUENTS, ...SUPPLY, ...COMPETITION, ...EXPOSURE, ...OWNERSHIP, ...GEOGRAPHY,
  ...BENCHMARKS.map(([from, to]) => l(from, 'benchmark_of', to, `Benchmark index for ${byId.get(to)?.name ?? to}`)),
]
