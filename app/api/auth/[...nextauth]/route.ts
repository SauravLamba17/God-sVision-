import NextAuth from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { checkLimits, LIMITS, clientIp } from '@/lib/rateLimit';

const handler = NextAuth(authOptions);

// Rate-limits credential sign-in attempts (per IP, and per email when the form
// carries one) WITHOUT touching lib/auth.ts. Every other NextAuth request — GET,
// sign-out, session, CSRF, OAuth callbacks — passes straight through unchanged.
async function POST(req: NextRequest, ctx: { params: { nextauth: string[] } }) {
  if (req.nextUrl.pathname.endsWith('/callback/credentials')) {
    // Read a clone so NextAuth still gets the untouched body.
    const form = await req.clone().formData().catch(() => null);
    const email = form?.get('email');
    const limits = [LIMITS.signInIp(clientIp(req))];
    if (typeof email === 'string' && email) limits.push(LIMITS.signInEmail(email));

    const rl = await checkLimits(limits);
    if (!rl.ok) {
      // Same JSON shape NextAuth replies with, so next-auth/react's signIn()
      // resolves { ok: false, error: 'TooManyAttempts' } instead of throwing.
      const url = new URL('/api/auth/error?error=TooManyAttempts', req.url).toString();
      return NextResponse.json(
        { url, error: 'Too many sign-in attempts. Try again later.', retryAfterSeconds: rl.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
      );
    }
  }
  return handler(req, ctx);
}

export { handler as GET, POST };
