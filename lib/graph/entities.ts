import type { Entity } from './types.ts'

// ── Sectors (GICS level 1; the US sector ETFs the app shows map 1:1) ────────
const SECTORS: Entity[] = [
  { id: 'sector:information-technology', type: 'sector', name: 'Information Technology', symbols: ['XLK'], aliases: ['tech stocks', 'technology stocks', 'IT stocks'] },
  { id: 'sector:financials', type: 'sector', name: 'Financials', symbols: ['XLF'], aliases: ['bank stocks', 'banking stocks', 'financial stocks'] },
  { id: 'sector:energy', type: 'sector', name: 'Energy', symbols: ['XLE'], aliases: ['energy stocks', 'oil stocks'] },
  { id: 'sector:health-care', type: 'sector', name: 'Health Care', symbols: ['XLV'], aliases: ['healthcare stocks', 'pharma stocks', 'pharmaceutical stocks'] },
  { id: 'sector:industrials', type: 'sector', name: 'Industrials', symbols: ['XLI'], aliases: ['industrial stocks'] },
  { id: 'sector:consumer-discretionary', type: 'sector', name: 'Consumer Discretionary', symbols: ['XLY'], aliases: ['auto stocks', 'retail stocks'] },
  { id: 'sector:consumer-staples', type: 'sector', name: 'Consumer Staples', symbols: ['XLP'], aliases: ['FMCG stocks', 'consumer staples'] },
  { id: 'sector:utilities', type: 'sector', name: 'Utilities', symbols: ['XLU'], aliases: ['utility stocks', 'power stocks'] },
  { id: 'sector:real-estate', type: 'sector', name: 'Real Estate', symbols: ['XLRE'], aliases: ['real estate stocks', 'realty stocks'] },
  { id: 'sector:materials', type: 'sector', name: 'Materials', symbols: ['XLB'], aliases: ['metal stocks', 'cement stocks', 'steel stocks'] },
  { id: 'sector:communication-services', type: 'sector', name: 'Communication Services', symbols: ['XLC'], aliases: ['telecom stocks', 'media stocks'] },
]

// ── Regions ──────────────────────────────────────────────────────────────────
const REGIONS: Entity[] = [
  { id: 'region:north-america', type: 'region', name: 'North America', aliases: ['North America', 'North American'] },
  { id: 'region:europe', type: 'region', name: 'Europe', aliases: ['Europe', 'European'] },
  { id: 'region:eurozone', type: 'region', name: 'Eurozone', aliases: ['eurozone', 'euro zone', 'euro area', 'euro-area'] },
  { id: 'region:asia-pacific', type: 'region', name: 'Asia-Pacific', aliases: ['Asia-Pacific', 'Asia Pacific', 'Asian markets', 'Asia'] },
  { id: 'region:south-asia', type: 'region', name: 'South Asia', aliases: ['South Asia', 'South Asian'] },
  { id: 'region:middle-east', type: 'region', name: 'Middle East', aliases: ['Middle East', 'Gulf states', 'Persian Gulf'] },
  { id: 'region:latin-america', type: 'region', name: 'Latin America', aliases: ['Latin America', 'Latin American'] },
]

