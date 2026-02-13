import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    fetchWithTimeout,
    fetchJsonWithTimeout,
    safeFetch,
    FetchTimeoutError,
    DEFAULT_TIMEOUT,
    API_TIMEOUT,
    CRON_TIMEOUT
} from '@/lib/fetch-with-timeout';

describe('Fetch with Timeout', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('Constants', () => {
        it('should have correct default timeout values', () => {
            expect(DEFAULT_TIMEOUT).toBe(30000);
            expect(API_TIMEOUT).toBe(10000);
            expect(CRON_TIMEOUT).toBe(60000);
        });
    });

    describe('FetchTimeoutError', () => {
        it('should create error with correct properties', () => {
            const error = new FetchTimeoutError('https://example.com', 5000);

            expect(error).toBeInstanceOf(Error);
            expect(error.name).toBe('FetchTimeoutError');
            expect(error.url).toBe('https://example.com');
            expect(error.timeout).toBe(5000);
            expect(error.message).toContain('https://example.com');
            expect(error.message).toContain('5000ms');
        });
    });

    describe('fetchWithTimeout', () => {
        it('should resolve with response when fetch succeeds before timeout', async () => {
            const mockResponse = new Response('OK', { status: 200 });
            global.fetch = vi.fn().mockResolvedValue(mockResponse);

            const responsePromise = fetchWithTimeout('https://example.com', { timeout: 5000 });

            // Fast-forward time
            await vi.advanceTimersByTimeAsync(100);

            const response = await responsePromise;
            expect(response).toBe(mockResponse);
        });

        it('should use default timeout when not specified', async () => {
            const mockResponse = new Response('OK', { status: 200 });
            global.fetch = vi.fn().mockResolvedValue(mockResponse);

            const responsePromise = fetchWithTimeout('https://example.com');

            await vi.advanceTimersByTimeAsync(100);

            const response = await responsePromise;
            expect(response.status).toBe(200);
        });

        it('should pass through fetch options', async () => {
            const mockResponse = new Response('OK');
            global.fetch = vi.fn().mockResolvedValue(mockResponse);

            await fetchWithTimeout('https://example.com', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ test: true }),
                timeout: 1000
            });

            await vi.advanceTimersByTimeAsync(100);

            expect(global.fetch).toHaveBeenCalledWith(
                'https://example.com',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ test: true })
                })
            );
        });
    });

    describe('fetchJsonWithTimeout', () => {
        it('should parse JSON response', async () => {
            const mockData = { success: true, data: [1, 2, 3] };
            const mockResponse = new Response(JSON.stringify(mockData), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
            global.fetch = vi.fn().mockResolvedValue(mockResponse);

            const resultPromise = fetchJsonWithTimeout<typeof mockData>('https://example.com/api');

            await vi.advanceTimersByTimeAsync(100);

            const result = await resultPromise;
            expect(result).toEqual(mockData);
        });

        it('should throw error on non-OK response', async () => {
            vi.useRealTimers(); // Use real timers for this test

            const mockResponse = new Response('Not Found', { status: 404, statusText: 'Not Found' });
            global.fetch = vi.fn().mockResolvedValue(mockResponse);

            await expect(fetchJsonWithTimeout('https://example.com/api')).rejects.toThrow('HTTP 404');

            vi.useFakeTimers(); // Restore fake timers
        });
    });

    describe('safeFetch', () => {
        it('should return data on successful fetch', async () => {
            const mockData = { id: 1, name: 'Test' };
            const mockResponse = new Response(JSON.stringify(mockData), { status: 200 });
            global.fetch = vi.fn().mockResolvedValue(mockResponse);

            const resultPromise = safeFetch<typeof mockData>('https://example.com/api');

            await vi.advanceTimersByTimeAsync(100);

            const result = await resultPromise;
            expect(result).toEqual(mockData);
        });

        it('should return null on error', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const resultPromise = safeFetch('https://example.com/api');

            await vi.advanceTimersByTimeAsync(100);

            const result = await resultPromise;
            expect(result).toBeNull();

            consoleSpy.mockRestore();
        });

        it('should return null on non-OK response', async () => {
            const mockResponse = new Response('Error', { status: 500 });
            global.fetch = vi.fn().mockResolvedValue(mockResponse);

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const resultPromise = safeFetch('https://example.com/api');

            await vi.advanceTimersByTimeAsync(100);

            const result = await resultPromise;
            expect(result).toBeNull();

            consoleSpy.mockRestore();
        });
    });
});
