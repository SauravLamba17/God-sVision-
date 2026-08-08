import { NextResponse } from 'next/server';
import { isRedisAvailable } from '@/lib/cache';

export async function GET() {
  return NextResponse.json({
    redis: isRedisAvailable() ? 'connected' : 'not configured (using in-memory fallback only)',
    timestamp: new Date().toISOString(),
  });
}
