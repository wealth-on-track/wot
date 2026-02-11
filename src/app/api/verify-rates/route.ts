import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getExchangeRates } from '@/lib/exchangeRates';

/**
 * Simple verification endpoint for exchange rates consistency
 * Tests: DB rates, converted values for TRY assets
 */
export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const username = url.searchParams.get('user') || 'dev1';

        // 1. Get exchange rates from DB
        const exchangeRates = await getExchangeRates();
        const dbRates = await prisma.exchangeRate.findMany();

        // 2. Get TRY-denominated assets for user
        const user = await prisma.user.findFirst({
            where: { username },
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
            return NextResponse.json({ error: `User ${username} not found` });
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
            username,
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
    } catch (error: any) {
        return NextResponse.json({ error: error.toString() }, { status: 500 });
    }
}
