/** @type {import('next').NextConfig} */
const webpack = require('webpack')

// Report-only for now: built from what the browser actually loads (see
// FULL_APP_TEST_REPORT.md). 'unsafe-inline' scripts: Next's bootstrap and the
// theme-init script are inline; enforcing later would need nonces or hashes.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://server.arcgisonline.com https://i.ytimg.com https://disease.sh https://s3-eu-west-1.amazonaws.com https://images.data.gov.sg https://weathercam.digitraffic.fi https://tdcctv.data.one.gov.hk https://cwwp2.dot.ca.gov",
  "connect-src 'self' https://api.exchangerate-api.com wss://stream.binance.com:9443",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
  "media-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // Enforced, but ONLY frame-ancestors (report-only CSP ignores that directive).
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // No feature uses geolocation either, so it is off too.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), payment=(), usb=(), geolocation=()' },
]

const nextConfig = {
  poweredByHeader: false,
  compress: true,
  swcMinify: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['yahoo-finance2', 'prisma', '@prisma/client', 'rss-parser', 'bcryptjs'],
  },
  // No page uses next/image (all images are plain <img>), so the optimizer
  // (/_next/image) has nothing to do: turning it off removes that surface
  // (Next.js image-optimizer DoS advisory) and the remote host allow-lists.
  images: { unoptimized: true },
  async headers() {
    return [
      // Security headers on every route. HSTS is not set here: Vercel already sends
      // max-age=63072000; includeSubDomains; preload on every response.
      { source: '/:path*', headers: SECURITY_HEADERS },
      // /godmode embeds /map in a same-origin iframe, so /map alone may be framed by
      // this site (still never by another one). Later rules override earlier ones.
      { source: '/map', headers: [
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
      ] },
      // Ensure UTF-8 charset for all HTML pages
      {
        source: '/((?!api|_next|favicon|sw\\.js|manifest\\.json).*)',
        headers: [{ key: 'Content-Type', value: 'text/html; charset=utf-8' }],
      },
      // Fast-changing data
      { source: '/api/flights',       headers: [{ key: 'Cache-Control', value: 's-maxage=10, stale-while-revalidate=20' }] },
      { source: '/api/crypto',        headers: [{ key: 'Cache-Control', value: 's-maxage=30, stale-while-revalidate=60' }] },
      { source: '/api/stocks',        headers: [{ key: 'Cache-Control', value: 's-maxage=30, stale-while-revalidate=60' }] },
      { source: '/api/india/indices', headers: [{ key: 'Cache-Control', value: 's-maxage=30, stale-while-revalidate=60' }] },
      { source: '/api/india/stocks',  headers: [{ key: 'Cache-Control', value: 's-maxage=30, stale-while-revalidate=60' }] },
      { source: '/api/india/crypto',  headers: [{ key: 'Cache-Control', value: 's-maxage=30, stale-while-revalidate=60' }] },
      { source: '/api/forex',         headers: [{ key: 'Cache-Control', value: 's-maxage=60, stale-while-revalidate=120' }] },
      { source: '/api/commodities',   headers: [{ key: 'Cache-Control', value: 's-maxage=60, stale-while-revalidate=120' }] },
      { source: '/api/earthquakes',   headers: [{ key: 'Cache-Control', value: 's-maxage=60, stale-while-revalidate=120' }] },
      // Medium-changing data
      { source: '/api/news',          headers: [{ key: 'Cache-Control', value: 's-maxage=300, stale-while-revalidate=600' }] },
      { source: '/api/macro',         headers: [{ key: 'Cache-Control', value: 's-maxage=300, stale-while-revalidate=600' }] },
      { source: '/api/india/news',    headers: [{ key: 'Cache-Control', value: 's-maxage=300, stale-while-revalidate=600' }] },
      { source: '/api/fear-radar',    headers: [{ key: 'Cache-Control', value: 's-maxage=300, stale-while-revalidate=600' }] },
      { source: '/api/weather',       headers: [{ key: 'Cache-Control', value: 's-maxage=600, stale-while-revalidate=1200' }] },
      // Slow-changing data
      { source: '/api/insiders',      headers: [{ key: 'Cache-Control', value: 's-maxage=1800, stale-while-revalidate=3600' }] },
      { source: '/api/calendar',      headers: [{ key: 'Cache-Control', value: 's-maxage=3600, stale-while-revalidate=7200' }] },
      { source: '/api/correlation',   headers: [{ key: 'Cache-Control', value: 's-maxage=14400, stale-while-revalidate=28800' }] },
      // Sheets API: keyed by a per-user secret in the URL, so NO shared caching —
      // a CDN-cached 200 kept a regenerated (revoked) key working for ~90s. The
      // routes cache upstream data in-process, after the key check.
      { source: '/api/public/gv',         headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
      { source: '/api/public/gv-history', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
      // Public, unauthenticated, no key — CDN caching here is deliberate.
      { source: '/api/public/ticker',     headers: [{ key: 'Cache-Control', value: 's-maxage=60, stale-while-revalidate=120' }] },
      // NO catch-all for /api/:path*. It used to set s-maxage=60 on EVERY API
      // route, including the session-scoped ones. s-maxage targets shared caches,
      // and Vercel's CDN keys on URL + Vary — which carries no Cookie — so two
      // signed-in users hitting /api/portfolio shared one cache entry. Caching is
      // opt-in per route above, so a route added later cannot silently inherit it.

    ]
  },
  webpack: (config, { isServer }) => {
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
    })

    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^(@std\/testing|@gadicc\/fetch-mock-cache)/,
      })
    )

    config.module.rules.push({
      test: /yahoo-finance2.*tests.*fetchCache/,
      use: 'null-loader',
    })

    return config
  }
}

module.exports = nextConfig
