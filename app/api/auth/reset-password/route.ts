import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Token and new password required' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

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

    await prisma.user.update({
      where: { email: resetToken.email },
      data: { password: hashedPassword },
    });

    await prisma.passwordResetToken.update({
      where: { token },
      data: { used: true },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[Reset Password] Error:', e);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
