import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getExchangeRates } from '@/lib/exchangeRates';
import { getPortfolioMetricsOptimized } from '@/lib/portfolio-optimized';
import {
    apiMiddleware,
    sanitizeError,
    usernameSchema,
    STRICT_RATE_LIMIT
} from '@/lib/api-security';

/**
 * GET /api/verify-portfolio
 * Returns portfolio verification data for the authenticated user
 *
 * Security:
 * - Requires authentication
 * - User can only access their own portfolio
 * - Rate limited
 */
export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const username = url.searchParams.get('user');

        // Validate username
        const usernameResult = usernameSchema.safeParse(username);
        if (!usernameResult.success) {
            return NextResponse.json(
                { error: 'Invalid or missing username parameter', code: 'VALIDATION_ERROR' },
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

        // 1. Get exchange rates
        const exchangeRates = await getExchangeRates();

        // 2. Get user with assets
        const user = await prisma.user.findFirst({
            where: { username: usernameResult.data },
            include: {
                Portfolio: {
                    include: {
                        Asset: {
                            orderBy: [
                                { sortOrder: 'asc' },
                                { createdAt: 'desc' }
                            ]
                        }
                    }
                }
            }
        });

        if (!user?.Portfolio) {
            return NextResponse.json(
                { error: 'Portfolio not found', code: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        // Filter to only active assets (quantity > 0)
        const activeAssets = user.Portfolio.Asset.filter(a => a.quantity > 0);

        // 3. Calculate portfolio value
        const result = await getPortfolioMetricsOptimized(
            activeAssets,
            exchangeRates,
            false,
            'VerifyAPI'
        );

        // 4. Return detailed breakdown
        const assetSummary = result.assetsWithValues.map(a => ({
            symbol: a.symbol,
            type: a.type,
            currency: a.currency,
            quantity: a.quantity,
            currentPrice: a.currentPrice,
            previousClose: a.previousClose,
            totalValueEUR: Math.round(a.totalValueEUR * 100) / 100,
            changePercent1D: a.changePercent1D,
            changePercent1W: a.changePercent1W,
            changePercent1M: a.changePercent1M,
            changePercentYTD: a.changePercentYTD,
            changePercent1Y: a.changePercent1Y
        }));

        return NextResponse.json({
            username: usernameResult.data,
            exchangeRates: {
                EUR: exchangeRates.EUR,
                USD: exchangeRates.USD,
                TRY: exchangeRates.TRY,
                GBP: exchangeRates.GBP
            },
            totalValueEUR: Math.round(result.totalValueEUR * 100) / 100,
            assetCount: result.assetsWithValues.length,
            assets: assetSummary
        });
    } catch (error) {
        const sanitized = sanitizeError(error, 'Failed to verify portfolio');
        return NextResponse.json(
            { error: sanitized.error, code: sanitized.code },
            { status: sanitized.status }
        );
    }
}
