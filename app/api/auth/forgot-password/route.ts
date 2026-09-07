import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resend } from '@/lib/resend';
import crypto from 'crypto';

// ponytail: used/expired PasswordResetToken rows are never purged. Harmless
// (extra rows only, no functional impact) — add a scheduled cleanup job if the
// table ever grows enough to matter.
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // Always return success regardless of whether the email exists, so this
    // endpoint can't be used to enumerate which emails are registered.
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.passwordResetToken.create({
        data: { email, token, expiresAt },
      });

      const base = process.env.NEXTAUTH_URL || new URL(req.url).origin;
      const resetUrl = `${base}/auth/reset-password?token=${token}`;

      if (resend) {
        await resend.emails.send({
          from: 'GOD\'s Vision <alerts@resend.dev>',
          to: email,
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
        });
      } else {
        console.warn('[Forgot Password] Resend not configured, cannot send email. Reset URL:', resetUrl);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with that email, a reset link has been sent.',
    });
  } catch (e: any) {
    console.error('[Forgot Password] Error:', e);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
