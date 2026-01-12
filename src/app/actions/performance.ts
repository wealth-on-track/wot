"use server";

import { getAssetPerformance } from "@/services/historyService";
import { getYahooQuote } from "@/services/yahooApi";
import { Asset } from "@prisma/client";
import { unstable_noStore as noStore } from 'next/cache';

// Flexible type that accepts both Prisma Asset and AssetDisplay
type AssetInput = {
    symbol: string;
    name?: string | null;
    exchange: string;
    type: string;
    currency?: string;
    buyPrice?: number;
    [key: string]: any; // Allow additional properties
};

export async function getBulkAssetPerformance(assets: AssetInput[], targetCurrency: string = 'EUR') {
    // Disable caching to ensure fresh FX calculations every time
    noStore();

    // Import at top level would be better, but file replacement is tricky with imports.
    // We already have 'getAssetPerformance' imported at top.
    // Let's rely on that.

    // Limit concurrency to avoid choking DB/API
    const BATCH_SIZE = 5;
    const results = [];

    // Helper for timeout
    const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
        return Promise.race([
            promise,
            new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))
        ]);
    };

    // Pre-fetch/Ensure FX History for common pairs with COMPLETE range validation
    // This prevents bugs where we have recent FX data but missing historical (1Y ago) data
    const COMMON_PAIRS = ['EURTRY=X', 'EURUSD=X'];
    const { ensureFXHistoryRange } = await import("@/services/historyService");

    // CRITICAL: Force fresh FX data by clearing potentially stale records
    // This ensures we always have accurate historical rates
    const { prisma } = await import("@/lib/prisma");
    for (const pair of COMMON_PAIRS) {
        // Check if data is older than 1 hour - if so, delete and refetch
        const latest = await prisma.assetPriceHistory.findFirst({
            where: { symbol: pair },
            orderBy: { date: 'desc' },
            select: { date: true }
        });

        if (latest && (Date.now() - latest.date.getTime()) > (60 * 60 * 1000)) { // 1 hour
            console.log(`[Performance] Clearing stale FX data for ${pair}`);
            await prisma.assetPriceHistory.deleteMany({
                where: { symbol: pair }
            });
        }
    }

    // Use specialized FX range validator to fetch fresh complete history
    await Promise.all(COMMON_PAIRS.map(p => ensureFXHistoryRange(p, 400).catch(e => console.warn('FX range ensure failed', p, e))));

    for (let i = 0; i < assets.length; i += BATCH_SIZE) {
        const chunk = assets.slice(i, i + BATCH_SIZE);

        const chunkResults = await Promise.all(
            chunk.map(async (asset) => {
                try {
                    // 1. Get Price (Fast)
                    const quote = await getYahooQuote(asset.symbol);
                    const currentPrice = quote?.regularMarketPrice || asset.buyPrice || 0;

                    // 2. Ensure Asset History
                    const { ensureAssetHistory } = await import("@/services/historyService");
                    try {
                        await withTimeout(
                            ensureAssetHistory(asset.symbol, asset.exchange),
                            5000,
                            false
                        );
                    } catch (e) {
                        console.warn(`History fetch timeout/error for ${asset.symbol}`);
                    }

                    // 3. Setup FX Normalization
                    // Use the target currency passed by user (from navbar selection)

                    // Currency Detection - PRIORITY ORDER:
                    // 1. Exchange-based (TEFAS = TRY, .IS suffix = TRY)
                    // 2. Quote currency from Yahoo
                    // 3. Asset currency from DB
                    // 4. Default to USD
                    let assetCurrency: string;

                    if (asset.exchange === 'TEFAS' || asset.exchange === 'FON') {
                        assetCurrency = 'TRY'; // TEFAS funds are always TRY
                    } else if (asset.symbol.endsWith('.IS') || asset.symbol.endsWith('.is')) {
                        assetCurrency = 'TRY'; // Turkish stocks
                    } else {
                        assetCurrency = quote?.currency || asset.currency || 'USD';
                    }

                    assetCurrency = assetCurrency.toUpperCase();

                    // FX Pair Check
                    if (assetCurrency !== targetCurrency) {
                        const pair = `${targetCurrency}${assetCurrency}=X`;
                        // Double check history if it wasn't in common pairs
                        if (!COMMON_PAIRS.includes(pair)) {
                            try { await withTimeout(ensureAssetHistory(pair), 3000, false); } catch { }
                        }
                    }

                    // Get Current Rate for valid conversion
                    let rates: { [key: string]: number } = {};
                    if (assetCurrency !== targetCurrency) {
                        const pair = `${targetCurrency}${assetCurrency}=X`;
                        // Try DB first for speed/reliability if we just ensured it
                        const { prisma } = await import("@/lib/prisma");
                        const latest = await prisma.assetPriceHistory.findFirst({
                            where: { symbol: pair },
                            orderBy: { date: 'desc' },
                            select: { price: true }
                        });

                        if (latest) {
                            rates[assetCurrency] = latest.price;
                        } else {
                            // Fallback to live quote
                            const fxQuote = await getYahooQuote(pair);
                            if (fxQuote?.regularMarketPrice) rates[assetCurrency] = fxQuote.regularMarketPrice;
                        }
                    }

                    // 4. Calc Performance
                    const perf = await getAssetPerformance(asset.symbol, currentPrice, assetCurrency, rates, targetCurrency);

                    return {
                        symbol: asset.symbol,
                        perf,
                        currentPrice
                    };
                } catch (e) {
                    console.error(`Error calculating perf for ${asset.symbol}`, e);
                    return {
                        symbol: asset.symbol,
                        perf: { changePercent1W: 0, changePercent1M: 0, changePercentYTD: 0, changePercent1Y: 0 },
                        currentPrice: asset.buyPrice
                    };
                }
            })
        );
        results.push(...chunkResults);
    }

    return results;
}
