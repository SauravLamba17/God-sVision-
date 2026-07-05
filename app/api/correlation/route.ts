import { NextResponse } from 'next/server'
import { getCorrelationMatrix, ASSETS } from '@/lib/apis/correlation'

export async function GET() {
  try {
    const data = await getCorrelationMatrix()
    return NextResponse.json({ data, assets: ASSETS })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
