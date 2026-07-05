/** @type {import('next').NextConfig} */
const webpack = require('webpack')

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['yahoo-finance2', 'prisma', '@prisma/client', 'rss-parser'],
  },
  images: {
    domains: [
      'images.coingecko.com',
      'logos.covalenthq.com',
      'static.coingecko.com',
      'assets.coingecko.com',
      'coin-images.coingecko.com'
    ],
    remotePatterns: [
      { protocol: 'https', hostname: '**.coingecko.com' },
      { protocol: 'https', hostname: '**.githubusercontent.com' },
    ]
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 's-maxage=30, stale-while-revalidate=60' }]
      }
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
