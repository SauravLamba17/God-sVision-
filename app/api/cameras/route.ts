import { NextResponse } from 'next/server'
import { getCameraViews } from '@/lib/cameras/live'

// Current cameras for the Cameras page: verified-live streams and official
// still images with their capture times. Same for every user; cached 60 s
// server-side (lib/cameras/live.ts), 30 s in the browser.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(await getCameraViews(), { headers: { 'Cache-Control': 'private, max-age=30' } })
  } catch {
    return NextResponse.json({ cameras: [], checkedAt: Date.now() }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
