import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export async function GET() {
  try {
    const txs = await prisma.transaction.findMany({ orderBy: { date: 'desc' } })
    return NextResponse.json({ data: txs })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}

export async function POST(req: NextRequest) {
  const { ticker, type, quantity, price, date, fee, notes } = await req.json()
  if (!ticker || !type || !quantity || !price) {
    return NextResponse.json({ error: 'ticker, type, quantity, price required' }, { status: 400 })
  }
  try {
    const tx = await prisma.transaction.create({
      data: { ticker: ticker.toUpperCase(), type: type.toUpperCase(), quantity: parseFloat(quantity), price: parseFloat(price), date: new Date(date || new Date()), fee: parseFloat(fee || 0), notes: notes || '' },
    })
    return NextResponse.json({ data: tx })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}

export async function DELETE(req: NextRequest) {
  const id = parseInt(req.nextUrl.searchParams.get('id') ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    await prisma.transaction.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
