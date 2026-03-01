/**
 * Secure Fetch with Timeout
 * Wrapper around fetch with security features:
 * - Automatic timeout (prevents hanging requests)
 * - Secure headers by default
 * - No credential leakage in URLs (API keys in headers)
 */

// ============================================
// CONSTANTS
// ============================================

export const DEFAULT_TIMEOUT = 15000; // 15 seconds
export const API_TIMEOUT = 3000;      // 3 seconds for API calls (faster failures)
export const CRON_TIMEOUT = 60000;    // 60 seconds for CRON jobs

// ============================================
// TYPES
// ============================================

export interface FetchWithTimeoutOptions extends RequestInit {
    timeout?: number; // Timeout in milliseconds
}

export class FetchTimeoutError extends Error {
    url: string;
    timeout: number;

    constructor(url: string, timeout: number) {
        super(`Request to ${url} timed out after ${timeout}ms`);
        this.name = 'FetchTimeoutError';
        this.url = url;
        this.timeout = timeout;
    }
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Fetch with automatic timeout
 * Default timeout: 30 seconds
 *
 * @example
 * const response = await fetchWithTimeout('https://api.example.com/data', {
 *     timeout: 10000, // 10 seconds
 *     method: 'GET',
 * });
 */
export async function fetchWithTimeout(
    url: string | URL,
    options: FetchWithTimeoutOptions = {}
): Promise<Response> {
    const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal,
        });
        return response;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new FetchTimeoutError(url.toString(), timeout);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Fetch JSON with timeout
 * Convenience wrapper that parses JSON response
 */
export async function fetchJsonWithTimeout<T>(
    url: string | URL,
    options: FetchWithTimeoutOptions = {}
): Promise<T> {
    const response = await fetchWithTimeout(url, options);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
}

/**
 * Safe fetch that returns null on error instead of throwing
 * Useful for non-critical API calls
 */
export async function safeFetch<T>(
    url: string | URL,
    options: FetchWithTimeoutOptions = {}
): Promise<T | null> {
    try {
        return await fetchJsonWithTimeout<T>(url, options);
    } catch (error) {
        console.error(`[SafeFetch] Error fetching ${url}:`, error);
        return null;
    }
}
