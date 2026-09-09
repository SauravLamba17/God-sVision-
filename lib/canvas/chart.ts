/* Candlestick mockup for the landing page's Markets panel.
 *
 * Ported verbatim from the reference design's buildSeries(), tickQuote() and
 * drawChart(). The series is deterministic — a seeded LCG, seed 42 — so the
 * server, the client and every visitor see the same opening candles. */

import { DOWN, INK, UP, type SizedCanvas } from './globe'

export interface Candle { o: number; c: number; hi: number; lo: number; v: number }

export interface ChartQuote {
  last: string
  change: string
  changeUp: boolean
  book: string
  spread: string
  volume: string
}

/** Seeded LCG, carried between build and tick exactly as the reference does. */
export class ChartSeries {
  candles: Candle[] = []
  private seed = 42

  private rnd(): number {
    this.seed = (this.seed * 1103515245 + 12345) % 2147483648
    return this.seed / 2147483648
  }

  constructor() {
    let px = 232
    for (let i = 0; i < 66; i++) {
      const o = px
      const c = Math.max(200, o + (this.rnd() - 0.46) * 2.6)
      this.candles.push({
        o, c,
        hi: Math.max(o, c) + this.rnd() * 1.4,
        lo: Math.min(o, c) - this.rnd() * 1.4,
        v: 0.3 + this.rnd() * 0.7,
      })
      px = c
    }
  }

  /** Advances the last candle, occasionally rolling a new one on. */
  tick(): ChartQuote {
    const s = this.candles
    const last = s[s.length - 1]
    last.c = Math.max(200, last.c + (this.rnd() - 0.5) * 0.9)
    last.hi = Math.max(last.hi, last.c)
    last.lo = Math.min(last.lo, last.c)
    if (this.rnd() > 0.82) {
      s.shift()
      s.push({ o: last.c, c: last.c, hi: last.c, lo: last.c, v: 0.3 + this.rnd() * 0.7 })
    }

    const first = s[0].o, cur = s[s.length - 1].c
    const chg = ((cur - first) / first) * 100
    return {
      last: cur.toFixed(2),
      change: (chg >= 0 ? '▲ +' : '▼ −') + Math.abs(chg).toFixed(2) + '%',
      changeUp: chg >= 0,
      book: (cur - 0.03).toFixed(2) + ' / ' + (cur + 0.02).toFixed(2),
      spread: '0.05 (2 bp)',
      volume: (38 + Math.floor(this.rnd() * 9)) + '.4 M',
    }
  }
}

export function drawChart(c: SizedCanvas | null, series: Candle[] | null): void {
  if (!c || !series || !c._w) return
  const ctx = c.getContext('2d')
  if (!ctx) return

  const dpr = c._dpr || 1, w = c._w, h = c._h || 0
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const padR = 58, padB = 26, padT = 14, padL = 14
  const s = series
  let hi = -1e9, lo = 1e9
  s.forEach(k => { hi = Math.max(hi, k.hi); lo = Math.min(lo, k.lo) })
  const pad = (hi - lo) * 0.12
  hi += pad; lo -= pad

  const X = (i: number) => padL + (i / (s.length - 1)) * (w - padL - padR)
  const Y = (p: number) => padT + (1 - (p - lo) / (hi - lo)) * (h - padT - padB)

  ctx.strokeStyle = 'rgba(' + INK + ',.07)'
  ctx.lineWidth = 1
  ctx.font = "500 9px 'Geist Mono', monospace"
  for (let g = 0; g <= 4; g++) {
    const p = lo + (hi - lo) * (g / 4), y = Y(p)
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke()
    ctx.fillStyle = 'rgba(' + INK + ',.34)'
    ctx.fillText(p.toFixed(2), w - padR + 8, y + 3)
  }

  const bw = Math.max(2.2, (w - padL - padR) / s.length * 0.58)
  s.forEach((k, i) => {
    const up = k.c >= k.o
    ctx.strokeStyle = up ? UP : DOWN
    ctx.fillStyle = up ? UP : DOWN
    const x = X(i)
    ctx.beginPath(); ctx.moveTo(x, Y(k.hi)); ctx.lineTo(x, Y(k.lo)); ctx.stroke()
    const yo = Y(k.o), yc = Y(k.c)
    const top = Math.min(yo, yc), hgt = Math.max(1.2, Math.abs(yc - yo))
    if (up) {
      ctx.globalAlpha = 0.18; ctx.fillRect(x - bw / 2, top, bw, hgt); ctx.globalAlpha = 1
      ctx.strokeRect(x - bw / 2, top, bw, hgt)
    } else {
      ctx.fillRect(x - bw / 2, top, bw, hgt)
    }
    const vh = k.v * 20
    ctx.globalAlpha = 0.22
    ctx.fillRect(x - bw / 2, h - padB + 4 - vh, bw, vh)
    ctx.globalAlpha = 1
  })

  const last = s[s.length - 1].c, ly = Y(last)
  ctx.setLineDash([4, 4])
  ctx.strokeStyle = 'rgba(201,138,75,.75)'
  ctx.beginPath(); ctx.moveTo(padL, ly); ctx.lineTo(w - padR, ly); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = '#c98a4b'
  ctx.fillRect(w - padR + 2, ly - 8, padR - 4, 16)
  ctx.fillStyle = '#0a0b0d'
  ctx.font = "600 9px 'Geist Mono', monospace"
  ctx.fillText(last.toFixed(2), w - padR + 7, ly + 3)
}
