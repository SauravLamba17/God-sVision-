import { NextResponse } from 'next/server'
import { getDashboardOverview } from '@/lib/apis/overview'

export const revalidate = 60

export async function GET() {
  const { data, source } = await getDashboardOverview()
  return NextResponse.json({ data, source })
}
