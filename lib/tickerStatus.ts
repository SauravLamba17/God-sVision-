// Live / delayed / closed for one quote, from its last-trade time and its
// market's session. A quote that fits none of them (open market but an old
// print, or a close from an earlier session) gets null and must not be shown.

export type Session = 'us' | 'in' | 'fx' | 'fut' | 'crypto'
export type TickerStatus = 'live' | 'delayed' | 'closed'

const LIVE_MS = 5 * 60_000      // last trade within 5 min while open → live
const DELAYED_MS = 20 * 60_000  // within 20 min → delayed; older → hidden

const TZ: Record<Exclude<Session, 'crypto'>, string> = {
  us: 'America/New_York', in: 'Asia/Kolkata', fx: 'America/New_York', fut: 'America/New_York',
}

// Weekday (0 = Sun), minutes since midnight and YYYY-MM-DD in a time zone.
function local(ms: number, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(ms).map(x => [x.type, x.value]))
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday)
  return { day, min: +p.hour * 60 + +p.minute, date: `${p.year}-${p.month}-${p.day}` }
}

// Cash sessions (exchange holidays are not modelled: on a holiday the market
// looks open with an old print, so its quotes are hidden rather than mislabelled).
const CASH: Record<'us' | 'in', [number, number]> = { us: [570, 960], in: [555, 930] } // 9:30–16:00 ET, 9:15–15:30 IST

function isOpen(s: Exclude<Session, 'crypto'>, now: number): boolean {
  const { day, min } = local(now, TZ[s])
  if (s === 'us' || s === 'in') return day >= 1 && day <= 5 && min >= CASH[s][0] && min < CASH[s][1]
  // FX and CME futures trade round the clock from Sunday evening to Friday 17:00 ET.
  const sundayOpen = s === 'fx' ? 17 * 60 : 18 * 60
  if (day === 6) return false
  if (day === 5) return min < 17 * 60
  if (day === 0) return min >= sundayOpen
  // CME futures pause daily 17:00–18:00 ET.
  return !(s === 'fut' && min >= 17 * 60 && min < 18 * 60)
}

// Local date of the most recent session that has opened, as of `now`.
function lastSessionDate(s: Exclude<Session, 'crypto'>, now: number): string {
  for (let back = 0; back < 7; back++) {
    const t = now - back * 86_400_000
    const { day, min } = local(t, TZ[s])
    const opensAt = s === 'us' || s === 'in' ? CASH[s][0] : 0
    if (day >= 1 && day <= 5 && (back > 0 || min >= opensAt)) return local(t, TZ[s]).date
  }
  return ''
}

export function tickerStatus(session: Session, tradeMs: number | null, now = Date.now()): TickerStatus | null {
  if (!tradeMs || !Number.isFinite(tradeMs) || tradeMs > now + 60_000) return null
  const age = now - tradeMs
  if (session === 'crypto' || isOpen(session, now)) {
    return age <= LIVE_MS ? 'live' : age <= DELAYED_MS ? 'delayed' : null
  }
  // Closed: only the close of the latest session counts.
  return local(tradeMs, TZ[session]).date === lastSessionDate(session, now) ? 'closed' : null
}

/** Cash session open now, and minutes until it closes (open) or next opens (closed).
 *  Weekends only — exchange holidays are not modelled. */
export function marketState(s: 'us' | 'in', now = Date.now()): { open: boolean; minutes: number } {
  const { day, min } = local(now, TZ[s])
  const [o, c] = CASH[s]
  if (day >= 1 && day <= 5 && min >= o && min < c) return { open: true, minutes: c - min }
  for (let d = 0; d < 8; d++) {
    const wd = (day + d) % 7
    if (wd >= 1 && wd <= 5 && (d > 0 || min < o)) {
      // Wall-clock minutes, corrected if a DST change falls in between.
      const raw = d * 1440 + o - min
      return { open: false, minutes: raw + offsetMin(now, TZ[s]) - offsetMin(now + raw * 60_000, TZ[s]) }
    }
  }
  return { open: false, minutes: 0 }
}

/** The time zone's UTC offset in minutes at an instant. */
function offsetMin(ms: number, tz: string): number {
  const { date, min } = local(ms, tz)
  const [y, m, d] = date.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) + min * 60_000 - ms) / 60_000)
}

/** Unix seconds, unix ms, ISO string or Date → ms (null when unusable). */
export function toMs(t: unknown): number | null {
  if (t instanceof Date) return t.getTime()
  if (typeof t === 'number' && Number.isFinite(t) && t > 0) return t < 1e12 ? t * 1000 : t
  if (typeof t === 'string') { const ms = Date.parse(t); return Number.isFinite(ms) ? ms : null }
  return null
}
