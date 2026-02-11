import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getExchangeRates } from '@/lib/exchangeRates';
import { getPortfolioMetricsOptimized } from '@/lib/portfolio-optimized';

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const username = url.searchParams.get('user') || 'dev1';

        // 1. Get exchange rates
        const exchangeRates = await getExchangeRates();

        // 2. Get user with assets
        const user = await prisma.user.findFirst({
            where: { username },
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
            return NextResponse.json({
                error: `Portfolio not found for ${username}`,
                exchangeRates
            });
        }

        // Filter to only active assets (quantity > 0) - same as pages
        const activeAssets = user.Portfolio.Asset.filter(a => a.quantity > 0);

        // 3. Calculate portfolio value using SAME logic as pages
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
            totalValueEUR: Math.round(a.totalValueEUR * 100) / 100
        }));

        return NextResponse.json({
            username,
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
    } catch (error: any) {
        return NextResponse.json({ error: error.toString() }, { status: 500 });
    }
}