// ── Countries (the ones the app's dashboards, FX pairs, indices and news use) ─
const COUNTRIES: Entity[] = [
  { id: 'country:us', type: 'country', name: 'United States', aliases: ['United States', 'U.S.', 'US', 'USA', 'American economy', 'Wall Street'], caseSensitive: ['US', 'USA'] },
  { id: 'country:india', type: 'country', name: 'India', aliases: ['India', 'Indian', 'New Delhi'] },
  { id: 'country:china', type: 'country', name: 'China', aliases: ['China', 'Chinese', 'Beijing'] },
  { id: 'country:japan', type: 'country', name: 'Japan', aliases: ['Japan', 'Japanese'] },
  { id: 'country:uk', type: 'country', name: 'United Kingdom', aliases: ['United Kingdom', 'UK', 'U.K.', 'Britain', 'British'], caseSensitive: ['UK'] },
  { id: 'country:germany', type: 'country', name: 'Germany', aliases: ['Germany', 'German'] },
  { id: 'country:france', type: 'country', name: 'France', aliases: ['France', 'French'] },
  { id: 'country:netherlands', type: 'country', name: 'Netherlands', aliases: ['Netherlands', 'Dutch'] },
  { id: 'country:switzerland', type: 'country', name: 'Switzerland', aliases: ['Switzerland', 'Swiss'] },
  { id: 'country:taiwan', type: 'country', name: 'Taiwan', aliases: ['Taiwan', 'Taiwanese'] },
  { id: 'country:south-korea', type: 'country', name: 'South Korea', aliases: ['South Korea', 'South Korean', 'Seoul'] },
  { id: 'country:hong-kong', type: 'country', name: 'Hong Kong', aliases: ['Hong Kong'], notFollowedBy: ['dollar'] },
  { id: 'country:australia', type: 'country', name: 'Australia', aliases: ['Australia', 'Australian'], notFollowedBy: ['dollar'] },
  { id: 'country:new-zealand', type: 'country', name: 'New Zealand', aliases: ['New Zealand'], notFollowedBy: ['dollar'] },
  { id: 'country:canada', type: 'country', name: 'Canada', aliases: ['Canada', 'Canadian'], notFollowedBy: ['dollar'] },
  { id: 'country:brazil', type: 'country', name: 'Brazil', aliases: ['Brazil', 'Brazilian'] },
  { id: 'country:mexico', type: 'country', name: 'Mexico', aliases: ['Mexico', 'Mexican'] },
  { id: 'country:chile', type: 'country', name: 'Chile', aliases: ['Chile', 'Chilean'] },
  { id: 'country:saudi-arabia', type: 'country', name: 'Saudi Arabia', aliases: ['Saudi Arabia', 'Saudi', 'Riyadh'] },
  { id: 'country:russia', type: 'country', name: 'Russia', aliases: ['Russia', 'Russian', 'Kremlin'] },
  { id: 'country:ukraine', type: 'country', name: 'Ukraine', aliases: ['Ukraine', 'Ukrainian', 'Kyiv'] },
  { id: 'country:iran', type: 'country', name: 'Iran', aliases: ['Iran', 'Iranian', 'Tehran'] },
  { id: 'country:israel', type: 'country', name: 'Israel', aliases: ['Israel', 'Israeli'] },
]

// ── Commodities (the app's commodity strip: GC, SI, CL, BZ, NG, HG futures) ──
const COMMODITIES: Entity[] = [
  { id: 'commodity:gold', type: 'commodity', name: 'Gold', symbols: ['GC=F'], aliases: ['gold', 'bullion'], notFollowedBy: ['medal', 'medals', 'medallist', 'medalist', 'standard'] },
  { id: 'commodity:silver', type: 'commodity', name: 'Silver', symbols: ['SI=F'], aliases: ['silver'], notFollowedBy: ['medal', 'medals', 'medallist', 'medalist', 'Lake', 'screen', 'lining'] },
  { id: 'commodity:crude-oil', type: 'commodity', name: 'Crude oil', symbols: ['CL=F', 'BZ=F'], aliases: ['crude oil', 'crude', 'oil prices', 'oil price', 'Brent', 'WTI', 'OPEC', 'OPEC+', 'oil'] },
  { id: 'commodity:natural-gas', type: 'commodity', name: 'Natural gas', symbols: ['NG=F'], aliases: ['natural gas', 'natgas', 'LNG'] },
  { id: 'commodity:copper', type: 'commodity', name: 'Copper', symbols: ['HG=F'], aliases: ['copper'] },
]

// ── Currencies (the app's FX pairs, incl. INR pairs) ─────────────────────────
const CURRENCIES: Entity[] = [
  { id: 'currency:usd', type: 'currency', name: 'US dollar', aliases: ['US dollar', 'U.S. dollar', 'dollar', 'greenback', 'dollar index', 'DXY'], symbols: ['DX-Y.NYB'],
    notPrecededBy: ['Australian', 'Aussie', 'Canadian', 'New Zealand', 'kiwi', 'Hong Kong', 'Singapore', 'Taiwan', 'Zimbabwe'] },
  { id: 'currency:eur', type: 'currency', name: 'Euro', aliases: ['euro'], notFollowedBy: ['zone', 'area', 'Stoxx', '2028', '2032'] },
  { id: 'currency:gbp', type: 'currency', name: 'British pound', aliases: ['sterling', 'pound sterling', 'British pound'] },
  { id: 'currency:jpy', type: 'currency', name: 'Japanese yen', aliases: ['yen', 'Japanese yen'] },
  { id: 'currency:chf', type: 'currency', name: 'Swiss franc', aliases: ['Swiss franc'] },
  { id: 'currency:aud', type: 'currency', name: 'Australian dollar', aliases: ['Australian dollar', 'Aussie dollar'] },
  { id: 'currency:cad', type: 'currency', name: 'Canadian dollar', aliases: ['Canadian dollar', 'loonie'] },
  { id: 'currency:nzd', type: 'currency', name: 'New Zealand dollar', aliases: ['New Zealand dollar', 'kiwi dollar'] },
  { id: 'currency:cny', type: 'currency', name: 'Chinese yuan', aliases: ['yuan', 'renminbi'] },
  { id: 'currency:inr', type: 'currency', name: 'Indian rupee', aliases: ['rupee', 'Indian rupee'], symbols: ['USDINR=X'] },
]

