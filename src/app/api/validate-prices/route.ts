import { NextRequest, NextResponse } from 'next/server';
import {
    apiMiddleware,
    sanitizeError,
    STRICT_RATE_LIMIT
} from '@/lib/api-security';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema
const transactionSchema = z.object({
    date: z.string(),
    price: z.number(),
    symbol: z.enum(['GAUTRY', 'XPTTRY']),
    externalId: z.string().optional(),
});

const requestSchema = z.object({
    transactions: z.array(transactionSchema).max(100, 'Maximum 100 transactions allowed'),
});

interface TransactionToValidate {
    date: string;
    price: number;
    symbol: string;
    externalId?: string;
}

interface ValidationResult {
    externalId?: string;
    yahooPrice: number;
    parsedPrice: number;
    deviation: number;
    isWarning: boolean;
    isCritical: boolean;
}

/**
 * POST /api/validate-prices
 * Validates transaction prices against Yahoo Finance historical data
 *
 * Security:
 * - Requires authentication
 * - Rate limited
 * - Input validation
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

        const validation = requestSchema.safeParse(body);
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

        const transactions: TransactionToValidate[] = validation.data.transactions;

        if (transactions.length === 0) {
            return NextResponse.json({ results: [], errors: [] });
        }

        console.log(`[ValidatePrices] Validating ${transactions.length} transactions`);

        // Get all unique dates
        const allDates = new Set<string>();
        const hasGold = transactions.some(tx => tx.symbol === 'GAUTRY');
        const hasPlatinum = transactions.some(tx => tx.symbol === 'XPTTRY');

        for (const tx of transactions) {
            const dateStr = new Date(tx.date).toISOString().split('T')[0];
            allDates.add(dateStr);
        }

        if (allDates.size === 0) {
            return NextResponse.json({ results: [], errors: [] });
        }

        // Get date range with buffer
        const sortedDates = Array.from(allDates).sort();
        const startDate = new Date(sortedDates[0]);
        const endDate = new Date(sortedDates[sortedDates.length - 1]);
        startDate.setDate(startDate.getDate() - 7);
        endDate.setDate(endDate.getDate() + 7);

        const errors: string[] = [];

        // Fetch historical data
        const [goldPrices, platinumPrices, usdtryPrices] = await Promise.all([
            hasGold ? fetchYahooHistorical('GC=F', startDate, endDate) : Promise.resolve([]),
            hasPlatinum ? fetchYahooHistorical('PL=F', startDate, endDate) : Promise.resolve([]),
            fetchYahooHistorical('USDTRY=X', startDate, endDate)
        ]);

        // Build price caches
        const goldCache = new Map<string, number>();
        const platinumCache = new Map<string, number>();
        const usdtryCache = new Map<string, number>();

        for (const { date, close } of goldPrices) {
            goldCache.set(date.split('T')[0], close);
        }
        for (const { date, close } of platinumPrices) {
            platinumCache.set(date.split('T')[0], close);
        }
        for (const { date, close } of usdtryPrices) {
            usdtryCache.set(date.split('T')[0], close);
        }

        // Calculate prices in TRY
        const TROY_OUNCE_TO_GRAM = 31.1034768;
        const gautryCache = new Map<string, number>();
        const xpttryCache = new Map<string, number>();

        for (const dateStr of allDates) {
            const goldUSD = findClosestPrice(goldCache, dateStr, 5);
            const platinumUSD = findClosestPrice(platinumCache, dateStr, 5);
            const usdtry = findClosestPrice(usdtryCache, dateStr, 5);

            if (goldUSD && usdtry) {
                gautryCache.set(dateStr, (goldUSD * usdtry) / TROY_OUNCE_TO_GRAM);
            }
            if (platinumUSD && usdtry) {
                xpttryCache.set(dateStr, (platinumUSD * usdtry) / TROY_OUNCE_TO_GRAM);
            }
        }

        // Validate transactions
        const results: ValidationResult[] = [];
        for (const tx of transactions) {
            const dateStr = new Date(tx.date).toISOString().split('T')[0];
            const cache = tx.symbol === 'GAUTRY' ? gautryCache : xpttryCache;
            const yahooPrice = findClosestPrice(cache, dateStr, 5);

            if (yahooPrice && yahooPrice > 0) {
                let deviation = 0;
                let absDeviation = 0;

                if (tx.price > 0) {
                    deviation = ((tx.price - yahooPrice) / yahooPrice) * 100;
                    absDeviation = Math.abs(deviation);
                }

                results.push({
                    externalId: tx.externalId,
                    yahooPrice,
                    parsedPrice: tx.price,
                    deviation: Math.round(deviation * 10) / 10,
                    isWarning: tx.price > 0 && absDeviation > 15,
                    isCritical: tx.price > 0 && absDeviation > 30,
                });
            } else {
                results.push({
                    externalId: tx.externalId,
                    yahooPrice: 0,
                    parsedPrice: tx.price,
                    deviation: 0,
                    isWarning: false,
                    isCritical: false,
                });
            }
        }

        return NextResponse.json({ results, errors });

    } catch (error) {
        const sanitized = sanitizeError(error, 'Price validation failed');
        return NextResponse.json(
            { results: [], errors: [sanitized.error] },
            { status: sanitized.status }
        );
    }
}

function findClosestPrice(cache: Map<string, number>, dateStr: string, maxDays: number): number | undefined {
    if (cache.has(dateStr)) {
        return cache.get(dateStr);
    }

    const baseDate = new Date(dateStr);
    for (let offset = 1; offset <= maxDays; offset++) {
        const prevDate = new Date(baseDate);
        prevDate.setDate(prevDate.getDate() - offset);
        const prevDateStr = prevDate.toISOString().split('T')[0];
        if (cache.has(prevDateStr)) {
            return cache.get(prevDateStr);
        }

        const nextDate = new Date(baseDate);
        nextDate.setDate(nextDate.getDate() + offset);
        const nextDateStr = nextDate.toISOString().split('T')[0];
        if (cache.has(nextDateStr)) {
            return cache.get(nextDateStr);
        }
    }

    return undefined;
}

async function fetchYahooHistorical(
    symbol: string,
    startDate: Date,
    endDate: Date
): Promise<Array<{ date: string; close: number }>> {
    const period1 = Math.floor(startDate.getTime() / 1000);
    const period2 = Math.floor(endDate.getTime() / 1000);

    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d`;

    try {
        const response = await fetchWithTimeout(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            return [];
        }

        const data = await response.json();
        const result = data.chart?.result?.[0];

        if (!result?.timestamp || !result?.indicators?.quote?.[0]?.close) {
            return [];
        }

        const timestamps = result.timestamp;
        const closes = result.indicators.quote[0].close;

        return timestamps
            .map((ts: number, idx: number) => ({
                date: new Date(ts * 1000).toISOString(),
                close: closes[idx],
            }))
            .filter((item: { date: string; close: number | null }) => item.close != null && !isNaN(item.close));
    } catch {
        return [];
    }
}
