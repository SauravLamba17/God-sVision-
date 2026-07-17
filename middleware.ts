import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// Hard login gate: every route requires a signed-in session EXCEPT the auth
// pages themselves, NextAuth's own API, the public Sheets API (own key auth),
// the Stripe webhook (called by Stripe with no session), and static assets.
export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Public paths that never require auth
    const publicPaths = [
      '/auth/signin',
      '/auth/register',
      '/auth/error',
      '/api/auth',            // NextAuth's own API routes (+ /api/auth/register)
      '/api/public',          // Google Sheets public API (uses its own key auth)
      '/api/stripe/webhook',  // Stripe calls this server-to-server, no session
      '/sw.js',
      '/favicon.svg',
      '/favicon.ico',
      '/manifest.json',
    ];

    const isPublicPath = publicPaths.some(p => path === p || path.startsWith(p + '/') || path.startsWith(p));

    if (!token && !isPublicPath) {
      const signInUrl = new URL('/auth/signin', req.url);
      signInUrl.searchParams.set('callbackUrl', path);
      return NextResponse.redirect(signInUrl);
    }

    return NextResponse.next();
  },
  {
    // Let the middleware function above own all redirect logic.
    callbacks: { authorized: () => true },
  }
);

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
