/**
 * API Security Utilities
 * Centralized security functions for all API routes
 *
 * Features:
 * - Authentication verification
 * - Rate limiting
 * - Error sanitization
 * - Input validation
 * - CRON authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { z } from 'zod';

// ============================================
// TYPES
// ============================================

export interface ApiErrorResponse {
    error: string;
    code?: string;
    status: number;
}

export interface RateLimitConfig {
    windowMs: number;      // Time window in milliseconds
    maxRequests: number;   // Maximum requests per window
}

// ============================================
// RATE LIMITING (Redis-backed with fallback)
// ============================================

import { checkRateLimit as redisRateLimit } from '@/lib/redis';

// Default rate limit: 100 requests per minute
const DEFAULT_RATE_LIMIT: RateLimitConfig = {
    windowMs: 60 * 1000,
    maxRequests: 100,
};

// Strict rate limit for sensitive endpoints: 10 requests per minute
export const STRICT_RATE_LIMIT: RateLimitConfig = {
    windowMs: 60 * 1000,
    maxRequests: 10,
};

// Very strict for auth endpoints: 5 requests per minute
export const AUTH_RATE_LIMIT: RateLimitConfig = {
    windowMs: 60 * 1000,
    maxRequests: 5,
};

// Rate limit for CRON endpoints: 1 request per minute per endpoint
export const CRON_RATE_LIMIT: RateLimitConfig = {
    windowMs: 60 * 1000,
    maxRequests: 1,
};

/**
 * Check rate limit for a given identifier
 * Uses Redis for production scalability, falls back to in-memory in dev
 */
export async function checkRateLimit(
    identifier: string,
    config: RateLimitConfig = DEFAULT_RATE_LIMIT
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    return redisRateLimit(identifier, config);
}

/**
 * Get client identifier for rate limiting
 */
export function getClientIdentifier(request: NextRequest): string {
    // Try to get real IP from various headers
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const cfConnectingIp = request.headers.get('cf-connecting-ip');

    const ip = cfConnectingIp || realIp || forwarded?.split(',')[0]?.trim() || 'unknown';
    return ip;
}

/**
 * Rate limit middleware response
 */
export function rateLimitResponse(resetAt: number): NextResponse {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);

    return NextResponse.json(
        {
            error: 'Too many requests. Please try again later.',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter
        },
        {
            status: 429,
            headers: {
                'Retry-After': String(retryAfter),
                'X-RateLimit-Reset': String(resetAt),
            }
        }
    );
}

// ============================================
// AUTHENTICATION
// ============================================

/**
 * Verify that the request is from an authenticated user
 * Returns the session or null
 */
export async function getAuthenticatedSession(request?: NextRequest) {
    try {
        const session = await auth();
        return session;
    } catch {
        return null;
    }
}

/**
 * Require authentication - returns error response if not authenticated
 */
export async function requireAuth(request: NextRequest): Promise<NextResponse | null> {
    const session = await getAuthenticatedSession(request);

    if (!session?.user) {
        return NextResponse.json(
            { error: 'Authentication required', code: 'UNAUTHORIZED' },
            { status: 401 }
        );
    }

    return null; // No error, proceed
}

/**
 * Require the authenticated user to match the requested username
 * Prevents users from accessing other users' data
 */
export async function requireUserMatch(
    request: NextRequest,
    username: string
): Promise<NextResponse | null> {
    const session = await getAuthenticatedSession(request);

    if (!session?.user) {
        return NextResponse.json(
            { error: 'Authentication required', code: 'UNAUTHORIZED' },
            { status: 401 }
        );
    }

    // Check if the authenticated user matches the requested username
    const sessionUsername = (session.user as { username?: string }).username || session.user.name;

    if (sessionUsername !== username) {
        return NextResponse.json(
            { error: 'Access denied', code: 'FORBIDDEN' },
            { status: 403 }
        );
    }

    return null; // No error, proceed
}

// ============================================
// CRON AUTHENTICATION
// ============================================

/**
 * Verify CRON secret for scheduled jobs
 * SECURITY: Authentication is ALWAYS required - no exceptions
 * This prevents unauthorized access to CRON endpoints in all environments
 */
