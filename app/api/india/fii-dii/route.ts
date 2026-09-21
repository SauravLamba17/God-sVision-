import { NextResponse } from 'next/server'
import { fetchFiiDii } from '@/lib/apis/fiiDii'

export async function GET() {
  const data = await fetchFiiDii()
  if (!data) {
    // Honest unavailable rather than the hardcoded figures this used to serve.
    return NextResponse.json({ data: null, source: 'unavailable' })
  }
  return NextResponse.json({ data, source: 'live' })
}
