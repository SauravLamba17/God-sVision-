import { NextResponse } from 'next/server'
import { getCentralBankSpeeches, RATE_CARDS } from '@/lib/apis/centralBanks'

export async function GET() {
  try {
    const speeches = await getCentralBankSpeeches()
    return NextResponse.json({ speeches, rates: RATE_CARDS })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, speeches: [], rates: RATE_CARDS })
  }
}
