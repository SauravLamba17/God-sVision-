/** @type {import('next').NextConfig} */
const webpack = require('webpack')

const nextConfig = {
  poweredByHeader: false,
  // Copies Vercel's build-time VERCEL_ENV into a NEXT_PUBLIC_ var so
  // isVercelProduction() in lib/utils.ts works in client components too.
  // Unset locally -> 'development', so gated features stay on in `npm run dev`.
  env: {
    NEXT_PUBLIC_DEPLOY_ENV: process.env.VERCEL_ENV ?? 'development',
  },
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
      // Default for all other API routes
      { source: '/api/:path*',        headers: [{ key: 'Cache-Control', value: 's-maxage=60, stale-while-revalidate=120' }] },
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
