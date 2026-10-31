// Every camera the Cameras page can show. Only official / broadcaster sources
// whose terms allow display, each with the attribution its licence asks for.
// A camera is shown only when it is verifiably current: image feeds by their
// capture time (lib/cameras/probe.ts), YouTube streams by the daily health
// check (scripts/camera-health.ts → data/camera-health.json) or, when
// YOUTUBE_API_KEY is set, a cached live check.
// Plain relative imports only: the daily GitHub Action runs this with bare Node.

export type CameraSource = 'youtube' | 'tfl' | 'lta' | 'digitraffic' | 'hktd' | 'caltrans'
export type Region = 'Americas' | 'Europe' | 'Asia' | 'Middle East' | 'Orbit'

export interface CameraDef {
  id: string
  title: string
  city: string
  country: string
  region: Region
  timezone: string
  source: CameraSource
  /** 'global' tab, 'london' tab, or both. */
  sets: ('global' | 'london')[]
  /** YouTube: video id. lta: camera_id. digitraffic: preset id. Others: fixed image URL. */
  ref: string
  /** YouTube only: the channel, credited on the card. */
  channel?: string
}

export const SOURCES: Record<CameraSource, { name: string; attribution: string; licenceUrl?: string; maxAgeMin: number }> = {
  youtube: { name: 'YouTube', attribution: 'Live streams via YouTube from their broadcasters', maxAgeMin: 0 },
  tfl: { name: 'TfL JamCams', attribution: 'Powered by TfL Open Data', licenceUrl: 'https://tfl.gov.uk/corporate/terms-and-conditions/transport-data-service', maxAgeMin: 20 },
  lta: {
    name: 'LTA via data.gov.sg',
    attribution: 'Contains information from Traffic Images accessed from data.gov.sg, made available under the Singapore Open Data Licence v1.0',
    licenceUrl: 'https://data.gov.sg/open-data-licence', maxAgeMin: 15,
  },
  digitraffic: { name: 'Fintraffic Digitraffic', attribution: 'Source: Fintraffic / digitraffic.fi, license CC 4.0 BY', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/', maxAgeMin: 30 },
  hktd: { name: 'HK Transport Dept', attribution: 'Source: Transport Department, HKSAR Government / DATA.GOV.HK', licenceUrl: 'https://data.gov.hk/en/terms-and-conditions', maxAgeMin: 15 },
  caltrans: { name: 'Caltrans', attribution: 'Images: California Department of Transportation (Caltrans)', licenceUrl: 'https://dot.ca.gov/conditions-of-use', maxAgeMin: 20 },
}

const TFL = (n: string) => `https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/${n}.jpg`
const HK = (k: string) => `https://tdcctv.data.one.gov.hk/${k}.JPG`
const CT = (slug: string) => `https://cwwp2.dot.ca.gov/data/d4/cctv/image/${slug}/${slug}.jpg`
const london = (id: string, title: string, n: string, sets: CameraDef['sets'] = ['london']): CameraDef =>
  ({ id, title, city: 'London', country: 'UK', region: 'Europe', timezone: 'Europe/London', source: 'tfl', sets, ref: TFL(n) })

export const CAMERAS: CameraDef[] = [
  // ── Live video (reputable broadcasters; verified live 2026-10-31) ──
  { id: 'times-square', title: 'TIMES SQUARE', city: 'New York', country: 'USA', region: 'Americas', timezone: 'America/New_York', source: 'youtube', sets: ['global'], ref: 'KHy_n-EMWY8', channel: 'EarthCam' },
  { id: 'shibuya', title: 'SHIBUYA CROSSING', city: 'Tokyo', country: 'Japan', region: 'Asia', timezone: 'Asia/Tokyo', source: 'youtube', sets: ['global'], ref: '5B4LmH4JbnY', channel: 'ANNnewsCH (TV Asahi)' },
  { id: 'western-wall', title: 'WESTERN WALL', city: 'Jerusalem', country: 'Israel', region: 'Middle East', timezone: 'Asia/Jerusalem', source: 'youtube', sets: ['global'], ref: '77akujLn4k8', channel: 'EarthCam' },
  { id: 'iss-hd', title: 'ISS EARTH VIEW (HD)', city: 'Low Earth orbit', country: 'ISS', region: 'Orbit', timezone: 'UTC', source: 'youtube', sets: ['global'], ref: 'ROboUHfPUrU', channel: 'NASA' },
  { id: 'nasa-live', title: 'NASA LIVE (OFFICIAL)', city: 'Low Earth orbit', country: 'ISS', region: 'Orbit', timezone: 'UTC', source: 'youtube', sets: ['global'], ref: 'M3HKLzjvKPc', channel: 'NASA' },

  // ── City cameras: official still images with capture times ──
  london('tfl-trafalgar', 'TRAFALGAR SQUARE', '00001.06502', ['global', 'london']),
  london('tfl-tower-bridge', 'TOWER BRIDGE APPROACH', '00001.03500', ['global', 'london']),
  london('tfl-piccadilly', 'PICCADILLY CIRCUS', '00001.07450', ['global', 'london']),
  { id: 'fi-ruoholahti', title: 'RUOHOLAHTI', city: 'Helsinki', country: 'Finland', region: 'Europe', timezone: 'Europe/Helsinki', source: 'digitraffic', sets: ['global'], ref: 'C0167400' },
  { id: 'fi-lauttasaari', title: 'LAUTTASAARI', city: 'Helsinki', country: 'Finland', region: 'Europe', timezone: 'Europe/Helsinki', source: 'digitraffic', sets: ['global'], ref: 'C0167500' },
  { id: 'sg-woodlands', title: 'WOODLANDS CAUSEWAY', city: 'Singapore', country: 'Singapore', region: 'Asia', timezone: 'Asia/Singapore', source: 'lta', sets: ['global'], ref: '2701' },
  { id: 'sg-sentosa', title: 'SENTOSA GATEWAY', city: 'Singapore', country: 'Singapore', region: 'Asia', timezone: 'Asia/Singapore', source: 'lta', sets: ['global'], ref: '4798' },
  { id: 'hk-central', title: 'CONNAUGHT RD CENTRAL', city: 'Hong Kong', country: 'China', region: 'Asia', timezone: 'Asia/Hong_Kong', source: 'hktd', sets: ['global'], ref: HK('H106F') },
  { id: 'hk-tst', title: 'SALISBURY RD, TSIM SHA TSUI', city: 'Hong Kong', country: 'China', region: 'Asia', timezone: 'Asia/Hong_Kong', source: 'hktd', sets: ['global'], ref: HK('K101F') },
  { id: 'hk-tunnel', title: 'CROSS HARBOUR TUNNEL', city: 'Hong Kong', country: 'China', region: 'Asia', timezone: 'Asia/Hong_Kong', source: 'hktd', sets: ['global'], ref: HK('H207F') },
  { id: 'ca-bay-bridge', title: 'BAY BRIDGE (SAS TOWER)', city: 'San Francisco', country: 'USA', region: 'Americas', timezone: 'America/Los_Angeles', source: 'caltrans', sets: ['global'], ref: CT('tvd32i80baybridgesastowereast') },
  { id: 'ca-toll-plaza', title: 'BAY BRIDGE TOLL PLAZA', city: 'Oakland', country: 'USA', region: 'Americas', timezone: 'America/Los_Angeles', source: 'caltrans', sets: ['global'], ref: CT('tvd13i80tollplaza') },

  // ── London tab: central-London JamCams ──
  london('tfl-parliament', 'PARLIAMENT SQUARE', '00001.06501'),
  london('tfl-hyde-park', 'HYDE PARK CORNER', '00001.06515'),
  london('tfl-westminster-bridge', 'WESTMINSTER BRIDGE / YORK RD', '00001.04502'),
  london('tfl-westminster-south', 'WESTMINSTER BRIDGE / SOUTH', '00001.04227'),
  london('tfl-park-lane', 'HYDE PARK CORNER / PARK LANE', '00001.08750'),
  london('tfl-st-james', 'PICCADILLY / ST JAMES ST', '00001.06592'),
  london('tfl-tower-bridge-rd', 'TOWER BRIDGE RD / ROTHSAY ST', '00001.03488'),
  london('tfl-waterloo', 'WESTMINSTER BRIDGE RD / WATERLOO RD', '00001.04244'),
  london('tfl-baylis', 'BAYLIS RD / WESTMINSTER BRIDGE RD', '00001.06510'),
]
