import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Returns the shared GV_SHEETS_API_KEY, but only to signed-in users —
// keeps it out of view for anonymous visitors to /sheets.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  const key = process.env.GV_SHEETS_API_KEY ?? 'godsvision-demo-key';
  return NextResponse.json({ key });
}
