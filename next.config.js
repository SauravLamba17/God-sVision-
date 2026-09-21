/** @type {import('next').NextConfig} */
const webpack = require('webpack')

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
  images: {
    domains: [
      'images.coingecko.com',
      'logos.covalenthq.com',
      'static.coingecko.com',
      'assets.coingecko.com',
      'coin-images.coingecko.com',
    ],
    remotePatterns: [
      { protocol: 'https', hostname: '**.coingecko.com' },
      { protocol: 'https', hostname: '**.githubusercontent.com' },
    ],
  },
  async headers() {
    return [
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
      { source: '/api/narratives',    headers: [{ key: 'Cache-Control', value: 's-maxage=900, stale-while-revalidate=1800' }] },
      // Slow-changing data
      { source: '/api/insiders',      headers: [{ key: 'Cache-Control', value: 's-maxage=1800, stale-while-revalidate=3600' }] },
      { source: '/api/calendar',      headers: [{ key: 'Cache-Control', value: 's-maxage=3600, stale-while-revalidate=7200' }] },
      { source: '/api/correlation',   headers: [{ key: 'Cache-Control', value: 's-maxage=14400, stale-while-revalidate=28800' }] },
      // Public, unauthenticated endpoints — caching here is deliberate.
      { source: '/api/public/gv',         headers: [{ key: 'Cache-Control', value: 's-maxage=30, stale-while-revalidate=60' }] },
      { source: '/api/public/gv-history', headers: [{ key: 'Cache-Control', value: 's-maxage=60, stale-while-revalidate=120' }] },
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
