import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id ?? null
    const holdings = await prisma.portfolioHolding.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ data: holdings })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'DB error'
    return NextResponse.json({ error: msg })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id ?? null
    const body = await request.json()
    const { ticker, name, quantity, buyPrice, buyDate } = body
    const holding = await prisma.portfolioHolding.create({
      data: {
        ticker: ticker.toUpperCase(), name,
        quantity: parseFloat(quantity), buyPrice: parseFloat(buyPrice),
        buyDate: new Date(buyDate), userId,
      },
    })
    return NextResponse.json({ data: holding })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'DB error'
    return NextResponse.json({ error: msg })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id ?? null
    const { searchParams } = new URL(request.url)
    const id = parseInt(searchParams.get('id') || '0')
    await prisma.portfolioHolding.deleteMany({ where: { id, userId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'DB error'
    return NextResponse.json({ error: msg })
  }
}
