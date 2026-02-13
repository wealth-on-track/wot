import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    apiMiddleware,
    sanitizeError,
    usernameSchema,
    periodSchema,
    STRICT_RATE_LIMIT
} from '@/lib/api-security';

export const dynamic = 'force-dynamic';

const log = (msg: string) => {
    if (process.env.NODE_ENV === 'development') {
        console.log(`[HistoryAPI] ${msg}`);
    }
};

/**
 * GET /api/portfolio/[username]/history
 * Returns portfolio history for the authenticated user
 *
 * Security:
 * - Requires authentication
 * - User can only access their own history
 * - Rate limited
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
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

    // Parse and validate query params
    const searchParams = request.nextUrl.searchParams;
    const periodParam = searchParams.get('period') || '1M';

    const periodResult = periodSchema.safeParse(periodParam);
    if (!periodResult.success) {
        return NextResponse.json(
            { error: 'Invalid period parameter', code: 'VALIDATION_ERROR' },
            { status: 400 }
        );
    }

    const period = periodResult.data;
    const periodMapping: Record<string, number> = {
        '1D': 1,
        '1W': 7,
        '1M': 30,
        '3M': 90,
        '6M': 180,
        'YTD': 0,
        '1Y': 365,
        'ALL': 365 * 2
    };

    let days = periodMapping[period] || 30;

    // Calculate start date
    const endDate = new Date();
    const startDate = new Date();
    if (period === 'YTD') {
        startDate.setFullYear(new Date().getFullYear(), 0, 1);
        days = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    } else {
        startDate.setDate(startDate.getDate() - days);
    }
    startDate.setHours(0, 0, 0, 0);

    try {
        log(`Request for ${usernameResult.data}, period=${period}, days=${days}`);

        const user = await prisma.user.findUnique({
            where: { username: usernameResult.data },
            include: {
                Portfolio: {
                    include: {
                        Asset: true
                    }
                }
            }
        });

        if (!user || !user.Portfolio) {
            return NextResponse.json(
                { error: 'Portfolio not found', code: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        log(`Found user, assets count: ${user.Portfolio.Asset.length}`);

        // Fetch Real Snapshots from DB
        let snapshots: { date: Date; totalValue: number }[] = [];
        try {
            snapshots = await prisma.portfolioSnapshot.findMany({
                where: {
                    portfolioId: user.Portfolio.id,
                    date: { gte: startDate }
                },
                orderBy: { date: 'asc' },
                select: {
                    date: true,
                    totalValue: true
                }
            });
            log(`Snapshots found: ${snapshots.length}`);
        } catch (dbError) {
            log(`DB access issue: ${dbError}`);
            snapshots = [];
        }

        // Transform snapshots to response format
        let historyData: { date: string; value: number }[] = [];

        if (snapshots.length > 0) {
            historyData = snapshots.map(s => ({
                date: s.date.toISOString(),
                value: s.totalValue
            }));
        }

        // Fallback if empty (Safe Flat Line)
        if (historyData.length === 0) {
            log('No history data, generating fallback');

            let fallbackValue = 0;
            if (user.Portfolio?.Asset) {
                fallbackValue = user.Portfolio.Asset.reduce((sum, asset) => {
                    const val = (Number(asset.quantity) || 0) * (Number(asset.buyPrice) || 0);
                    return sum + val;
                }, 0);
            }

            historyData.push({
                date: startDate.toISOString(),
                value: fallbackValue
            });
            historyData.push({
                date: new Date().toISOString(),
                value: fallbackValue
            });
        }

        log(`Returning ${historyData.length} data points`);

        const response = NextResponse.json({
            data: historyData,
            source: snapshots.length >= Math.max(2, days / 5) ? 'database' : 'simulation'
        });

        // Cache for 5 minutes on client, stale-while-revalidate for 10 minutes
        response.headers.set('Cache-Control', 'private, s-maxage=300, stale-while-revalidate=600');
        return response;

    } catch (error) {
        const sanitized = sanitizeError(error, 'Failed to fetch portfolio history');
        return NextResponse.json(
            { error: sanitized.error, code: sanitized.code },
            { status: sanitized.status }
        );
    }
}
