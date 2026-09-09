import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';

// Hard login gate: every route requires a signed-in session EXCEPT the public
// landing page at '/', the auth pages themselves, NextAuth's own API, the
// public Sheets API (own key auth), the Stripe webhook (called by Stripe with
// no session), and static assets.
//
// This is deny-by-default: the matcher below runs on everything not excluded
// there, and anything not matched by the two allow-lists needs a token. The
// dashboard at '/dashboard' is therefore protected without an explicit entry,
// exactly as '/' was before it moved.
//
// This runs in the Edge Runtime, so it deliberately imports ONLY getToken()
// from next-auth/jwt — a lightweight cookie read + JWT signature verify. It
// must never import lib/auth.ts (which pulls in PrismaAdapter/bcryptjs) or
// anything else Node-only, and never invoke the NextAuth callback chain.
// Paths that are public as an EXACT match only. '/' lives here and MUST NOT be
// moved into publicPaths below: that list is matched with startsWith(), so a
// '/' entry there would make every route in the app public.
const publicExactPaths = new Set([
  '/',                    // the marketing landing page
]);

const publicPaths = [
  '/auth',                // all auth pages: signin, register, error,
                          // forgot-password, reset-password
  '/api/auth',            // NextAuth's own API routes (+ /api/auth/register)
  '/api/public',          // Google Sheets public API (uses its own key auth)
  '/api/stripe/webhook',  // Stripe calls this server-to-server, no session
  '/sw.js',
  '/favicon.svg',
  '/favicon.ico',
  '/manifest.json',
];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (publicExactPaths.has(path) || publicPaths.some(p => path.startsWith(p))) {
    return NextResponse.next();
  }

  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      const signInUrl = new URL('/auth/signin', req.url);
      signInUrl.searchParams.set('callbackUrl', path);
      return NextResponse.redirect(signInUrl);
    }

    return NextResponse.next();
  } catch (e) {
    // Never let a token-verification error take the whole site down with
    // MIDDLEWARE_INVOCATION_FAILED — fail safe to the sign-in page instead.
    // Most likely trigger: NEXTAUTH_SECRET missing/mismatched in the
    // deployment environment.
    console.error('[Middleware] Token verification error:', e);
    const signInUrl = new URL('/auth/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', path);
    return NextResponse.redirect(signInUrl);
  }
}

export const config = {
  matcher: [
    /*
     * Run on all paths EXCEPT:
     * - _next/static, _next/image (build assets / image optimizer)
     * - favicon.ico, favicon.svg, manifest.json, sw.js (static root files)
     * - api/auth (NextAuth routes, incl. /api/auth/register)
     * - api/public (public Sheets API with its own key auth)
     * - api/stripe/webhook (Stripe server-to-server callback)
     */
    '/((?!_next/static|_next/image|favicon.ico|favicon.svg|manifest.json|sw.js|api/auth|api/public|api/stripe/webhook).*)',
  ],
};
