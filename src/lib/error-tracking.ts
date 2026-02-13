/**
 * Error Tracking and Monitoring
 * Centralized error handling with Sentry integration
 *
 * This module provides:
 * - Sentry initialization
 * - Error capture utilities
 * - Performance monitoring
 * - User context management
 */

// ============================================
// TYPES
// ============================================

export interface ErrorContext {
    userId?: string;
    username?: string;
    action?: string;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
}

export interface PerformanceSpan {
    end: () => void;
    setStatus: (status: 'ok' | 'error') => void;
}

// ============================================
// SENTRY INITIALIZATION
// ============================================

let sentryInitialized = false;

/**
 * Initialize Sentry (call once on app startup)
 */
export async function initErrorTracking(): Promise<void> {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

    if (!dsn) {
        if (process.env.NODE_ENV === 'production') {
            console.warn('[ErrorTracking] Sentry DSN not configured - error tracking disabled');
        }
        return;
    }

    if (sentryInitialized) return;

    try {
        const Sentry = await import('@sentry/nextjs');

        Sentry.init({
            dsn,
            environment: process.env.NODE_ENV,
            tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
            debug: process.env.NODE_ENV === 'development',

            // Filter out noisy errors
            ignoreErrors: [
                'AbortError',
                'ResizeObserver loop limit exceeded',
                'Non-Error promise rejection captured',
            ],

            // Scrub sensitive data
            beforeSend(event) {
                // Remove sensitive headers
                if (event.request?.headers) {
                    delete event.request.headers['authorization'];
                    delete event.request.headers['cookie'];
                }

                // Remove sensitive query params
                if (event.request?.query_string && typeof event.request.query_string === 'string') {
                    event.request.query_string = event.request.query_string
                        .replace(/apikey=[^&]*/gi, 'apikey=[REDACTED]')
                        .replace(/token=[^&]*/gi, 'token=[REDACTED]');
                }

                return event;
            },
        });

        sentryInitialized = true;
        console.log('[ErrorTracking] Sentry initialized');
    } catch (error) {
        console.error('[ErrorTracking] Failed to initialize Sentry:', error);
    }
}

// ============================================
// ERROR CAPTURE
// ============================================

/**
 * Capture an error with context
 */
export async function captureError(
    error: Error | unknown,
    context?: ErrorContext
): Promise<void> {
    // Always log to console
    console.error('[Error]', error, context);

    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;

    try {
        const Sentry = await import('@sentry/nextjs');

        // Set user context if provided
        if (context?.userId || context?.username) {
            Sentry.setUser({
                id: context.userId,
                username: context.username,
            });
        }

        // Set tags
        if (context?.tags) {
            for (const [key, value] of Object.entries(context.tags)) {
                Sentry.setTag(key, value);
            }
        }

        // Set action tag
        if (context?.action) {
            Sentry.setTag('action', context.action);
        }

        // Capture the error
        if (error instanceof Error) {
            Sentry.captureException(error, {
                extra: context?.extra,
            });
        } else {
            Sentry.captureMessage(String(error), {
                level: 'error',
                extra: context?.extra,
            });
        }
    } catch (sentryError) {
        console.error('[ErrorTracking] Failed to capture error:', sentryError);
    }
}

/**
 * Capture a warning message
 */
export async function captureWarning(
    message: string,
    context?: ErrorContext
): Promise<void> {
    console.warn('[Warning]', message, context);

    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;

    try {
        const Sentry = await import('@sentry/nextjs');

        Sentry.captureMessage(message, {
            level: 'warning',
            tags: context?.tags,
            extra: context?.extra,
        });
    } catch (error) {
        console.error('[ErrorTracking] Failed to capture warning:', error);
    }
}

// ============================================
// PERFORMANCE MONITORING
// ============================================

/**
 * Start a performance span for measuring operation duration
 */
export async function startSpan(
    name: string,
    op: string
): Promise<PerformanceSpan> {
    const startTime = Date.now();

    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) {
        // Return mock span for when Sentry is disabled
        return {
            end: () => {
                console.debug(`[Performance] ${name} completed in ${Date.now() - startTime}ms`);
            },
            setStatus: () => { },
        };
    }

    try {
        const Sentry = await import('@sentry/nextjs');

        return Sentry.startSpan({ name, op }, () => ({
            end: () => { },
            setStatus: () => { },
        }));
    } catch {
        return {
            end: () => {
                console.debug(`[Performance] ${name} completed in ${Date.now() - startTime}ms`);
            },
            setStatus: () => { },
        };
    }
}

// ============================================
// USER CONTEXT
// ============================================

/**
 * Set the current user for error tracking
 */
export async function setUser(user: { id: string; username?: string; email?: string } | null): Promise<void> {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;

    try {
        const Sentry = await import('@sentry/nextjs');

        if (user) {
            Sentry.setUser({
                id: user.id,
                username: user.username,
                email: user.email,
            });
        } else {
            Sentry.setUser(null);
        }
    } catch (error) {
        console.error('[ErrorTracking] Failed to set user:', error);
    }
}

// ============================================
// BREADCRUMBS
// ============================================

/**
 * Add a breadcrumb for debugging
 */
export async function addBreadcrumb(
    message: string,
    category: string,
    data?: Record<string, unknown>
): Promise<void> {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;

    try {
        const Sentry = await import('@sentry/nextjs');

        Sentry.addBreadcrumb({
            message,
            category,
            data,
            level: 'info',
        });
    } catch {
        // Silently ignore breadcrumb failures
    }
}
