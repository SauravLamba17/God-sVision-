import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Every handler here reads the owner from the SESSION, never from the request
// body or query. Before this, GET ran findMany() with no where clause and no
// session check (so any signed-in user received every user's transactions),
// POST stored rows with no owner at all, and DELETE deleted by id alone (so any
// signed-in user could delete anyone's row by guessing a sequential integer id).
const PRIVATE: Record<string, string> = { 'Cache-Control': 'private, no-store' }

function unauthorized() {
  return NextResponse.json({ error: 'Sign in required' }, { status: 401, headers: PRIVATE })
}

async function requireUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  return (session?.user as any)?.id ?? null
}

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return unauthorized()

  try {
    const txs = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json({ data: txs }, { headers: PRIVATE })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: PRIVATE })
  }
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return unauthorized()

  const { ticker, type, quantity, price, date, fee, notes } = await req.json()
  if (!ticker || !type || !quantity || !price) {
    return NextResponse.json({ error: 'ticker, type, quantity, price required' }, { status: 400, headers: PRIVATE })
  }
  try {
    const tx = await prisma.transaction.create({
      // userId comes from the session only — a client-supplied userId in the
      // body is ignored, since it is not destructured above.
      data: {
        userId,
        ticker: ticker.toUpperCase(),
        type: type.toUpperCase(),
        quantity: parseFloat(quantity),
        price: parseFloat(price),
        date: new Date(date || new Date()),
        fee: parseFloat(fee || 0),
        notes: notes || '',
      },
    })
    return NextResponse.json({ data: tx }, { headers: PRIVATE })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: PRIVATE })
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return unauthorized()

  const id = parseInt(req.nextUrl.searchParams.get('id') ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400, headers: PRIVATE })

  try {
    // deleteMany with BOTH id and userId in the filter: ownership is enforced by
    // the database in the same statement that deletes, so there is no window
    // between an ownership read and the delete. count === 0 means the row either
    // does not exist or is not this user's — both answer 403 so the response
    // cannot be used to probe which ids exist.
    const { count } = await prisma.transaction.deleteMany({ where: { id, userId } })
    if (count === 0) {
      return NextResponse.json({ error: 'Not found or not yours' }, { status: 403, headers: PRIVATE })
    }
    return NextResponse.json({ success: true }, { headers: PRIVATE })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: PRIVATE })
  }
}
