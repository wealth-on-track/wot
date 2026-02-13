/**
 * Standardized API Response Utilities
 * Ensures consistent response format across all API endpoints
 *
 * Standard Response Format:
 * {
 *   success: boolean,
 *   data?: T,
 *   error?: {
 *     code: string,
 *     message: string,
 *     details?: unknown
 *   },
 *   meta?: {
 *     requestId: string,
 *     timestamp: string,
 *     duration?: number
 *   }
 * }
 */

import { NextResponse } from 'next/server';

// ============================================
// TYPES
// ============================================

export interface ApiSuccessResponse<T = unknown> {
    success: true;
    data: T;
    meta: ResponseMeta;
}

export interface ApiErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
    meta: ResponseMeta;
}

export interface ResponseMeta {
    requestId: string;
    timestamp: string;
    duration?: number;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================
// ERROR CODES
// ============================================

export const ErrorCodes = {
    // Authentication & Authorization
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    SESSION_EXPIRED: 'SESSION_EXPIRED',

    // Validation
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_INPUT: 'INVALID_INPUT',
    MISSING_FIELD: 'MISSING_FIELD',

    // Resource
    NOT_FOUND: 'NOT_FOUND',
    ALREADY_EXISTS: 'ALREADY_EXISTS',
    CONFLICT: 'CONFLICT',

    // Rate Limiting
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

    // Server
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    DATABASE_ERROR: 'DATABASE_ERROR',

    // Business Logic
    INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
    OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
    LIMIT_EXCEEDED: 'LIMIT_EXCEEDED'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// ============================================
// RESPONSE BUILDERS
// ============================================

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create standard response metadata
 */
function createMeta(startTime?: number): ResponseMeta {
    return {
        requestId: generateRequestId(),
        timestamp: new Date().toISOString(),
        ...(startTime && { duration: Date.now() - startTime })
    };
}

/**
 * Create a successful response
 */
export function successResponse<T>(
    data: T,
    status: number = 200,
    startTime?: number
): NextResponse<ApiSuccessResponse<T>> {
    return NextResponse.json(
        {
            success: true as const,
            data,
            meta: createMeta(startTime)
        },
        { status }
    );
}

/**
 * Create an error response
 */
export function errorResponse(
    code: ErrorCode,
    message: string,
    status: number = 500,
    details?: unknown,
    startTime?: number
): NextResponse<ApiErrorResponse> {
    return NextResponse.json(
        {
            success: false as const,
            error: {
                code,
                message,
                ...(details !== undefined ? { details } : {})
            },
            meta: createMeta(startTime)
        },
        { status }
    );
}

// ============================================
// CONVENIENCE METHODS
// ============================================

/**
 * 200 OK
 */
export function ok<T>(data: T, startTime?: number) {
    return successResponse(data, 200, startTime);
}

/**
 * 201 Created
 */
export function created<T>(data: T, startTime?: number) {
    return successResponse(data, 201, startTime);
}

/**
 * 204 No Content
 */
export function noContent() {
    return new NextResponse(null, { status: 204 });
}

/**
 * 400 Bad Request
 */
export function badRequest(message: string, details?: unknown, startTime?: number) {
    return errorResponse(ErrorCodes.INVALID_INPUT, message, 400, details, startTime);
}

/**
 * 401 Unauthorized
 */
export function unauthorized(message: string = 'Authentication required', startTime?: number) {
    return errorResponse(ErrorCodes.UNAUTHORIZED, message, 401, undefined, startTime);
}

/**
 * 403 Forbidden
 */
export function forbidden(message: string = 'Access denied', startTime?: number) {
    return errorResponse(ErrorCodes.FORBIDDEN, message, 403, undefined, startTime);
}

/**
 * 404 Not Found
 */
export function notFound(message: string = 'Resource not found', startTime?: number) {
    return errorResponse(ErrorCodes.NOT_FOUND, message, 404, undefined, startTime);
}

/**
 * 409 Conflict
 */
export function conflict(message: string, details?: unknown, startTime?: number) {
    return errorResponse(ErrorCodes.CONFLICT, message, 409, details, startTime);
}

/**
 * 422 Unprocessable Entity (Validation Error)
 */
export function validationError(message: string, details?: unknown, startTime?: number) {
    return errorResponse(ErrorCodes.VALIDATION_ERROR, message, 422, details, startTime);
}

/**
 * 429 Too Many Requests
 */
export function rateLimited(retryAfter: number, startTime?: number) {
    const response = errorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        'Too many requests. Please try again later.',
        429,
        { retryAfter },
        startTime
    );

    response.headers.set('Retry-After', String(retryAfter));
    return response;
}

/**
 * 500 Internal Server Error
 */
export function internalError(message: string = 'An unexpected error occurred', startTime?: number) {
    return errorResponse(ErrorCodes.INTERNAL_ERROR, message, 500, undefined, startTime);
}

/**
 * 503 Service Unavailable
 */
export function serviceUnavailable(message: string = 'Service temporarily unavailable', startTime?: number) {
    return errorResponse(ErrorCodes.SERVICE_UNAVAILABLE, message, 503, undefined, startTime);
}

// ============================================
// PAGINATION HELPERS
// ============================================

export interface PaginatedData<T> {
    items: T[];
    pagination: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}

/**
 * Create a paginated response
 */
export function paginatedResponse<T>(
    items: T[],
    page: number,
    pageSize: number,
    totalItems: number,
    startTime?: number
): NextResponse<ApiSuccessResponse<PaginatedData<T>>> {
    const totalPages = Math.ceil(totalItems / pageSize);

    return successResponse(
        {
            items,
            pagination: {
                page,
                pageSize,
                totalItems,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        },
        200,
        startTime
    );
}

// ============================================
// ERROR HANDLING WRAPPER
// ============================================

/**
 * Wrap an async handler with standard error handling
 */
export function withErrorHandling<T>(
    handler: (startTime: number) => Promise<NextResponse<ApiResponse<T>>>
): () => Promise<NextResponse<ApiResponse<T>>> {
    return async () => {
        const startTime = Date.now();
        try {
            return await handler(startTime);
        } catch (error) {
            console.error('[API Error]', error);

            // Don't expose internal error details in production
            const message = process.env.NODE_ENV === 'development' && error instanceof Error
                ? error.message
                : 'An unexpected error occurred';

            return internalError(message, startTime);
        }
    };
}
