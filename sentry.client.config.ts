/**
 * Sentry Client-Side Configuration
 * Captures errors and performance data from the browser
 */

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Only initialize Sentry if DSN is configured
if (SENTRY_DSN) {
    Sentry.init({
        dsn: SENTRY_DSN,

        // Environment detection
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || 'development',

        // Release tracking
        release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'local',

        // Performance monitoring
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

        // Session replay (captures user interactions before errors)
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,

        // Integrations
        integrations: [
            Sentry.replayIntegration({
                maskAllText: true,
                blockAllMedia: true,
            }),
            Sentry.browserTracingIntegration(),
        ],

        // Ignore common non-actionable errors
        ignoreErrors: [
            // Network errors
            'Failed to fetch',
            'NetworkError',
            'Network request failed',
            'Load failed',
            // Browser extension errors
            /^chrome-extension:\/\//,
            /^moz-extension:\/\//,
            // User-initiated navigation
            'AbortError',
            'ResizeObserver loop',
            // Third party errors
            'Script error.',
        ],

        // Only send errors from our domain
        allowUrls: [
            /https?:\/\/(www\.)?wealthontrack\.app/,
            /https?:\/\/.*\.vercel\.app/,
            /localhost/,
        ],

        // Scrub sensitive data
        beforeSend(event, hint) {
            // Don't send events in development unless explicitly enabled
            if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEBUG) {
                return null;
            }

            // Scrub potential PII from breadcrumbs
            if (event.breadcrumbs) {
                event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
                    // Remove potential sensitive data from URLs
                    if (breadcrumb.data?.url) {
                        try {
                            const url = new URL(breadcrumb.data.url);
                            // Remove tokens/secrets from query params
                            ['token', 'key', 'secret', 'password', 'auth'].forEach(param => {
                                url.searchParams.delete(param);
                            });
                            breadcrumb.data.url = url.toString();
                        } catch {
                            // Invalid URL, leave as-is
                        }
                    }
                    return breadcrumb;
                });
            }

            return event;
        },

        // Custom tags for filtering
        initialScope: {
            tags: {
                app: 'wealth-on-track',
                platform: 'web',
            },
        },
    });
}
