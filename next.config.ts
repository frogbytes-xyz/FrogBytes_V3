import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb'
    },
    // Improve build stability and reduce file system conflicts
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js'
        }
      }
    }
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;"
  },
  // Skip static export for dynamic pages
  output: 'standalone',
  // Improve build stability and reduce file system conflicts
  generateBuildId: async () => {
    // Use timestamp-based build ID to prevent manifest conflicts
    return `build-${Date.now()}`
  },
  // Instrumentation is enabled by default in Next.js 15+
  // The instrumentation.ts file will be automatically picked up
  webpack: (config, { isServer }) => {
    // Only apply these configurations for server-side builds
    if (isServer) {
      // Handle dynamic imports for puppeteer-extra and related packages
      config.externals = config.externals || []
      config.externals.push({
        'puppeteer-extra': 'commonjs puppeteer-extra',
        'puppeteer-extra-plugin-stealth':
          'commonjs puppeteer-extra-plugin-stealth',
        puppeteer: 'commonjs puppeteer'
      })

      // Handle dynamic imports for browser automation packages
      config.resolve = config.resolve || {}
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false
      }
    }

    // Ignore warnings about dynamic require() calls in problematic packages
    config.ignoreWarnings = config.ignoreWarnings || []
    config.ignoreWarnings.push({
      module: /node_modules\/clone-deep\/utils\.js$/,
      message: /Cannot statically analyse 'require\(…, …\)'/
    })

    // Add file system stability improvements
    config.watchOptions = {
      ...config.watchOptions,
      // Reduce file system polling to prevent conflicts
      poll: 1000,
      aggregateTimeout: 300,
      ignored: [
        '**/node_modules/**',
        '**/.next/**',
        '**/tmp/**',
        '**/coverage/**',
        '**/test-results/**',
        '**/playwright-report/**'
      ]
    }

    // Improve build performance and reduce file system conflicts
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        ...config.optimization?.splitChunks,
        cacheGroups: {
          ...config.optimization?.splitChunks?.cacheGroups,
          // Separate vendor chunks to reduce manifest conflicts
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10
          }
        }
      }
    }

    return config
  }
}

export default nextConfig
