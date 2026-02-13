import { describe, it, expect } from 'vitest';
import {
    successResponse,
    errorResponse,
    ok,
    created,
    noContent,
    badRequest,
    unauthorized,
    forbidden,
    notFound,
    conflict,
    validationError,
    rateLimited,
    internalError,
    serviceUnavailable,
    paginatedResponse,
    ErrorCodes
} from '@/lib/api-response';

describe('API Response Utilities', () => {
    describe('ErrorCodes', () => {
        it('should have all required error codes', () => {
            expect(ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED');
            expect(ErrorCodes.FORBIDDEN).toBe('FORBIDDEN');
            expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
            expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND');
            expect(ErrorCodes.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
            expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
        });
    });

    describe('successResponse', () => {
        it('should create a success response with data', async () => {
            const data = { id: 1, name: 'Test' };
            const response = successResponse(data);

            expect(response.status).toBe(200);

            const body = await response.json();
            expect(body.success).toBe(true);
            expect(body.data).toEqual(data);
            expect(body.meta.requestId).toBeDefined();
            expect(body.meta.timestamp).toBeDefined();
        });

        it('should accept custom status code', async () => {
            const response = successResponse({ created: true }, 201);
            expect(response.status).toBe(201);
        });

        it('should include duration when startTime provided', async () => {
            const startTime = Date.now() - 100;
            const response = successResponse({}, 200, startTime);

            const body = await response.json();
            expect(body.meta.duration).toBeGreaterThanOrEqual(100);
        });
    });

    describe('errorResponse', () => {
        it('should create an error response', async () => {
            const response = errorResponse(ErrorCodes.NOT_FOUND, 'User not found', 404);

            expect(response.status).toBe(404);

            const body = await response.json();
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('NOT_FOUND');
            expect(body.error.message).toBe('User not found');
        });

        it('should include details when provided', async () => {
            const details = { field: 'email', issue: 'invalid format' };
            const response = errorResponse(ErrorCodes.VALIDATION_ERROR, 'Validation failed', 422, details);

            const body = await response.json();
            expect(body.error.details).toEqual(details);
        });
    });

    describe('Convenience Methods', () => {
        describe('ok', () => {
            it('should return 200 OK', async () => {
                const response = ok({ message: 'Success' });
                expect(response.status).toBe(200);
            });
        });

        describe('created', () => {
            it('should return 201 Created', async () => {
                const response = created({ id: '123' });
                expect(response.status).toBe(201);
            });
        });

        describe('noContent', () => {
            it('should return 204 No Content', () => {
                const response = noContent();
                expect(response.status).toBe(204);
            });
        });

        describe('badRequest', () => {
            it('should return 400 Bad Request', async () => {
                const response = badRequest('Invalid input');
                expect(response.status).toBe(400);

                const body = await response.json();
                expect(body.error.code).toBe('INVALID_INPUT');
            });
        });

        describe('unauthorized', () => {
            it('should return 401 Unauthorized with default message', async () => {
                const response = unauthorized();
                expect(response.status).toBe(401);

                const body = await response.json();
                expect(body.error.message).toBe('Authentication required');
            });

            it('should accept custom message', async () => {
                const response = unauthorized('Session expired');
                const body = await response.json();
                expect(body.error.message).toBe('Session expired');
            });
        });

        describe('forbidden', () => {
            it('should return 403 Forbidden', async () => {
                const response = forbidden();
                expect(response.status).toBe(403);

                const body = await response.json();
                expect(body.error.code).toBe('FORBIDDEN');
            });
        });

        describe('notFound', () => {
            it('should return 404 Not Found', async () => {
                const response = notFound('User not found');
                expect(response.status).toBe(404);

                const body = await response.json();
                expect(body.error.message).toBe('User not found');
            });
        });

        describe('conflict', () => {
            it('should return 409 Conflict', async () => {
                const response = conflict('Resource already exists');
                expect(response.status).toBe(409);

                const body = await response.json();
                expect(body.error.code).toBe('CONFLICT');
            });
        });

        describe('validationError', () => {
            it('should return 422 with validation details', async () => {
                const details = { email: 'Invalid email format' };
                const response = validationError('Validation failed', details);

                expect(response.status).toBe(422);

                const body = await response.json();
                expect(body.error.code).toBe('VALIDATION_ERROR');
                expect(body.error.details).toEqual(details);
            });
        });

        describe('rateLimited', () => {
            it('should return 429 with Retry-After header', () => {
                const response = rateLimited(60);

                expect(response.status).toBe(429);
                expect(response.headers.get('Retry-After')).toBe('60');
            });
        });

        describe('internalError', () => {
            it('should return 500 Internal Server Error', async () => {
                const response = internalError();
                expect(response.status).toBe(500);

                const body = await response.json();
                expect(body.error.code).toBe('INTERNAL_ERROR');
            });
        });

        describe('serviceUnavailable', () => {
            it('should return 503 Service Unavailable', async () => {
                const response = serviceUnavailable();
                expect(response.status).toBe(503);

                const body = await response.json();
                expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
            });
        });
    });

    describe('paginatedResponse', () => {
        it('should create paginated response with correct structure', async () => {
            const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
            const response = paginatedResponse(items, 1, 10, 25);

            expect(response.status).toBe(200);

            const body = await response.json();
            expect(body.success).toBe(true);
            expect(body.data.items).toEqual(items);
            expect(body.data.pagination).toEqual({
                page: 1,
                pageSize: 10,
                totalItems: 25,
                totalPages: 3,
                hasNextPage: true,
                hasPrevPage: false
            });
        });

        it('should calculate hasNextPage correctly', async () => {
            const response = paginatedResponse([], 3, 10, 25);
            const body = await response.json();

            expect(body.data.pagination.hasNextPage).toBe(false);
            expect(body.data.pagination.hasPrevPage).toBe(true);
        });

        it('should handle empty results', async () => {
            const response = paginatedResponse([], 1, 10, 0);
            const body = await response.json();

            expect(body.data.pagination.totalPages).toBe(0);
            expect(body.data.pagination.hasNextPage).toBe(false);
            expect(body.data.pagination.hasPrevPage).toBe(false);
        });
    });
});
