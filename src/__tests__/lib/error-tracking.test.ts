import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Error Tracking', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'debug').mockImplementation(() => {});
    });

    afterEach(() => {
        process.env = originalEnv;
        vi.restoreAllMocks();
        vi.resetModules();
    });

    describe('initErrorTracking', () => {
        it('should warn when Sentry DSN is not configured in production', async () => {
            process.env.NODE_ENV = 'production';
            delete process.env.NEXT_PUBLIC_SENTRY_DSN;

            const { initErrorTracking } = await import('@/lib/error-tracking');
            await initErrorTracking();

            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('Sentry DSN not configured')
            );
        });

        it('should not warn in development when DSN not configured', async () => {
            process.env.NODE_ENV = 'development';
            delete process.env.NEXT_PUBLIC_SENTRY_DSN;

            const consoleSpy = vi.spyOn(console, 'warn');

            const { initErrorTracking } = await import('@/lib/error-tracking');
            await initErrorTracking();

            // Should not log warning in development
            const warningCalls = consoleSpy.mock.calls.filter(
                call => call[0]?.includes?.('Sentry DSN not configured')
            );
            expect(warningCalls.length).toBe(0);
        });
    });

    describe('captureError', () => {
        it('should always log error to console', async () => {
            delete process.env.NEXT_PUBLIC_SENTRY_DSN;

            const { captureError } = await import('@/lib/error-tracking');

            const error = new Error('Test error');
            await captureError(error, { action: 'test_action' });

            expect(console.error).toHaveBeenCalledWith(
                '[Error]',
                error,
                expect.objectContaining({ action: 'test_action' })
            );
        });

        it('should handle string errors', async () => {
            delete process.env.NEXT_PUBLIC_SENTRY_DSN;

            const { captureError } = await import('@/lib/error-tracking');

            await captureError('String error message');

            expect(console.error).toHaveBeenCalledWith(
                '[Error]',
                'String error message',
                undefined
            );
        });

        it('should include context in error logging', async () => {
            delete process.env.NEXT_PUBLIC_SENTRY_DSN;

            const { captureError } = await import('@/lib/error-tracking');

            await captureError(new Error('Test'), {
                userId: 'user-123',
                username: 'testuser',
                action: 'test_action',
                tags: { component: 'api' },
                extra: { requestId: 'req-456' }
            });

            expect(console.error).toHaveBeenCalledWith(
                '[Error]',
                expect.any(Error),
                expect.objectContaining({
                    userId: 'user-123',
                    username: 'testuser',
                    action: 'test_action'
                })
            );
        });
    });

    describe('captureWarning', () => {
        it('should log warning to console', async () => {
            delete process.env.NEXT_PUBLIC_SENTRY_DSN;

            const { captureWarning } = await import('@/lib/error-tracking');

            await captureWarning('Test warning', { action: 'test' });

            expect(console.warn).toHaveBeenCalledWith(
                '[Warning]',
                'Test warning',
                expect.objectContaining({ action: 'test' })
            );
        });
    });

    describe('startSpan', () => {
        it('should return mock span when Sentry disabled', async () => {
            delete process.env.NEXT_PUBLIC_SENTRY_DSN;

            const { startSpan } = await import('@/lib/error-tracking');

            const span = await startSpan('test-operation', 'db.query');

            expect(span).toHaveProperty('end');
            expect(span).toHaveProperty('setStatus');
            expect(typeof span.end).toBe('function');
            expect(typeof span.setStatus).toBe('function');
        });

        it('should log performance debug on span end', async () => {
            delete process.env.NEXT_PUBLIC_SENTRY_DSN;

            const { startSpan } = await import('@/lib/error-tracking');

            const span = await startSpan('test-operation', 'db.query');
            span.end();

            // The debug log is a single formatted string containing both [Performance] and the operation name
            expect(console.debug).toHaveBeenCalledWith(
                expect.stringMatching(/\[Performance\].*test-operation/)
            );
        });
    });

    describe('setUser', () => {
        it('should not throw when Sentry disabled', async () => {
            delete process.env.NEXT_PUBLIC_SENTRY_DSN;

            const { setUser } = await import('@/lib/error-tracking');

            // Should not throw
            await expect(setUser({ id: 'user-123', username: 'test' })).resolves.not.toThrow();
            await expect(setUser(null)).resolves.not.toThrow();
        });
    });

    describe('addBreadcrumb', () => {
        it('should not throw when Sentry disabled', async () => {
            delete process.env.NEXT_PUBLIC_SENTRY_DSN;

            const { addBreadcrumb } = await import('@/lib/error-tracking');

            await expect(
                addBreadcrumb('User clicked button', 'ui', { buttonId: 'submit' })
            ).resolves.not.toThrow();
        });
    });
});
