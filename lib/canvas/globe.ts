/* Globe rendering for the landing page.
 *
 * Ported verbatim from the approved design's script block in
 * _landing-reference/GODs Vision Landing.dc.html — buildSphere(), rot(),
 * drawGlobe() and drawArcs(). The constants here (the 0.22 perspective
 * divisor, the 3.5/sqrt(n) neighbour cutoff, the per-point alpha curve, the
 * 0.2 arc lift) are tuned values from that design, not derived ones. Change
 * them only against the reference. */

export const CITIES: Array<[string, number, number]> = [
  ['NYC', 40.71, -74.01], ['LDN', 51.5, -0.12], ['FRA', 50.11, 8.68], ['TYO', 35.68, 139.69],
  ['HKG', 22.32, 114.17], ['SGP', 1.35, 103.82], ['MUM', 19.08, 72.88], ['DXB', 25.2, 55.27],
  ['SYD', -33.87, 151.21], ['SAO', -23.55, -46.63],
]

export const ROUTES: Array<[number, number]> = [
  [0, 1], [1, 2], [0, 3], [1, 6], [3, 4], [4, 5], [5, 6], [6, 7],
  [7, 1], [3, 8], [0, 9], [9, 1], [4, 3], [0, 2], [2, 6],
]

export const UP = '#6fae95'
export const DOWN = '#c07a5e'
export const ACCENT = '#c98a4b'
export const INK = '232,230,225'

/** Default point count — the design's `globeDensity` prop default. */
export const GLOBE_DENSITY = 620

export type Vec3 = [number, number, number]

export interface Sphere {
  pts: Vec3[]
  links: Array<[number, number]>
  cityVecs: Vec3[]
}

export interface GlobeOptions {
  cx: number
  cy: number
  r: number
  yaw: number
  pitch: number
  alpha: number
  arcs?: boolean
  arcLift?: number
  labels?: boolean
  t?: number
  /** Reduced-motion suppresses the moving aircraft dot along each arc. */
  showFlightPaths?: boolean
}

/** Canvas element decorated by sizeCanvas() with its CSS box and DPR. */
export type SizedCanvas = HTMLCanvasElement & {
  _dpr?: number
  _w?: number
  _h?: number
}

/* Building the sphere is O(n²) in the link pass (~192k iterations at n=620),
 * so results are memoised per density — every canvas shares one sphere. */
const sphereCache = new Map<number, Sphere>()

export function buildSphere(density = GLOBE_DENSITY): Sphere {
  const n = Math.max(220, Math.min(1200, density))
  const hit = sphereCache.get(n)
  if (hit) return hit

  const pts: Vec3[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const th = golden * i
    pts.push([Math.cos(th) * r, y, Math.sin(th) * r])
  }

  const links: Array<[number, number]> = []
  const cut = 3.5 / Math.sqrt(n)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = pts[i], b = pts[j]
      const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2]
      if (dx * dx + dy * dy + dz * dz < cut * cut) links.push([i, j])
    }
  }

  const cityVecs: Vec3[] = CITIES.map(c => {
    const la = c[1] * Math.PI / 180, lo = c[2] * Math.PI / 180
    return [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)]
  })

  const sphere: Sphere = { pts, links, cityVecs }
  sphereCache.set(n, sphere)
  return sphere
}

export function rot(p: Vec3, yaw: number, pitch: number): Vec3 {
  const cy = Math.cos(yaw), sy = Math.sin(yaw)
  const x = p[0] * cy - p[2] * sy, z = p[0] * sy + p[2] * cy, y = p[1]
  const cp = Math.cos(pitch), sp = Math.sin(pitch)
  return [x, y * cp - z * sp, y * sp + z * cp]
}

/** Sets the backing-store size from the element's CSS box, capped at 2× DPR. */
export function sizeCanvas(c: SizedCanvas | null): void {
  if (!c) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const r = c.getBoundingClientRect()
  c.width = Math.max(1, Math.round(r.width * dpr))
  c.height = Math.max(1, Math.round(r.height * dpr))
  c._dpr = dpr
  c._w = r.width
  c._h = r.height
}