// ── Indices (Global Market Monitor, India dashboard) ─────────────────────────
const INDICES: Entity[] = [
  { id: 'index:sp500', type: 'index', name: 'S&P 500', symbols: ['^GSPC', 'SPY'], aliases: ['S&P 500', 'S&P500', 'SPX'] },
  { id: 'index:nasdaq', type: 'index', name: 'Nasdaq Composite', symbols: ['^IXIC'], aliases: ['Nasdaq Composite', 'Nasdaq'], notFollowedBy: ['100', '-100'] },
  { id: 'index:nasdaq100', type: 'index', name: 'Nasdaq-100', symbols: ['^NDX', 'QQQ'], aliases: ['Nasdaq 100', 'Nasdaq-100', 'NDX'] },
  { id: 'index:dow', type: 'index', name: 'Dow Jones Industrial Average', symbols: ['^DJI'], aliases: ['Dow Jones', 'Dow'], caseSensitive: ['Dow'], notFollowedBy: ['Inc', 'Chemical'] },
  { id: 'index:russell2000', type: 'index', name: 'Russell 2000', symbols: ['^RUT'], aliases: ['Russell 2000'] },
  { id: 'index:vix', type: 'index', name: 'CBOE Volatility Index', symbols: ['^VIX'], aliases: ['VIX', 'fear gauge', 'fear index'], caseSensitive: ['VIX'] },
  { id: 'index:nifty50', type: 'index', name: 'Nifty 50', symbols: ['^NSEI'], aliases: ['Nifty 50', 'Nifty'], notFollowedBy: ['Bank', 'IT', 'Auto', 'Pharma', 'Metal', 'FMCG', 'Midcap', 'Smallcap', 'Next', 'Financial', 'Realty', 'Energy', 'Media', 'PSU'] },
  { id: 'index:banknifty', type: 'index', name: 'Nifty Bank', symbols: ['^NSEBANK'], aliases: ['Bank Nifty', 'Nifty Bank'] },
  { id: 'index:sensex', type: 'index', name: 'BSE Sensex', symbols: ['^BSESN'], aliases: ['Sensex'] },
  { id: 'index:indiavix', type: 'index', name: 'India VIX', symbols: ['^INDIAVIX'], aliases: ['India VIX'] },
  { id: 'index:nikkei225', type: 'index', name: 'Nikkei 225', symbols: ['^N225'], aliases: ['Nikkei 225', 'Nikkei'] },
  { id: 'index:shanghai', type: 'index', name: 'Shanghai Composite', symbols: ['000001.SS'], aliases: ['Shanghai Composite'] },
  { id: 'index:hangseng', type: 'index', name: 'Hang Seng', symbols: ['^HSI'], aliases: ['Hang Seng'] },
  { id: 'index:asx200', type: 'index', name: 'S&P/ASX 200', symbols: ['^AXJO'], aliases: ['ASX 200', 'ASX'], caseSensitive: ['ASX'] },
  { id: 'index:ftse100', type: 'index', name: 'FTSE 100', symbols: ['^FTSE'], aliases: ['FTSE 100', 'FTSE'] },
  { id: 'index:dax', type: 'index', name: 'DAX', symbols: ['^GDAXI'], aliases: ['DAX'], caseSensitive: ['DAX'] },
  { id: 'index:cac40', type: 'index', name: 'CAC 40', symbols: ['^FCHI'], aliases: ['CAC 40'] },
  { id: 'index:eurostoxx50', type: 'index', name: 'Euro Stoxx 50', symbols: ['^STOXX50E'], aliases: ['Euro Stoxx 50', 'Euro Stoxx', 'EuroStoxx'] },
  { id: 'index:tsx', type: 'index', name: 'S&P/TSX Composite', symbols: ['^GSPTSE'], aliases: ['TSX'], caseSensitive: ['TSX'] },
  { id: 'index:bovespa', type: 'index', name: 'Ibovespa', symbols: ['^BVSP'], aliases: ['Ibovespa', 'Bovespa'] },
]

