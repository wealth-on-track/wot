import { NextRequest, NextResponse } from 'next/server';
import { calculateInsights } from '@/lib/insightsEngine';
import {
    apiMiddleware,
    sanitizeError,
    usernameSchema,
    STRICT_RATE_LIMIT
} from '@/lib/api-security';

/**
 * GET /api/insights/[username]
 * Returns portfolio insights for the authenticated user
 *
 * Security:
 * - Requires authentication
 * - User can only access their own insights
 * - Rate limited
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await params;

        // Validate username
        const usernameResult = usernameSchema.safeParse(username);
        if (!usernameResult.success) {
            return NextResponse.json(
                { error: 'Invalid username', code: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        // Security middleware: require auth + user match + rate limit
        const middlewareError = await apiMiddleware(request, {
            requireAuth: true,
            matchUsername: usernameResult.data,
            rateLimit: STRICT_RATE_LIMIT,
        });

        if (middlewareError) {
            return middlewareError;
        }

        const insights = await calculateInsights(usernameResult.data);

        return NextResponse.json(insights);
    } catch (error) {
        const sanitized = sanitizeError(error, 'Failed to calculate insights');
        return NextResponse.json(
            { error: sanitized.error, code: sanitized.code },
            { status: sanitized.status }
        );
    }
}