export function drawGlobe(c: SizedCanvas | null, sphere: Sphere | null, o: GlobeOptions): void {
  if (!c || !sphere) return
  const ctx = c.getContext('2d')
  if (!ctx) return
  const dpr = c._dpr || 1, w = c._w || 0, h = c._h || 0
  if (!w || !h) return

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const cx = o.cx, cy = o.cy, R = o.r
  const proj: Vec3[] = []
  for (let i = 0; i < sphere.pts.length; i++) {
    const p = rot(sphere.pts[i], o.yaw, o.pitch)
    const k = 1 / (1 - p[2] * 0.22)
    proj.push([cx + p[0] * R * k, cy - p[1] * R * k, p[2]])
  }

  ctx.lineWidth = 1
  for (let i = 0; i < sphere.links.length; i++) {
    const a = proj[sphere.links[i][0]], b = proj[sphere.links[i][1]]
    if (!a || !b) continue
    const d = (a[2] + b[2]) / 2
    if (d < -0.15) continue
    const al = (d + 0.35) * 0.15 * o.alpha
    if (al <= 0.004) continue
    ctx.strokeStyle = 'rgba(' + INK + ',' + al.toFixed(3) + ')'
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke()
  }

  for (let i = 0; i < proj.length; i++) {
    const p = proj[i]
    const front = p[2] > 0
    const al = (front ? 0.48 : 0.13) * (0.4 + 0.6 * (p[2] + 1) / 2) * o.alpha
    ctx.fillStyle = 'rgba(' + INK + ',' + al.toFixed(3) + ')'
    ctx.beginPath(); ctx.arc(p[0], p[1], front ? 1.25 : 0.85, 0, 6.2832); ctx.fill()
  }

  if (o.arcs) drawArcs(ctx, sphere, o, cx, cy, R)
}

function drawArcs(
  ctx: CanvasRenderingContext2D,
  sphere: Sphere,
  o: GlobeOptions,
  cx: number,
  cy: number,
  R: number,
): void {
  const cityVecs = sphere.cityVecs
  if (!cityVecs.length) return

  const t = o.t || 0
  const project = (v: Vec3): Vec3 => {
    const p = rot(v, o.yaw, o.pitch)
    const k = 1 / (1 - p[2] * 0.22)
    return [cx + p[0] * R * k, cy - p[1] * R * k, p[2]]
  }

  for (let ri = 0; ri < ROUTES.length; ri++) {
    const a = cityVecs[ROUTES[ri][0]], b = cityVecs[ROUTES[ri][1]]
    if (!a || !b) continue

    const seg = 32
    const pathPts: Vec3[] = []
    for (let s = 0; s <= seg; s++) {
      const u = s / seg
      const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u, z = a[2] + (b[2] - a[2]) * u
      const m = Math.hypot(x, y, z) || 1
      const lift = 1 + 0.2 * Math.sin(Math.PI * u) * (o.arcLift ?? 1)
      pathPts.push(project([x / m * lift, y / m * lift, z / m * lift]))
    }

    ctx.lineWidth = 1.1
    for (let s = 0; s < seg; s++) {
      const p = pathPts[s], q = pathPts[s + 1]
      const d = (p[2] + q[2]) / 2
      if (d < 0) continue
      ctx.strokeStyle = 'rgba(201,138,75,' + (Math.min(1, d * 1.4) * 0.3 * o.alpha).toFixed(3) + ')'
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke()
    }

    if (o.showFlightPaths !== false) {
      const u = (t * 0.13 + ri * 0.137) % 1
      const p = pathPts[Math.max(0, Math.min(seg, Math.floor(u * seg)))]
      if (p && p[2] > 0.02) {
        ctx.fillStyle = 'rgba(226,186,140,' + (0.85 * o.alpha).toFixed(3) + ')'
        ctx.beginPath(); ctx.arc(p[0], p[1], 2.1, 0, 6.2832); ctx.fill()
      }
    }
  }

  for (let i = 0; i < cityVecs.length; i++) {
    const p = project(cityVecs[i])
    if (p[2] <= 0.04) continue
    ctx.fillStyle = 'rgba(201,138,75,' + (0.92 * o.alpha).toFixed(3) + ')'
    ctx.beginPath(); ctx.arc(p[0], p[1], 2.4, 0, 6.2832); ctx.fill()
    ctx.strokeStyle = 'rgba(201,138,75,' + (0.26 * o.alpha).toFixed(3) + ')'
    ctx.beginPath(); ctx.arc(p[0], p[1], 6.5, 0, 6.2832); ctx.stroke()
    if (o.labels) {
      ctx.fillStyle = 'rgba(' + INK + ',' + (0.5 * o.alpha).toFixed(3) + ')'
      ctx.font = "500 9px 'Geist Mono', monospace"
      ctx.fillText(CITIES[i][0], p[0] + 10, p[1] + 3)
    }
  }
}