// ── Companies ────────────────────────────────────────────────────────────────
const IT = 'sector:information-technology', FIN = 'sector:financials', EN = 'sector:energy', HC = 'sector:health-care'
const IND = 'sector:industrials', CD = 'sector:consumer-discretionary', CS = 'sector:consumer-staples'
const UT = 'sector:utilities', MAT = 'sector:materials', COM = 'sector:communication-services'
const US = 'country:us', IN = 'country:india'

// US names the app shows: markets default list, analyst universe, dashboard tiles.
// Plus TSMC and ASML, the two suppliers most US-chip headlines turn on.
const US_COMPANIES: Entity[] = [
  { id: 'AAPL', type: 'company', name: 'Apple', sector: IT, industry: 'Consumer electronics', country: US, exchange: 'NASDAQ', aliases: ['Apple'], caseSensitive: ['Apple'], notFollowedBy: ['pie', 'cider', 'orchard'] },
  { id: 'MSFT', type: 'company', name: 'Microsoft', sector: IT, industry: 'Software & cloud', country: US, exchange: 'NASDAQ', aliases: ['Microsoft'] },
  { id: 'NVDA', type: 'company', name: 'Nvidia', sector: IT, industry: 'Semiconductors', country: US, exchange: 'NASDAQ', aliases: ['Nvidia', 'NVIDIA'] },
  { id: 'GOOGL', type: 'company', name: 'Alphabet', sector: COM, industry: 'Internet search & cloud', country: US, exchange: 'NASDAQ', aliases: ['Alphabet', 'Google'] },
  { id: 'AMZN', type: 'company', name: 'Amazon', sector: CD, industry: 'E-commerce & cloud', country: US, exchange: 'NASDAQ', aliases: ['Amazon', 'AWS'], notFollowedBy: ['rainforest', 'river', 'basin', 'forest', 'jungle', 'deforestation', 'tribes'] },
  { id: 'META', type: 'company', name: 'Meta Platforms', sector: COM, industry: 'Social media & advertising', country: US, exchange: 'NASDAQ', aliases: ['Meta Platforms', 'Meta', 'Facebook', 'Instagram', 'WhatsApp'], caseSensitive: ['Meta'] },
  { id: 'TSLA', type: 'company', name: 'Tesla', sector: CD, industry: 'Electric vehicles', country: US, exchange: 'NASDAQ', aliases: ['Tesla'] },
  { id: 'AVGO', type: 'company', name: 'Broadcom', sector: IT, industry: 'Semiconductors', country: US, exchange: 'NASDAQ', aliases: ['Broadcom'] },
  { id: 'AMD', type: 'company', name: 'Advanced Micro Devices', sector: IT, industry: 'Semiconductors', country: US, exchange: 'NASDAQ', aliases: ['Advanced Micro Devices'] },
  { id: 'PLTR', type: 'company', name: 'Palantir', sector: IT, industry: 'Software', country: US, exchange: 'NASDAQ', aliases: ['Palantir'] },
  { id: 'JPM', type: 'company', name: 'JPMorgan Chase', sector: FIN, industry: 'Banking', country: US, exchange: 'NYSE', aliases: ['JPMorgan Chase', 'JPMorgan', 'JP Morgan', 'J.P. Morgan'] },
  { id: 'V', type: 'company', name: 'Visa', sector: FIN, industry: 'Payments', country: US, exchange: 'NYSE', patterns: ['Visa(?= (Inc|shares|stock|earnings|revenue|profit|results))'] },
  { id: 'UNH', type: 'company', name: 'UnitedHealth Group', sector: HC, industry: 'Health insurance', country: US, exchange: 'NYSE', aliases: ['UnitedHealth', 'UnitedHealth Group'] },
  { id: 'JNJ', type: 'company', name: 'Johnson & Johnson', sector: HC, industry: 'Pharmaceuticals & medtech', country: US, exchange: 'NYSE', aliases: ['Johnson & Johnson', 'J&J'] },
  { id: 'LLY', type: 'company', name: 'Eli Lilly', sector: HC, industry: 'Pharmaceuticals', country: US, exchange: 'NYSE', aliases: ['Eli Lilly', 'Lilly'], caseSensitive: ['Lilly'] },
  { id: 'XOM', type: 'company', name: 'Exxon Mobil', sector: EN, industry: 'Integrated oil & gas', country: US, exchange: 'NYSE', aliases: ['Exxon Mobil', 'ExxonMobil', 'Exxon'] },
  { id: 'WMT', type: 'company', name: 'Walmart', sector: CS, industry: 'Retail', country: US, aliases: ['Walmart'] },
  { id: 'TSM', type: 'company', name: 'Taiwan Semiconductor Manufacturing', sector: IT, industry: 'Semiconductor foundry', country: 'country:taiwan', exchange: 'NYSE', aliases: ['TSMC', 'Taiwan Semiconductor'] },
  { id: 'ASML', type: 'company', name: 'ASML', sector: IT, industry: 'Semiconductor equipment', country: 'country:netherlands', exchange: 'NASDAQ', aliases: ['ASML'] },
]

