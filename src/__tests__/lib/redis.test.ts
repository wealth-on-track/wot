import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkRateLimit } from '@/lib/redis';

describe('Redis Rate Limiting', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        // Clear module cache to reset the redisUrl variable
        vi.resetModules();
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('Memory Fallback (No Redis)', () => {
        beforeEach(() => {
            delete process.env.REDIS_URL;
        });

        it('should allow first request', async () => {
            const { checkRateLimit: check } = await import('@/lib/redis');

            const result = await check('test-user-1', {
                windowMs: 60000,
                maxRequests: 10
            });

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(9);
        });

        it('should decrement remaining count', async () => {
            const { checkRateLimit: check } = await import('@/lib/redis');

            const config = { windowMs: 60000, maxRequests: 5 };

            // First request
            let result = await check('test-user-2', config);
            expect(result.remaining).toBe(4);

            // Second request
            result = await check('test-user-2', config);
            expect(result.remaining).toBe(3);

            // Third request
            result = await check('test-user-2', config);
            expect(result.remaining).toBe(2);
        });

        it('should block when limit exceeded', async () => {
            const { checkRateLimit: check } = await import('@/lib/redis');

            const config = { windowMs: 60000, maxRequests: 2 };

            // First request
            await check('test-user-3', config);

            // Second request
            await check('test-user-3', config);

            // Third request - should be blocked
            const result = await check('test-user-3', config);
            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
        });

        it('should track different identifiers separately', async () => {
            const { checkRateLimit: check } = await import('@/lib/redis');

            const config = { windowMs: 60000, maxRequests: 2 };

            // User A
            await check('user-a', config);
            const resultA = await check('user-a', config);

            // User B
            const resultB = await check('user-b', config);

            expect(resultA.remaining).toBe(0);
            expect(resultB.remaining).toBe(1);
        });

        it('should return resetAt timestamp', async () => {
            const { checkRateLimit: check } = await import('@/lib/redis');

            const now = Date.now();
            const result = await check('test-user-4', {
                windowMs: 60000,
                maxRequests: 10
            });

            expect(result.resetAt).toBeGreaterThan(now);
            expect(result.resetAt).toBeLessThanOrEqual(now + 60000);
        });
    });

    describe('Rate Limit Result Interface', () => {
        it('should return correct structure', async () => {
            delete process.env.REDIS_URL;
            const { checkRateLimit: check } = await import('@/lib/redis');

            const result = await check('test-structure', {
                windowMs: 60000,
                maxRequests: 10
            });

            expect(result).toHaveProperty('allowed');
            expect(result).toHaveProperty('remaining');
            expect(result).toHaveProperty('resetAt');
            expect(typeof result.allowed).toBe('boolean');
            expect(typeof result.remaining).toBe('number');
            expect(typeof result.resetAt).toBe('number');
        });
    });
});
