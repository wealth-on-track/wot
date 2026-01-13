/**
 * Production-safe logger utility
 * Automatically disabled in production unless explicitly enabled
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isDebugEnabled = process.env.NEXT_PUBLIC_DEBUG === 'true';

export const logger = {
    log: (...args: any[]) => {
        if (isDevelopment || isDebugEnabled) {
            console.log(...args);
        }
    },

    warn: (...args: any[]) => {
        if (isDevelopment || isDebugEnabled) {
            console.warn(...args);
        }
    },

    error: (...args: any[]) => {
        // Always log errors, even in production
        console.error(...args);
    },

    info: (...args: any[]) => {
        if (isDevelopment || isDebugEnabled) {
            console.info(...args);
        }
    },

    debug: (...args: any[]) => {
        if (isDebugEnabled) {
            console.debug(...args);
        }
    }
};

// Performance monitoring helper
export const perfLog = (label: string, fn: () => void) => {
    if (!isDevelopment) return fn();

    const start = performance.now();
    const result = fn();
    const end = performance.now();
    logger.debug(`[Perf] ${label}: ${(end - start).toFixed(2)}ms`);
    return result;
};
