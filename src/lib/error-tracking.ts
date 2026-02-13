/**
 * Error Tracking and Monitoring
 * Stub implementation - Sentry integration planned for future
 *
 * This module provides:
 * - Error capture utilities (console logging)
 * - Performance monitoring (console logging)
 * - User context management (no-op)
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
// INITIALIZATION (No-op)
// ============================================

/**
 * Initialize error tracking (no-op - Sentry not configured)
 */
export async function initErrorTracking(): Promise<void> {
    // Sentry integration planned for future when Next.js 16 support is available
    if (process.env.NODE_ENV === 'development') {
        console.log('[ErrorTracking] Using console-based error tracking');
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
    console.error('[Error]', error, context);
}

/**
 * Capture a warning message
 */
export async function captureWarning(
    message: string,
    context?: ErrorContext
): Promise<void> {
    console.warn('[Warning]', message, context);
}

// ============================================
// PERFORMANCE MONITORING
// ============================================

/**
 * Start a performance span for measuring operation duration
 */
export async function startSpan(
    name: string,
    _op: string
): Promise<PerformanceSpan> {
    const startTime = Date.now();

    return {
        end: () => {
            if (process.env.NODE_ENV === 'development') {
                console.debug(`[Performance] ${name} completed in ${Date.now() - startTime}ms`);
            }
        },
        setStatus: () => { },
    };
}

// ============================================
// USER CONTEXT (No-op)
// ============================================

/**
 * Set the current user for error tracking
 */
export async function setUser(_user: { id: string; username?: string; email?: string } | null): Promise<void> {
    // No-op without Sentry
}

// ============================================
// BREADCRUMBS (No-op)
// ============================================

/**
 * Add a breadcrumb for debugging
 */
export async function addBreadcrumb(
    _message: string,
    _category: string,
    _data?: Record<string, unknown>
): Promise<void> {
    // No-op without Sentry
}
