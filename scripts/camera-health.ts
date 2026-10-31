// Daily camera health check.   npm run cameras:health [-- --dry-run]
// Checks every camera in lib/cameras/catalog.ts and rewrites data/camera-health.json
// (`hidden`: id → reason) so dead feeds disappear from the Cameras page:
//   YouTube  live now + embeddable (YOUTUBE_API_KEY if set, else the public watch page)
//   images   latest capture within the source's update window (same probe as /api/cameras)
// A failing camera is re-checked once after RETRY_MS before it is hidden; a hidden
// camera that passes is shown again. Inconclusive YouTube answers (bot check) keep the
// previous state. If most cameras fail at once the runner's network is the likelier
// fault: nothing is written and the run fails visibly.
// The file is rewritten only when the hidden set changes, so a healthy day commits nothing.
// Built-ins + the repo's .ts files only (the GitHub Action runs it without npm install).
import fs from 'node:fs'
import { CAMERAS, type CameraDef } from '../lib/cameras/catalog.ts'
import { probeImages, isFresh, youtubeLiveByApi, youtubeLiveByPage } from '../lib/cameras/probe.ts'

const FILE = new URL('../data/camera-health.json', import.meta.url)
const DRY = process.argv.includes('--dry-run')
const RETRY_MS = Number(process.env.RETRY_MS ?? 30_000)
const KEY = process.env.YOUTUBE_API_KEY

type Verdict = { ok: boolean; reason: string; inconclusive?: boolean }

async function check(cams: CameraDef[]): Promise<Record<string, Verdict>> {
  const out: Record<string, Verdict> = {}
  const videos = cams.filter(c => c.source === 'youtube')
  if (videos.length && KEY) {
    try {
      const live = await youtubeLiveByApi(videos.map(c => c.ref), KEY)
      for (const c of videos) out[c.id] = live[c.ref] ? { ok: true, reason: 'live (API)' } : { ok: false, reason: 'not live or not embeddable (API)' }
    } catch (e) {
      for (const c of videos) out[c.id] = { ok: false, reason: `YouTube API failed: ${(e as Error).message}`, inconclusive: true }
    }
  } else {
    for (const c of videos) {
      const v = await youtubeLiveByPage(c.ref).catch(e => ({ live: false, reason: `fetch failed: ${e.message}`, inconclusive: true }))
      out[c.id] = { ok: v.live, reason: v.reason, inconclusive: v.inconclusive }
    }
  }
  const images = await probeImages(cams)
  const now = Date.now()
  for (const c of cams.filter(c => c.source !== 'youtube')) {
    const img = images[c.id]
    out[c.id] = !img ? { ok: false, reason: 'no current image (request failed or "No Service" placeholder)' }
      : isFresh(c.source, img.capturedAt, now) ? { ok: true, reason: `image ${Math.round((now - img.capturedAt) / 60_000)} min old` }
      : { ok: false, reason: `image stale (${new Date(img.capturedAt).toISOString().slice(0, 16)}Z)` }
  }
  return out
}

const prev: Record<string, string> = JSON.parse(fs.readFileSync(FILE, 'utf8')).hidden ?? {}
let result = await check(CAMERAS)
const failing = CAMERAS.filter(c => !result[c.id].ok && !result[c.id].inconclusive)
if (failing.length) {
  console.log(`${failing.length} failing — re-checking in ${RETRY_MS / 1000}s`)
  await new Promise(r => setTimeout(r, RETRY_MS))
  result = { ...result, ...(await check(failing)) }
}

const today = new Date().toISOString().slice(0, 10)
const hidden: Record<string, string> = {}
for (const c of CAMERAS) {
  const v = result[c.id]
  if (v.inconclusive) { if (prev[c.id]) hidden[c.id] = prev[c.id]; continue }
  // Keep the original "since" date while a camera stays down.
  if (!v.ok) hidden[c.id] = prev[c.id]?.startsWith(v.reason) ? prev[c.id] : `${v.reason} (since ${today})`
}

console.log(`\n${'CAMERA'.padEnd(26)}${'SOURCE'.padEnd(13)}RESULT`)
for (const c of CAMERAS) {
  const v = result[c.id]
  console.log(`${c.id.padEnd(26)}${c.source.padEnd(13)}${v.inconclusive ? '?' : v.ok ? 'OK  ' : 'DEAD'} ${v.reason}`)
}

const dead = Object.keys(hidden).length
if (dead > CAMERAS.length / 2) {
  console.error(`\n${dead}/${CAMERAS.length} cameras failing — looks like a network problem on this runner; not writing.`)
  process.exit(1)
}
const changed = JSON.stringify(hidden) !== JSON.stringify(prev)
console.log(`\n${CAMERAS.length - dead}/${CAMERAS.length} cameras OK · hidden: ${dead}${changed ? ' (changed)' : ' (unchanged)'}`)
if (changed && !DRY) fs.writeFileSync(FILE, JSON.stringify({ hidden }, null, 2) + '\n')
