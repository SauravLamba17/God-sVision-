import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    const authRequiredPaths = ['/portfolio', '/alerts', '/settings'];
    if (authRequiredPaths.some(p => path.startsWith(p)) && !token) {
      return NextResponse.redirect(new URL('/auth/signin?from=' + path, req.url));
    }
    return NextResponse.next();
  },
  { callbacks: { authorized: () => true } }
);

export const config = {
  matcher: [
    '/portfolio/:path*',
    '/alerts/:path*',
    '/settings/:path*',
  ],
};
