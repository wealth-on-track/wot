import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getExchangeRates } from '@/lib/exchangeRates';
import {
    apiMiddleware,
    sanitizeError,
    usernameSchema,
    STRICT_RATE_LIMIT
} from '@/lib/api-security';

/**
 * GET /api/verify-rates
 * Returns exchange rate verification data for the authenticated user
 *
 * Security:
 * - Requires authentication
 * - User can only access their own data
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

        // 1. Get exchange rates from DB
        const exchangeRates = await getExchangeRates();
        const dbRates = await prisma.exchangeRate.findMany();

        // 2. Get TRY-denominated assets for user
        const user = await prisma.user.findFirst({
            where: { username: usernameResult.data },
            include: {
                Portfolio: {
                    include: {
                        Asset: {
                            where: {
                                currency: 'TRY',
                                quantity: { gt: 0 }
                            }
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

        // 3. Calculate TRY to EUR conversion for each TRY asset
        const tryRate = exchangeRates.TRY || 38.5;
        const tryAssets = user.Portfolio.Asset.map(a => ({
            symbol: a.symbol,
            quantity: a.quantity,
            buyPrice: a.buyPrice,
            costTRY: a.quantity * a.buyPrice,
            costEUR: (a.quantity * a.buyPrice) / tryRate
        }));

        const totalTRYCostEUR = tryAssets.reduce((sum, a) => sum + a.costEUR, 0);

        return NextResponse.json({
            username: usernameResult.data,
            timestamp: new Date().toISOString(),
            exchangeRates: {
                USD: exchangeRates.USD,
                TRY: exchangeRates.TRY,
                GBP: exchangeRates.GBP
            },
            dbRates: dbRates.map(r => ({ currency: r.currency, rate: r.rate })),
            tryAssets,
            totalTRYCostEUR: Math.round(totalTRYCostEUR * 100) / 100
        });
    } catch (error) {
        const sanitized = sanitizeError(error, 'Failed to verify rates');
        return NextResponse.json(
            { error: sanitized.error, code: sanitized.code },
            { status: sanitized.status }
        );
    }
}