export function verifyCronAuth(request: Request): NextResponse | null {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // SECURITY: CRON_SECRET is ALWAYS required
    if (!cronSecret) {
        console.error('[SECURITY] CRON_SECRET is not configured!');
        return NextResponse.json(
            { error: 'Server configuration error', code: 'CONFIG_ERROR' },
            { status: 500 }
        );
    }

    // SECURITY: Always verify auth header matches secret
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        console.warn('[SECURITY] CRON authentication failed - invalid or missing token');
        return NextResponse.json(
            { error: 'Unauthorized', code: 'CRON_AUTH_FAILED' },
            { status: 401 }
        );
    }

    return null; // No error, proceed
}

// ============================================
// ERROR SANITIZATION
// ============================================

/**
 * Sanitize error for API response
 * Never expose internal error details to clients
 */
export function sanitizeError(error: unknown, defaultMessage = 'An error occurred'): ApiErrorResponse {
    // Log the full error internally
    console.error('[API Error]', error);

    // In development, return more details
    if (process.env.NODE_ENV === 'development') {
        if (error instanceof Error) {
            return {
                error: error.message,
                code: 'INTERNAL_ERROR',
                status: 500,
            };
        }
    }

    // In production, return generic message
    return {
        error: defaultMessage,
        code: 'INTERNAL_ERROR',
        status: 500,
    };
}

/**
 * Create a safe error response
 */
export function errorResponse(
    message: string,
    status: number = 500,
    code?: string
): NextResponse {
    return NextResponse.json(
        { error: message, ...(code && { code }) },
        { status }
    );
}

// ============================================
// INPUT VALIDATION
// ============================================

/**
 * Validate username parameter
 */
export const usernameSchema = z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens');

/**
 * Validate period parameter for charts
 */
export const periodSchema = z.enum(['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', 'ALL']);

/**
 * Validate symbol parameter
 * Supports: AAPL, BTC-USD, SPY.PA, ^GSPC, EUR=X
 */
export const symbolSchema = z.string()
    .min(1, 'Symbol is required')
    .max(20, 'Symbol too long')
    .regex(/^[A-Z0-9.\-=^]+$/i, 'Invalid symbol format');

/**
 * Validate and parse request body with Zod schema
 */
export async function validateBody<T>(
    request: NextRequest,
    schema: z.ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
    try {
        const body = await request.json();
        const result = schema.safeParse(body);

        if (!result.success) {
            return {
                data: null,
                error: NextResponse.json(
                    {
                        error: 'Validation failed',
                        code: 'VALIDATION_ERROR',
                        details: result.error.flatten()
                    },
                    { status: 400 }
                ),
            };
        }

        return { data: result.data, error: null };
    } catch {
        return {
            data: null,
            error: NextResponse.json(
                { error: 'Invalid JSON body', code: 'INVALID_JSON' },
                { status: 400 }
            ),
        };
    }
}

// ============================================
// COMBINED MIDDLEWARE
// ============================================

export interface ApiMiddlewareOptions {
    requireAuth?: boolean;
    matchUsername?: string;
    rateLimit?: RateLimitConfig;
    cronAuth?: boolean;
}

/**
 * Combined middleware for API routes
 * Applies rate limiting, authentication, and other security checks
 */
export async function apiMiddleware(
    request: NextRequest,
    options: ApiMiddlewareOptions = {}
): Promise<NextResponse | null> {
    const { requireAuth: needsAuth, matchUsername, rateLimit, cronAuth } = options;

    // 1. Rate limiting (now async with Redis support)
    if (rateLimit !== undefined) {
        const clientId = getClientIdentifier(request);
        const endpoint = request.nextUrl.pathname;
        const rateLimitKey = `${clientId}:${endpoint}`;

        const { allowed, resetAt } = await checkRateLimit(rateLimitKey, rateLimit || DEFAULT_RATE_LIMIT);

        if (!allowed) {
            return rateLimitResponse(resetAt);
        }
    }

    // 2. CRON authentication (with rate limiting for CRON endpoints)
    if (cronAuth) {
        // Apply CRON-specific rate limiting
        const endpoint = request.nextUrl.pathname;
        const cronRateKey = `cron:${endpoint}`;
        const { allowed: cronAllowed, resetAt: cronResetAt } = await checkRateLimit(cronRateKey, CRON_RATE_LIMIT);

        if (!cronAllowed) {
            return rateLimitResponse(cronResetAt);
        }

        const cronError = verifyCronAuth(request);
        if (cronError) return cronError;
    }

    // 3. User authentication
    if (needsAuth) {
        if (matchUsername) {
            const matchError = await requireUserMatch(request, matchUsername);
            if (matchError) return matchError;
        } else {
            const authError = await requireAuth(request);
            if (authError) return authError;
        }
    }

    return null; // All checks passed
}
