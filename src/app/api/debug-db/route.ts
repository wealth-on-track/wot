
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getExchangeRates } from '@/lib/exchangeRates';
import { RATES } from '@/lib/currency';

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const username = url.searchParams.get('user') || 'user1';

        // Get exchange rates
        const exchangeRates = await getExchangeRates();
        const dbRates = await prisma.exchangeRate.findMany();

        // Get user
        const user = await prisma.user.findFirst({
            where: { username },
            include: { Portfolio: true }
        });

        if (!user?.Portfolio) {
            return NextResponse.json({
                error: `Portfolio not found for ${username}`,
                exchangeRates,
                dbRates: dbRates.map(r => ({ currency: r.currency, rate: r.rate })),
                fallbackRates: { EUR: RATES.EUR, USD: RATES.USD, TRY: RATES.TRY }
            });
        }

        const assets = await prisma.asset.findMany({
            where: { portfolioId: user.Portfolio.id, quantity: { gt: 0 } },
            select: {
                symbol: true,
                quantity: true,
                buyPrice: true,
                currency: true,
                type: true
            }
        });

        // Calculate portfolio value using same logic as the app
        let totalCostEUR = 0;
        const assetDetails = assets.map(a => {
            const rate = exchangeRates[a.currency] || RATES[a.currency] || 1;
            const costInCurrency = a.quantity * a.buyPrice;
            const costEUR = costInCurrency / rate;
            totalCostEUR += costEUR;
            return {
                symbol: a.symbol,
                type: a.type,
                quantity: a.quantity,
                buyPrice: a.buyPrice,
                currency: a.currency,
                rate,
                costInCurrency: Math.round(costInCurrency * 100) / 100,
                costEUR: Math.round(costEUR * 100) / 100
            };
        });

        return NextResponse.json({
            user: user.email,
            username: user.username,
            exchangeRates,
            dbRates: dbRates.map(r => ({ currency: r.currency, rate: r.rate, updatedAt: r.updatedAt })),
            fallbackRates: { EUR: RATES.EUR, USD: RATES.USD, TRY: RATES.TRY },
            assets: assetDetails,
            totalCostEUR: Math.round(totalCostEUR * 100) / 100,
            assetCount: assets.length
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.toString() }, { status: 500 });
    }
}
