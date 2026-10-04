import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hashSheetsKey, newSheetsKey } from '@/lib/sheetsKey';

// Session-scoped: never store this in a shared cache. Belt-and-braces alongside
// next.config.js no longer setting s-maxage on /api/:path*.
const PRIVATE: Record<string, string> = { 'Cache-Control': 'private, no-store' }

const userId = async () => {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.id as string | undefined;
};

const unauthorized = () => NextResponse.json({ error: 'Sign in required' }, { status: 401, headers: PRIVATE });

// The user's own Sheets API key. Created on first request and returned raw
// exactly once; after that only { hasKey, createdAt } — we keep just the hash.
export async function GET() {
  const id = await userId();
  if (!id) return unauthorized();

  const key = newSheetsKey();
  const createdAt = new Date();
  // Only claims the slot if no key exists, so two concurrent first loads can't
  // each be shown a different key with only the second one valid.
  const { count } = await prisma.user.updateMany({
    where: { id, sheetsKeyHash: null },
    data: { sheetsKeyHash: hashSheetsKey(key).toString('hex'), sheetsKeyCreatedAt: createdAt },
  });
  if (count === 1) return NextResponse.json({ key, createdAt, hasKey: true }, { headers: PRIVATE });

  const user = await prisma.user.findUnique({ where: { id }, select: { sheetsKeyCreatedAt: true } });
  if (!user) return unauthorized();
  return NextResponse.json({ hasKey: true, createdAt: user.sheetsKeyCreatedAt }, { headers: PRIVATE });
}

// Regenerate: the old key stops working immediately.
export async function POST() {
  const id = await userId();
  if (!id) return unauthorized();

  const key = newSheetsKey();
  const createdAt = new Date();
  const { count } = await prisma.user.updateMany({
    where: { id },
    data: { sheetsKeyHash: hashSheetsKey(key).toString('hex'), sheetsKeyCreatedAt: createdAt },
  });
  if (count !== 1) return unauthorized();
  return NextResponse.json({ key, createdAt, hasKey: true }, { headers: PRIVATE });
}
