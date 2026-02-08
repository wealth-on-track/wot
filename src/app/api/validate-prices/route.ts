import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface TransactionToValidate {
    date: string;           // ISO date string
    price: number;          // Parsed unit price
    symbol: string;         // GAUTRY or XPTTRY
    externalId?: string;    // To match back to transaction
}

interface ValidationResult {
    externalId?: string;
    yahooPrice: number;
    parsedPrice: number;
    deviation: number;      // Percentage
    isWarning: boolean;     // > 15%
    isCritical: boolean;    // > 30%
}

/**
 * POST /api/validate-prices
 *
 * Validates transaction prices against Yahoo Finance historical data
 * For GAUTRY: Uses GC=F (gold futures) * USDTRY / 31.1034768 to get gram gold price in TRY
 * For XPTTRY: Uses PL=F (platinum futures) * USDTRY / 31.1034768 to get gram platinum price in TRY
 *
 * Body: { transactions: TransactionToValidate[] }
 * Returns: { results: ValidationResult[], errors: string[] }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const transactions: TransactionToValidate[] = body.transactions || [];

        if (transactions.length === 0) {
            return NextResponse.json({ results: [], errors: [] });
        }

        console.log(`[ValidatePrices] Validating ${transactions.length} transactions`);

        // Get all unique dates we need (include all transactions, not just those with price > 0)
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

        // Fetch historical data for all needed symbols
        const [goldPrices, platinumPrices, usdtryPrices] = await Promise.all([
            hasGold ? fetchYahooHistorical('GC=F', startDate, endDate) : Promise.resolve([]),
            hasPlatinum ? fetchYahooHistorical('PL=F', startDate, endDate) : Promise.resolve([]),
            fetchYahooHistorical('USDTRY=X', startDate, endDate)
        ]);

        console.log(`[ValidatePrices] Fetched: Gold=${goldPrices.length}, Platinum=${platinumPrices.length}, USDTRY=${usdtryPrices.length} price points`);

        // Build price caches by date
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

        // Calculate gram gold/platinum prices in TRY for each date
        // Formula: (USD/oz price) * (USDTRY) / 31.1034768
        const TROY_OUNCE_TO_GRAM = 31.1034768;
        const gautryCache = new Map<string, number>();
        const xpttryCache = new Map<string, number>();

        for (const dateStr of allDates) {
            // Find prices for this date or closest available
            const goldUSD = findClosestPrice(goldCache, dateStr, 5);
            const platinumUSD = findClosestPrice(platinumCache, dateStr, 5);
            const usdtry = findClosestPrice(usdtryCache, dateStr, 5);

            if (goldUSD && usdtry) {
                const gramGoldTRY = (goldUSD * usdtry) / TROY_OUNCE_TO_GRAM;
                gautryCache.set(dateStr, gramGoldTRY);
                console.log(`[ValidatePrices] ${dateStr}: Gold $${goldUSD.toFixed(2)}/oz * ${usdtry.toFixed(2)} / ${TROY_OUNCE_TO_GRAM} = ${gramGoldTRY.toFixed(2)} TL/gram`);
            }

            if (platinumUSD && usdtry) {
                const gramPlatinumTRY = (platinumUSD * usdtry) / TROY_OUNCE_TO_GRAM;
                xpttryCache.set(dateStr, gramPlatinumTRY);
                console.log(`[ValidatePrices] ${dateStr}: Platinum $${platinumUSD.toFixed(2)}/oz * ${usdtry.toFixed(2)} / ${TROY_OUNCE_TO_GRAM} = ${gramPlatinumTRY.toFixed(2)} TL/gram`);
            }
        }

        // Validate each transaction
        const results: ValidationResult[] = [];
        for (const tx of transactions) {
            // Don't skip transactions with price <= 0 - we still want to return yahooPrice for reference
            const dateStr = new Date(tx.date).toISOString().split('T')[0];
            const cache = tx.symbol === 'GAUTRY' ? gautryCache : xpttryCache;

            // Find reference price for this date
            let yahooPrice = findClosestPrice(cache, dateStr, 5);

            if (yahooPrice && yahooPrice > 0) {
                // Calculate deviation only if we have a parsed price
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

                if (tx.price > 0 && absDeviation > 15) {
                    console.log(`[ValidatePrices] WARNING: ${tx.externalId || dateStr} - Parsed: ${tx.price.toFixed(2)}, Calculated: ${yahooPrice.toFixed(2)}, Dev: ${deviation.toFixed(1)}%`);
                }
            } else {
                // Still return a result with no yahooPrice so UI knows we tried
                results.push({
                    externalId: tx.externalId,
                    yahooPrice: 0,
                    parsedPrice: tx.price,
                    deviation: 0,
                    isWarning: false,
                    isCritical: false,
                });
                console.log(`[ValidatePrices] No reference price found for ${tx.symbol} on ${dateStr}`);
            }
        }

        console.log(`[ValidatePrices] Validated ${results.length} transactions, ${results.filter(r => r.isWarning).length} warnings, ${results.filter(r => r.isCritical).length} critical`);

        return NextResponse.json({ results, errors });

    } catch (error: any) {
        console.error('[ValidatePrices] Error:', error);
        return NextResponse.json(
            { results: [], errors: [error.message || 'Unknown error'] },
            { status: 500 }
        );
    }
}

/**
 * Find price for a date, or closest available within maxDays
 */
function findClosestPrice(cache: Map<string, number>, dateStr: string, maxDays: number): number | undefined {
    // Try exact date first
    if (cache.has(dateStr)) {
        return cache.get(dateStr);
    }

    // Search nearby dates
    const baseDate = new Date(dateStr);
    for (let offset = 1; offset <= maxDays; offset++) {
        // Try previous day
        const prevDate = new Date(baseDate);
        prevDate.setDate(prevDate.getDate() - offset);
        const prevDateStr = prevDate.toISOString().split('T')[0];
        if (cache.has(prevDateStr)) {
            return cache.get(prevDateStr);
        }

        // Try next day
        const nextDate = new Date(baseDate);
        nextDate.setDate(nextDate.getDate() + offset);
        const nextDateStr = nextDate.toISOString().split('T')[0];
        if (cache.has(nextDateStr)) {
            return cache.get(nextDateStr);
        }
    }

    return undefined;
}

/**
 * Fetch historical prices from Yahoo Finance
 */
async function fetchYahooHistorical(
    symbol: string,
    startDate: Date,
    endDate: Date
): Promise<Array<{ date: string; close: number }>> {
    const period1 = Math.floor(startDate.getTime() / 1000);
    const period2 = Math.floor(endDate.getTime() / 1000);

    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            console.error(`[ValidatePrices] Yahoo API error for ${symbol}: ${response.status}`);
            return [];
        }

        const data = await response.json();
        const result = data.chart?.result?.[0];

        if (!result || !result.timestamp || !result.indicators?.quote?.[0]?.close) {
            console.error(`[ValidatePrices] No data in Yahoo response for ${symbol}`);
            return [];
        }

        const timestamps = result.timestamp;
        const closes = result.indicators.quote[0].close;

        return timestamps
            .map((ts: number, idx: number) => ({
                date: new Date(ts * 1000).toISOString(),
                close: closes[idx],
            }))
            .filter((item: any) => item.close != null && !isNaN(item.close));
    } catch (error) {
        console.error(`[ValidatePrices] Error fetching ${symbol}:`, error);
        return [];
    }
}
