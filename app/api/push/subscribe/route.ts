import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { parseBody } from '@/lib/validation';
import { checkLimits, LIMITS, tooManyRequests } from '@/lib/rateLimit';

const Body = z.object({
  endpoint: z.string().url().startsWith('https://', 'endpoint must be https').max(2048),
  keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(128) }),
});

// Session-scoped: never store this in a shared cache. Belt-and-braces alongside
// next.config.js no longer setting s-maxage on /api/:path*.
const PRIVATE: Record<string, string> = { 'Cache-Control': 'private, no-store' }

type PushKeys = { p256dh: string; auth: string }

// Only the browser that owns a push subscription holds its encryption keys, so
// matching keys prove the caller is that device — not just someone who learned
// the endpoint URL.
function sameKeys(stored: unknown, submitted: PushKeys): boolean {
  const s = stored as Partial<PushKeys> | null
  if (!s?.p256dh || !s?.auth) return false
  const digest = (k: PushKeys) => crypto.createHash('sha256').update(`${k.p256dh}|${k.auth}`).digest()
  return crypto.timingSafeEqual(digest({ p256dh: s.p256dh, auth: s.auth }), digest(submitted))
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id ?? null;
    if (!userId) return NextResponse.json({ error: 'Sign in required' }, { status: 401, headers: PRIVATE });

    const parsed = await parseBody(req, Body, PRIVATE);
    if (parsed.error) return parsed.error;
    const rl = await checkLimits([LIMITS.writes(userId)]);
    if (!rl.ok) return tooManyRequests(rl.retryAfter, 'changes', PRIVATE);
    const { endpoint, keys } = parsed.data;
    const submitted: PushKeys = { p256dh: keys.p256dh, auth: keys.auth };

    const existing = await prisma.pushSubscription.findUnique({ where: { endpoint } });
    if (!existing) {
      await prisma.pushSubscription.create({ data: { endpoint, keys: submitted, userId } });
    } else if (existing.userId === userId) {
      await prisma.pushSubscription.update({ where: { endpoint }, data: { keys: submitted } });
    } else if (sameKeys(existing.keys, submitted)) {
      // Same device, different account signed in (shared browser): move it.
      await prisma.pushSubscription.update({ where: { endpoint }, data: { userId } });
    } else {
      // Endpoint known, keys not: not this device. Leave the owner's row alone.
      return NextResponse.json({ error: 'This push subscription belongs to another account' }, { status: 409, headers: PRIVATE });
    }

    return NextResponse.json({ success: true }, { headers: PRIVATE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: PRIVATE });
  }
}
