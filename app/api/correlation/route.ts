import { NextResponse } from 'next/server'
import { getCorrelationMatrix, ASSETS } from '@/lib/apis/correlation'

// ISR: regenerated at most every 3600s (macro/central-bank/daily-flow data). Without this the route was
// prerendered at build and served build-time data forever.
export const revalidate = 3600

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])

export async function GET() {
  try {
    const data = await withTimeout(getCorrelationMatrix(), 10000)
    return NextResponse.json({ data, assets: ASSETS })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
