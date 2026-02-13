import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Next.js Configuration - Production-Optimized
 * - Advanced bundle splitting for faster loads
 * - Image optimization with aggressive caching
 * - Security-focused headers
 * - Memory-efficient settings for Vercel
 * - Sentry error tracking integration
 */

const nextConfig: NextConfig = {
    experimental: {
        // Tree-shake package imports for smaller bundles
        optimizePackageImports: [
            'lucide-react',
            'recharts',
            '@dnd-kit/core',
            '@dnd-kit/sortable',
            'framer-motion',
            'date-fns',
        ],
    },

    // Image optimization
    images: {
        formats: ['image/avif', 'image/webp'],
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
        imageSizes: [16, 32, 48, 64, 96, 128, 256],
        minimumCacheTTL: 3600, // 1 hour (increased from 60s)
        remotePatterns: [
            { protocol: 'https', hostname: 'assets.coincap.io' },
            { protocol: 'https', hostname: 'img.icons8.com' },
            { protocol: 'https', hostname: 'img.logo.dev' },
            { protocol: 'https', hostname: 'cdn.jsdelivr.net' },
            { protocol: 'https', hostname: 'assets.parqet.com' },
            { protocol: 'https', hostname: 'media.licdn.com' },
        ],
        // Disable blur placeholder for faster initial load
        dangerouslyAllowSVG: true,
        contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    },

    // Compression (handled by Vercel in production)
    compress: true,

    // Production optimizations
    poweredByHeader: false,
    reactStrictMode: true,

    // Reduce memory usage in serverless
    output: 'standalone',

    // Webpack optimizations
    webpack: (config, { isServer, dev }) => {
        // Client-side optimizations only
        if (!isServer) {
            config.optimization = {
                ...config.optimization,
                // Module concatenation for smaller bundles
                concatenateModules: true,
                splitChunks: {
                    chunks: 'all',
                    maxInitialRequests: 25,
                    minSize: 20000,
                    cacheGroups: {
                        default: false,
                        vendors: false,
                        // Framework chunk (React, Next.js)
                        framework: {
                            name: 'framework',
                            chunks: 'all',
                            test: /[\\/]node_modules[\\/](react|react-dom|next|scheduler)[\\/]/,
                            priority: 40,
                            enforce: true,
                        },
                        // Charts library (heavy, load separately)
                        charts: {
                            name: 'charts',
                            test: /[\\/]node_modules[\\/](recharts|d3-.*)[\\/]/,
                            chunks: 'all',
                            priority: 35,
                        },
                        // UI libraries
                        ui: {
                            name: 'ui',
                            test: /[\\/]node_modules[\\/](framer-motion|@dnd-kit|lucide-react)[\\/]/,
                            chunks: 'all',
                            priority: 30,
                        },
                        // Other vendor code
                        vendor: {
                            name: 'vendor',
                            test: /[\\/]node_modules[\\/]/,
                            chunks: 'all',
                            priority: 20,
                        },
                        // Shared code between pages
                        common: {
                            name: 'common',
                            minChunks: 2,
                            chunks: 'all',
                            priority: 10,
                            reuseExistingChunk: true,
                        },
                    },
                },
            };

            // Production-only: minimize bundle size
            if (!dev) {
                config.optimization.minimize = true;
            }
        }

        // Server-side: exclude unnecessary dependencies
        if (isServer) {
            config.externals = config.externals || [];
        }

        return config;
    },

    // Headers for caching and security
    async headers() {
        return [
            // Static assets - aggressive caching (1 year)
            {
                source: '/:all*(svg|jpg|png|webp|avif|ico|woff|woff2)',
                locale: false,
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
                ],
            },
            // Next.js static files
            {
                source: '/_next/static/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
                ],
            },
            // API routes - no caching by default
            {
                source: '/api/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'no-store, must-revalidate' },
                ],
            },
            // HTML pages - short cache with revalidation
            {
                source: '/:path*',
                headers: [
                    { key: 'X-DNS-Prefetch-Control', value: 'on' },
                ],
            },
        ];
    },

    // Environment variables
    env: {
        NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA || 'local-dev',
        NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV || 'development',
        NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    },

    // Logging configuration
    logging: {
        fetches: {
            fullUrl: process.env.NODE_ENV === 'development',
        },
    },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
    // Organization and project settings (set via env vars)
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,

    // Only upload source maps in production builds
    silent: !process.env.CI,

    // Upload source maps for better error tracking
    widenClientFileUpload: true,

    // Automatically tree-shake Sentry logger statements
    disableLogger: true,

    // Hide source content from being uploaded
    hideSourceMaps: true,

    // Prevent build failures if source map upload fails
    automaticVercelMonitors: true,
};

// Export with Sentry wrapper (only if DSN is configured)
const finalConfig = process.env.NEXT_PUBLIC_SENTRY_DSN
    ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
    : nextConfig;

export default finalConfig;
