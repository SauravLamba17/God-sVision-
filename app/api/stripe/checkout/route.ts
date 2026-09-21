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
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404, headers: PRIVATE });

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email ?? undefined, name: user.name ?? undefined });
    customerId = customer.id;
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
  }

  const origin = req.headers.get('origin') ?? 'http://localhost:3001';
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID!, quantity: 1 }],
    success_url: `${origin}/pricing?success=1`,
    cancel_url: `${origin}/pricing?canceled=1`,
    metadata: { userId },
  });

  return NextResponse.json({ url: checkoutSession.url }, { headers: PRIVATE });
}
