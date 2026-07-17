import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const groupId = searchParams.get('groupId')

  try {
    if (groupId) {
      const group = await prisma.watchlistGroup.findUnique({
        where: { id: parseInt(groupId) },
        include: { items: { orderBy: { addedAt: 'asc' } } },
      })
      return NextResponse.json({ data: group })
    }
    const groups = await prisma.watchlistGroup.findMany({
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ data: groups })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'DB error'
    return NextResponse.json({ error: msg })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'createGroup') {
      const group = await prisma.watchlistGroup.create({ data: { name: body.name } })
      return NextResponse.json({ data: group })
    }

    if (action === 'addItem') {
      const item = await prisma.watchlistItem.create({
        data: { groupId: parseInt(body.groupId), ticker: body.ticker.toUpperCase(), notes: body.notes || '' },
      })
      return NextResponse.json({ data: item })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'DB error'
    return NextResponse.json({ error: msg })
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const groupId = searchParams.get('groupId')
  const itemId  = searchParams.get('itemId')

  try {
    if (itemId) {
      await prisma.watchlistItem.delete({ where: { id: parseInt(itemId) } })
    } else if (groupId) {
      await prisma.watchlistGroup.delete({ where: { id: parseInt(groupId) } })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'DB error'
    return NextResponse.json({ error: msg })
  }
}
