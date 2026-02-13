/**
 * Sentry Edge Runtime Configuration
 * Captures errors from middleware and edge functions
 */

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Only initialize Sentry if DSN is configured
if (SENTRY_DSN) {
    Sentry.init({
        dsn: SENTRY_DSN,

        // Environment detection
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',

        // Release tracking
        release: process.env.VERCEL_GIT_COMMIT_SHA || 'local',

        // Performance monitoring (minimal for edge)
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0.5,

        // Ignore common errors
        ignoreErrors: [
            'UNAUTHORIZED',
            'RATE_LIMIT_EXCEEDED',
        ],

        // Scrub sensitive data
        beforeSend(event) {
            if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEBUG) {
                return null;
            }
            return event;
        },

        initialScope: {
            tags: {
                app: 'wealth-on-track',
                platform: 'edge',
            },
        },
    });
}
