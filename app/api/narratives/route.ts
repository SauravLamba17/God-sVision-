import { NextResponse } from 'next/server'
import { detectNarratives } from '@/lib/apis/narratives'

// Backstop only; the route already self-limits via withTimeout(12000).
export const maxDuration = 30

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])

export async function GET() {
  try {
    const data = await withTimeout(detectNarratives(), 12000)
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, data: null, source: 'empty' })
  }
}
