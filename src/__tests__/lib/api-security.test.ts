import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
    getClientIdentifier,
    rateLimitResponse,
    verifyCronAuth,
    sanitizeError,
    errorResponse,
    usernameSchema,
    periodSchema,
    symbolSchema,
    STRICT_RATE_LIMIT,
    AUTH_RATE_LIMIT,
    CRON_RATE_LIMIT
} from '@/lib/api-security';

// Mock the auth module
vi.mock('@/auth', () => ({
    auth: vi.fn()
}));

describe('API Security', () => {
    describe('Rate Limit Configs', () => {
        it('should have correct STRICT_RATE_LIMIT config', () => {
            expect(STRICT_RATE_LIMIT.windowMs).toBe(60 * 1000);
            expect(STRICT_RATE_LIMIT.maxRequests).toBe(10);
        });

        it('should have correct AUTH_RATE_LIMIT config', () => {
            expect(AUTH_RATE_LIMIT.windowMs).toBe(60 * 1000);
            expect(AUTH_RATE_LIMIT.maxRequests).toBe(5);
        });

        it('should have correct CRON_RATE_LIMIT config', () => {
            expect(CRON_RATE_LIMIT.windowMs).toBe(60 * 1000);
            expect(CRON_RATE_LIMIT.maxRequests).toBe(1);
        });
    });

    describe('getClientIdentifier', () => {
        it('should extract IP from x-forwarded-for header', () => {
            const request = new NextRequest('https://example.com', {
                headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' }
            });

            const identifier = getClientIdentifier(request);
            expect(identifier).toBe('192.168.1.1');
        });

        it('should extract IP from x-real-ip header', () => {
            const request = new NextRequest('https://example.com', {
                headers: { 'x-real-ip': '192.168.1.100' }
            });

            const identifier = getClientIdentifier(request);
            expect(identifier).toBe('192.168.1.100');
        });

        it('should prefer cf-connecting-ip header', () => {
            const request = new NextRequest('https://example.com', {
                headers: {
                    'x-forwarded-for': '192.168.1.1',
                    'cf-connecting-ip': '203.0.113.50'
                }
            });

            const identifier = getClientIdentifier(request);
            expect(identifier).toBe('203.0.113.50');
        });

        it('should return "unknown" when no IP headers present', () => {
            const request = new NextRequest('https://example.com');

            const identifier = getClientIdentifier(request);
            expect(identifier).toBe('unknown');
        });
    });

    describe('rateLimitResponse', () => {
        it('should return 429 response with correct headers', () => {
            const resetAt = Date.now() + 30000;
            const response = rateLimitResponse(resetAt);

            expect(response.status).toBe(429);
            expect(response.headers.get('Retry-After')).toBeDefined();
            expect(response.headers.get('X-RateLimit-Reset')).toBe(String(resetAt));
        });
    });

    describe('verifyCronAuth', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            process.env = { ...originalEnv };
        });

        afterEach(() => {
            process.env = originalEnv;
        });

        it('should return error when CRON_SECRET is not configured', () => {
            delete process.env.CRON_SECRET;

            const request = new Request('https://example.com/api/cron', {
                headers: { 'authorization': 'Bearer test-secret' }
            });

            const result = verifyCronAuth(request);
            expect(result).not.toBeNull();
            expect(result?.status).toBe(500);
        });

        it('should return error when auth header is missing', () => {
            process.env.CRON_SECRET = 'test-secret';

            const request = new Request('https://example.com/api/cron');

            const result = verifyCronAuth(request);
            expect(result).not.toBeNull();
            expect(result?.status).toBe(401);
        });

        it('should return error when auth header is invalid', () => {
            process.env.CRON_SECRET = 'correct-secret';

            const request = new Request('https://example.com/api/cron', {
                headers: { 'authorization': 'Bearer wrong-secret' }
            });

            const result = verifyCronAuth(request);
            expect(result).not.toBeNull();
            expect(result?.status).toBe(401);
        });

        it('should return null when auth header is valid', () => {
            process.env.CRON_SECRET = 'valid-secret';

            const request = new Request('https://example.com/api/cron', {
                headers: { 'authorization': 'Bearer valid-secret' }
            });

            const result = verifyCronAuth(request);
            expect(result).toBeNull();
        });
    });

    describe('sanitizeError', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            process.env = { ...originalEnv };
            vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            process.env = originalEnv;
            vi.restoreAllMocks();
        });

        it('should return generic message in production', () => {
            process.env.NODE_ENV = 'production';

            const error = new Error('Database connection failed');
            const result = sanitizeError(error, 'An error occurred');

            expect(result.error).toBe('An error occurred');
            expect(result.code).toBe('INTERNAL_ERROR');
            expect(result.status).toBe(500);
        });

        it('should return error message in development', () => {
            process.env.NODE_ENV = 'development';

            const error = new Error('Database connection failed');
            const result = sanitizeError(error);

            expect(result.error).toBe('Database connection failed');
            expect(result.code).toBe('INTERNAL_ERROR');
            expect(result.status).toBe(500);
        });

        it('should handle non-Error objects', () => {
            process.env.NODE_ENV = 'production';

            const result = sanitizeError('string error', 'Default message');

            expect(result.error).toBe('Default message');
        });
    });

    describe('errorResponse', () => {
        it('should create error response with default status', () => {
            const response = errorResponse('Something went wrong');

            expect(response.status).toBe(500);
        });

        it('should create error response with custom status', () => {
            const response = errorResponse('Not found', 404);

            expect(response.status).toBe(404);
        });

        it('should include code when provided', async () => {
            const response = errorResponse('Validation failed', 400, 'VALIDATION_ERROR');

            expect(response.status).toBe(400);

            const body = await response.json();
            expect(body.error).toBe('Validation failed');
            expect(body.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('Validation Schemas', () => {
        describe('usernameSchema', () => {
            it('should accept valid usernames', () => {
                expect(usernameSchema.safeParse('john_doe').success).toBe(true);
                expect(usernameSchema.safeParse('user-123').success).toBe(true);
                expect(usernameSchema.safeParse('UserName99').success).toBe(true);
            });

            it('should reject invalid usernames', () => {
                expect(usernameSchema.safeParse('ab').success).toBe(false); // too short
                expect(usernameSchema.safeParse('a'.repeat(31)).success).toBe(false); // too long
                expect(usernameSchema.safeParse('user@name').success).toBe(false); // invalid char
                expect(usernameSchema.safeParse('user name').success).toBe(false); // space
            });
        });

        describe('periodSchema', () => {
            it('should accept valid periods', () => {
                const validPeriods = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'];

                validPeriods.forEach(period => {
                    expect(periodSchema.safeParse(period).success).toBe(true);
                });
            });

            it('should reject invalid periods', () => {
                expect(periodSchema.safeParse('2D').success).toBe(false);
                expect(periodSchema.safeParse('').success).toBe(false);
                expect(periodSchema.safeParse('weekly').success).toBe(false);
            });
        });

        describe('symbolSchema', () => {
            it('should accept valid symbols', () => {
                expect(symbolSchema.safeParse('AAPL').success).toBe(true);
                expect(symbolSchema.safeParse('BTC-USD').success).toBe(true);
                expect(symbolSchema.safeParse('SPY.PA').success).toBe(true);
                expect(symbolSchema.safeParse('^GSPC').success).toBe(true);
                expect(symbolSchema.safeParse('EUR=X').success).toBe(true);
            });

            it('should reject invalid symbols', () => {
                expect(symbolSchema.safeParse('').success).toBe(false); // empty
                expect(symbolSchema.safeParse('A'.repeat(21)).success).toBe(false); // too long
            });
        });
    });
});
