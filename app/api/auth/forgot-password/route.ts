import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resend } from '@/lib/resend';
import crypto from 'crypto';
import { hashResetToken } from '@/lib/resetToken';
import { z } from 'zod';
import { parseBody } from '@/lib/validation';
import { checkLimits, LIMITS, clientIp, tooManyRequests } from '@/lib/rateLimit';

const Body = z.object({ email: z.string().trim().max(254).email('Email required') });

// ponytail: used/expired PasswordResetToken rows are never purged. Harmless
// (extra rows only, no functional impact) — add a scheduled cleanup job if the
// table ever grows enough to matter.

const MAX_REQUESTS_PER_HOUR = 3;
const WINDOW_SECONDS = 3600;
// Every response is padded to at least this long so registered and
// unregistered emails take about the same time (the registered path also
// waits on the email provider).
const MIN_RESPONSE_MS = 1500;

// Rate limit keyed on the (lowercased) email being reset, applied to EVERY
// email before any account lookup, so registered and unregistered addresses
// are throttled identically — a 429 that only real accounts could hit was an
// account-enumeration oracle. Counted off the PasswordResetToken rows
// themselves rather than Redis: lib/cache.ts keeps its Upstash client private
// and UPSTASH_REDIS_REST_URL is still the `paste_from_...` placeholder, so
// there is no configured Redis to reuse. Postgres is shared across serverless
// instances just like Redis would be, so the count is correct on Vercel where
// an in-memory counter would not be.
async function checkRateLimit(email: string): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const windowStart = new Date(Date.now() - WINDOW_SECONDS * 1000);
  // One query, not count()+findFirst(): the window holds at most
  // MAX_REQUESTS_PER_HOUR rows, because we stop creating them past the limit.
  // Insensitive match: a registered user's row stores their email as typed.
  const recent = await prisma.passwordResetToken.findMany({
    where: { email: { equals: email, mode: 'insensitive' }, createdAt: { gte: windowStart } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });

  if (recent.length >= MAX_REQUESTS_PER_HOUR) {
    // A slot frees up when the oldest request in the window ages out.
    const elapsed = Math.floor((Date.now() - recent[0].createdAt.getTime()) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, WINDOW_SECONDS - elapsed) };
  }

  return { allowed: true };
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const respond = async (body: object, init?: ResponseInit) => {
    await new Promise(r => setTimeout(r, Math.max(0, startedAt + MIN_RESPONSE_MS - Date.now())));
    return NextResponse.json(body, init);
  };
  try {
    // Per IP (on top of the per-email limit below): stops one client mailing
    // reset links to many different addresses. Says nothing about accounts.
    const ipLimit = await checkLimits([LIMITS.forgotIp(clientIp(req))]);
    if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfter, 'reset requests from this network');

    // A malformed email is rejected before any lookup — reveals nothing about accounts.
    const parsed = await parseBody(req, Body);
    if (parsed.error) return parsed.error;
    const email = parsed.data.email.toLowerCase();

    // Throttle BEFORE looking the account up (see checkRateLimit).
    const rateLimit = await checkRateLimit(email);
    if (!rateLimit.allowed) {
      return respond(
        {
          error: 'Too many reset requests. Please try again later.',
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds ?? WINDOW_SECONDS) },
        },
      );
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { email: true },
    });

    // A row is written for EVERY request: it is the rate-limit record. Only
    // the SHA-256 of the token is stored; the raw token exists only in the
    // email. For unknown emails the raw token is discarded, so that row can
    // never be redeemed.
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: {
        email: user?.email ?? email,
        token: hashResetToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    if (user?.email) {
      const base = process.env.NEXTAUTH_URL || new URL(req.url).origin;
      const resetUrl = `${base}/auth/reset-password?token=${token}`;

      if (resend) {
        // Never let a provider failure turn into a 500 that only real accounts produce.
        await resend.emails.send({
          from: 'GOD\'s Vision <alerts@resend.dev>',
          to: user.email,
          subject: 'Reset your GOD\'s Vision password',
          html: `
            <div style="font-family: 'Courier New', monospace; background: #000; color: #c8e6c9; padding: 24px; border-radius: 8px;">
              <div style="color: #ff6d00; font-size: 18px; font-weight: bold; margin-bottom: 16px;">
                GOD's VISION — PASSWORD RESET
              </div>
              <p style="font-size: 13px; line-height: 1.6;">Click the link below to reset your password. This link expires in 1 hour and can only be used once.</p>
              <a href="${resetUrl}" style="color: #ff6d00; word-break: break-all;">${resetUrl}</a>
              <p style="color: #607d8b; font-size: 11px; margin-top: 24px;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </div>
          `,
        }).catch(e => console.error('[Forgot Password] Email send failed:', e));
      } else {
        console.warn('[Forgot Password] Resend not configured, cannot send email.');
      }
    }

    return respond({
      success: true,
      message: 'If an account exists with that email, a reset link has been sent.',
    });
  } catch (e: any) {
    console.error('[Forgot Password] Error:', e);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
