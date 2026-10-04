import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { hashResetToken } from '@/lib/resetToken';

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Token and new password required' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    if (typeof token !== 'string') {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }
    // The DB holds only SHA-256(token); hash the submitted raw token to look it up.
    const tokenHash = hashResetToken(token);
    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token: tokenHash } });

    if (!resetToken) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }
    if (resetToken.used) {
      return NextResponse.json({ error: 'This reset link has already been used' }, { status: 400 });
    }
    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json({ error: 'This reset link has expired' }, { status: 400 });
    }

    // Same cost factor as registration (app/api/auth/register/route.ts).
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Rows for unknown emails exist only as rate-limit records (their raw token
    // was never sent), so there may be no matching user.
    const updated = await prisma.user.updateMany({
      where: { email: resetToken.email },
      data: { password: hashedPassword },
    });
    if (updated.count !== 1) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }

    await prisma.passwordResetToken.update({
      where: { token: tokenHash },
      data: { used: true },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[Reset Password] Error:', e);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
