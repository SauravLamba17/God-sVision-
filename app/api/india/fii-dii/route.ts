import { NextResponse } from 'next/server'
import { fetchFiiDii } from '@/lib/apis/fiiDii'

// ISR: regenerated at most every 3600s (macro/central-bank/daily-flow data). Without this the route was
// prerendered at build and served build-time data forever.
export const revalidate = 3600

export async function GET() {
  const data = await fetchFiiDii()
  if (!data) {
    // Honest unavailable rather than the hardcoded figures this used to serve.
    return NextResponse.json({ data: null, source: 'unavailable' })
  }
  return NextResponse.json({ data, source: 'live' })
}
