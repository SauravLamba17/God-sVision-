import { NextResponse } from 'next/server'
import { getFearRadarData } from '@/lib/apis/fearRadar'

// ISR: regenerated at most every 300s (news/sentiment). Without this the route was
// prerendered at build and served build-time data forever.
export const revalidate = 300

export async function GET() {
  try {
    const data = await getFearRadarData()
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, data: null, source: 'unavailable' })
  }
}
