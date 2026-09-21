import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

// Session-scoped: never store this in a shared cache. Belt-and-braces alongside
// next.config.js no longer setting s-maxage on /api/:path*.
const PRIVATE: Record<string, string> = { 'Cache-Control': 'private, no-store' }


export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: PRIVATE });

  const userId = (session.user as any).id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.stripeCustomerId) return NextResponse.json({ error: 'No billing account found' }, { status: 404, headers: PRIVATE });

  const origin = req.headers.get('origin') ?? 'http://localhost:3001';
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${origin}/pricing`,
  });

  return NextResponse.json({ url: portalSession.url }, { headers: PRIVATE });
}
