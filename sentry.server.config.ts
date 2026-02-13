/**
 * Sentry Server-Side Configuration
 * Captures errors from API routes and server components
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

        // Performance monitoring (lower sample rate for server)
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,

        // Integrations
        integrations: [
            Sentry.prismaIntegration(),
        ],

        // Ignore common non-actionable errors
        ignoreErrors: [
            // Expected auth errors
            'UNAUTHORIZED',
            'Authentication required',
            // Rate limiting
            'RATE_LIMIT_EXCEEDED',
            // User input validation
            'VALIDATION_ERROR',
            // Expected 404s
            'NOT_FOUND',
        ],

        // Scrub sensitive data
        beforeSend(event, hint) {
            // Don't send in development
            if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEBUG) {
                return null;
            }

            // Remove sensitive headers
            if (event.request?.headers) {
                const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
                sensitiveHeaders.forEach(header => {
                    if (event.request!.headers![header]) {
                        event.request!.headers![header] = '[REDACTED]';
                    }
                });
            }

            // Remove sensitive data from extras
            if (event.extra) {
                const sensitiveKeys = ['password', 'token', 'secret', 'key', 'credential'];
                const redactObject = (obj: Record<string, unknown>): void => {
                    for (const key of Object.keys(obj)) {
                        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
                            obj[key] = '[REDACTED]';
                        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                            redactObject(obj[key] as Record<string, unknown>);
                        }
                    }
                };
                redactObject(event.extra as Record<string, unknown>);
            }

            return event;
        },

        // Custom tags
        initialScope: {
            tags: {
                app: 'wealth-on-track',
                platform: 'server',
            },
        },
    });
}
