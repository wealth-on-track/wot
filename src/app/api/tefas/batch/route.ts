import { NextRequest, NextResponse } from 'next/server';
import { getTefasFundInfo } from '@/services/tefasApi';
import {
    apiMiddleware,
    sanitizeError,
    STRICT_RATE_LIMIT
} from '@/lib/api-security';
import { z } from 'zod';

// Validation schema for request body
const batchRequestSchema = z.object({
    codes: z.array(z.string().min(1).max(20))
        .min(1, 'At least one code required')
        .max(20, 'Maximum 20 codes allowed')
});

/**
 * POST /api/tefas/batch
 * Batch fetch TEFAS fund prices
 *
 * Security:
 * - Requires authentication
 * - Rate limited
 * - Input validation
 *
 * Body: { codes: ['AH2', 'AH5', 'AEA', ...] }
 * Returns: { prices: { 'AH2': 1.234, 'AH5': 5.678, ... } }
 */
export async function POST(request: NextRequest) {
    try {
        // Security middleware: require auth + rate limit
        const middlewareError = await apiMiddleware(request, {
            requireAuth: true,
            rateLimit: STRICT_RATE_LIMIT,
        });

        if (middlewareError) {
            return middlewareError;
        }

        // Validate request body
        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: 'Invalid JSON body', code: 'INVALID_JSON' },
                { status: 400 }
            );
        }

        const validation = batchRequestSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                {
                    error: 'Validation failed',
                    code: 'VALIDATION_ERROR',
                    details: validation.error.flatten()
                },
                { status: 400 }
            );
        }

        const { codes } = validation.data;

        // Fetch all prices in parallel
        const results = await Promise.allSettled(
            codes.map(async (code: string) => {
                const info = await getTefasFundInfo(code);
                return { code, price: info?.price || null };
            })
        );

        const prices: Record<string, number> = {};
        results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value.price !== null) {
                prices[result.value.code] = result.value.price;
            }
        });

        return NextResponse.json({ prices });
    } catch (error) {
        const sanitized = sanitizeError(error, 'Failed to fetch TEFAS prices');
        return NextResponse.json(
            { error: sanitized.error, code: sanitized.code },
            { status: sanitized.status }
        );
    }
}
