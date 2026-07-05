import { NextResponse } from 'next/server'
import { fetchISSData } from '@/lib/apis/iss'

export async function GET() {
  try {
    const data = await fetchISSData()
    return NextResponse.json({ data, source: 'live' }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, data: null, source: 'empty' })
  }
}
