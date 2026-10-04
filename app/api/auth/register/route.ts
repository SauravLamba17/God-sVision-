import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { parseBody } from '@/lib/validation';
import { checkLimits, LIMITS, clientIp, tooManyRequests } from '@/lib/rateLimit';

// Email is stored as typed (sign-in matches it exactly), so validate, don't normalize.
const Body = z.object({
  email: z.string().email('invalid email').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be at most 128 characters'),
  name: z.string().trim().max(100).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rl = await checkLimits([LIMITS.registerIp(clientIp(req))]);
    if (!rl.ok) return tooManyRequests(rl.retryAfter, 'sign-up attempts');

    const parsed = await parseBody(req, Body);
    if (parsed.error) return parsed.error;
    const { email, password, name } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 409 });

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: hashed, name: name || email.split('@')[0], plan: 'free' },
      select: { id: true, email: true, name: true, plan: true },
    });
    return NextResponse.json({ data: user });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