// Nifty 50 (mirrors NIFTY50_STOCKS in lib/apis/india.ts — scripts/graph-test.ts checks they match).
const nse = (id: string, name: string, sector: string, industry: string, aliases: string[], extra: Partial<Entity> = {}): Entity =>
  ({ id, type: 'company', name, sector, industry, country: IN, exchange: 'NSE', aliases, ...extra })

const INDIA_COMPANIES: Entity[] = [
  nse('RELIANCE.NS', 'Reliance Industries', EN, 'Oil-to-chemicals, telecom & retail', ['Reliance Industries', 'RIL', 'Reliance Jio', 'Jio']),
  nse('TCS.NS', 'Tata Consultancy Services', IT, 'IT services', ['Tata Consultancy Services', 'Tata Consultancy', 'TCS']),
  nse('HDFCBANK.NS', 'HDFC Bank', FIN, 'Banking', ['HDFC Bank']),
  nse('INFY.NS', 'Infosys', IT, 'IT services', ['Infosys']),
  nse('HINDUNILVR.NS', 'Hindustan Unilever', CS, 'FMCG', ['Hindustan Unilever', 'HUL']),
  nse('ICICIBANK.NS', 'ICICI Bank', FIN, 'Banking', ['ICICI Bank']),
  nse('KOTAKBANK.NS', 'Kotak Mahindra Bank', FIN, 'Banking', ['Kotak Mahindra Bank', 'Kotak Bank', 'Kotak']),
  nse('LT.NS', 'Larsen & Toubro', IND, 'Engineering & construction', ['Larsen & Toubro', 'L&T']),
  nse('SBIN.NS', 'State Bank of India', FIN, 'Banking', ['State Bank of India', 'SBI']),
  nse('BHARTIARTL.NS', 'Bharti Airtel', COM, 'Telecom', ['Bharti Airtel', 'Airtel']),
  nse('ASIANPAINT.NS', 'Asian Paints', MAT, 'Paints', ['Asian Paints']),
  nse('AXISBANK.NS', 'Axis Bank', FIN, 'Banking', ['Axis Bank']),
  nse('ITC.NS', 'ITC', CS, 'FMCG & tobacco', ['ITC Ltd', 'ITC Limited'], { patterns: ['ITC(?= (shares|stock|Q[1-4]|results|Hotels))'] }),
  nse('BAJFINANCE.NS', 'Bajaj Finance', FIN, 'Consumer finance', ['Bajaj Finance']),
  nse('MARUTI.NS', 'Maruti Suzuki', CD, 'Automobiles', ['Maruti Suzuki', 'Maruti']),
  nse('WIPRO.NS', 'Wipro', IT, 'IT services', ['Wipro']),
  nse('HCLTECH.NS', 'HCLTech', IT, 'IT services', ['HCLTech', 'HCL Tech', 'HCL Technologies']),
  nse('ULTRACEMCO.NS', 'UltraTech Cement', MAT, 'Cement', ['UltraTech Cement', 'UltraTech']),
  nse('NESTLEIND.NS', 'Nestle India', CS, 'FMCG', ['Nestle India', 'Nestlé India']),
  nse('POWERGRID.NS', 'Power Grid Corporation of India', UT, 'Power transmission', ['Power Grid Corporation', 'Power Grid', 'POWERGRID']),
  nse('TITAN.NS', 'Titan Company', CD, 'Jewellery & watches', ['Titan Company', 'Tanishq']),
  nse('TMPV.NS', 'Tata Motors Passenger Vehicles', CD, 'Automobiles', ['Tata Motors Passenger Vehicles', 'TMPV', 'Jaguar Land Rover', 'JLR']),
  nse('SUNPHARMA.NS', 'Sun Pharmaceutical', HC, 'Pharmaceuticals', ['Sun Pharmaceutical', 'Sun Pharma']),
  nse('TECHM.NS', 'Tech Mahindra', IT, 'IT services', ['Tech Mahindra']),
  nse('NTPC.NS', 'NTPC', UT, 'Power generation', ['NTPC']),
  nse('ONGC.NS', 'Oil and Natural Gas Corporation', EN, 'Oil & gas exploration', ['ONGC', 'Oil and Natural Gas Corporation']),
  nse('JSWSTEEL.NS', 'JSW Steel', MAT, 'Steel', ['JSW Steel']),
  nse('TATASTEEL.NS', 'Tata Steel', MAT, 'Steel', ['Tata Steel']),
  nse('ADANIENT.NS', 'Adani Enterprises', IND, 'Conglomerate', ['Adani Enterprises']),
  nse('ADANIPORTS.NS', 'Adani Ports and SEZ', IND, 'Ports & logistics', ['Adani Ports', 'APSEZ']),
  nse('DRREDDY.NS', "Dr. Reddy's Laboratories", HC, 'Pharmaceuticals', ["Dr. Reddy's", "Dr Reddy's", "Dr Reddys"]),
  nse('CIPLA.NS', 'Cipla', HC, 'Pharmaceuticals', ['Cipla']),
  nse('DIVISLAB.NS', "Divi's Laboratories", HC, 'Pharmaceutical ingredients', ["Divi's Laboratories", "Divi's Labs", "Divi's"]),
  nse('BAJAJFINSV.NS', 'Bajaj Finserv', FIN, 'Financial services holding company', ['Bajaj Finserv']),
  nse('EICHERMOT.NS', 'Eicher Motors', CD, 'Motorcycles & commercial vehicles', ['Eicher Motors', 'Royal Enfield']),
  nse('GRASIM.NS', 'Grasim Industries', MAT, 'Cement, chemicals & fibres', ['Grasim Industries', 'Grasim']),
  nse('HEROMOTOCO.NS', 'Hero MotoCorp', CD, 'Two-wheelers', ['Hero MotoCorp', 'Hero Moto']),
  nse('HINDALCO.NS', 'Hindalco Industries', MAT, 'Aluminium & copper', ['Hindalco', 'Novelis']),
  nse('INDUSINDBK.NS', 'IndusInd Bank', FIN, 'Banking', ['IndusInd Bank', 'IndusInd']),
  nse('M&M.NS', 'Mahindra & Mahindra', CD, 'Automobiles & tractors', ['Mahindra & Mahindra', 'M&M', 'Mahindra']),
  nse('BRITANNIA.NS', 'Britannia Industries', CS, 'FMCG', ['Britannia Industries', 'Britannia']),
  nse('COALINDIA.NS', 'Coal India', EN, 'Coal mining', ['Coal India']),
  nse('BPCL.NS', 'Bharat Petroleum', EN, 'Oil refining & marketing', ['Bharat Petroleum', 'BPCL']),
  nse('TATACONSUM.NS', 'Tata Consumer Products', CS, 'FMCG', ['Tata Consumer Products', 'Tata Consumer']),
  nse('APOLLOHOSP.NS', 'Apollo Hospitals', HC, 'Hospitals', ['Apollo Hospitals']),
  nse('SBILIFE.NS', 'SBI Life Insurance', FIN, 'Life insurance', ['SBI Life Insurance', 'SBI Life']),
  nse('HDFCLIFE.NS', 'HDFC Life Insurance', FIN, 'Life insurance', ['HDFC Life Insurance', 'HDFC Life']),
  nse('UPL.NS', 'UPL', MAT, 'Agrochemicals', ['UPL Ltd', 'UPL Limited']),
  nse('SHREECEM.NS', 'Shree Cement', MAT, 'Cement', ['Shree Cement']),
  nse('BAJAJ-AUTO.NS', 'Bajaj Auto', CD, 'Two- & three-wheelers', ['Bajaj Auto']),
]

export const ENTITIES: Entity[] = [
  ...SECTORS, ...REGIONS, ...COUNTRIES, ...COMMODITIES, ...CURRENCIES, ...INDICES, ...US_COMPANIES, ...INDIA_COMPANIES,
]

/** The Nifty 50 ids above, in one place (used for constituent links). */
export const NIFTY50_IDS = INDIA_COMPANIES.map(c => c.id)
