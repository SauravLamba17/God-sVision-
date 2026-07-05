import { NextResponse } from 'next/server'
import { getFearRadarData } from '@/lib/apis/fearRadar'

export async function GET() {
  try {
    const data = await getFearRadarData()
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, data: null, source: 'empty' })
  }
}
