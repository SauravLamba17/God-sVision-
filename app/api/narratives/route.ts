import { NextResponse } from 'next/server'
import { detectNarratives } from '@/lib/apis/narratives'

export async function GET() {
  try {
    const data = await detectNarratives()
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, data: null, source: 'empty' })
  }
}
