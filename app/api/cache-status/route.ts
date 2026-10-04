import { NextResponse } from 'next/server';
import { isRedisAvailable } from '@/lib/cache';

// ISR: regenerated at most every 21600s (slow reference data). Without this the route was
// prerendered at build and served build-time data forever.
export const revalidate = 21600

export async function GET() {
  return NextResponse.json({
    redis: isRedisAvailable() ? 'connected' : 'not configured (using in-memory fallback only)',
    timestamp: new Date().toISOString(),
  });
}
