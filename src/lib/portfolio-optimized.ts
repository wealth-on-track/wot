/**
 * OPTIMIZED Portfolio Metrics Calculation
 *
 * Key optimizations:
 * 1. Removed aggressive auto-repair logic (runs on every page load)
 * 2. Batch processing remains
 * 3. Minimal database writes
 * 4. Faster calculation
 */

import { getMarketPrice, convertCurrency } from "@/services/marketData";
import { AssetDisplay } from "@/lib/types";
import { calculateMarketStatus } from "@/lib/market-timing";

export async function getPortfolioMetricsOptimized(
    assets: any[],
    customRates?: Record<string, number>,
    forceRefresh: boolean = false,
    userId: string = 'System'
): Promise<{ totalValueEUR: number, assetsWithValues: AssetDisplay[] }> {
    const BATCH_SIZE = 50;
    const assetsWithValues: AssetDisplay[] = [];

    // Import Batch Function
    const { getBatchMarketPrices } = await import('@/services/marketData');

    // Process in batches
    for (let i = 0; i < assets.length; i += BATCH_SIZE) {
        const batch = assets.slice(i, i + BATCH_SIZE);

        // 1. Pre-fetch Market Data for the entire batch
        const marketDataBatch = await getBatchMarketPrices(
            batch.map((a: any) => ({ symbol: a.symbol, type: a.type, exchange: a.exchange })),
            forceRefresh
        );

        // 2. Process assets using pre-fetched data (NO auto-repair)
        const batchResults = await Promise.all(batch.map((asset: any) =>
            processAssetFast(asset, customRates, forceRefresh, userId, marketDataBatch[asset.symbol])
        ));

        assetsWithValues.push(...batchResults);
    }

    const totalPortfolioValueEUR = assetsWithValues.reduce((sum, asset) => sum + asset.totalValueEUR, 0);

    return {
        totalValueEUR: totalPortfolioValueEUR,
        assetsWithValues: assetsWithValues
    };
}

import { PriceResult } from "@/services/marketData";

/**
 * Fast asset processing - NO auto-repair, NO database writes
 */
async function processAssetFast(
    asset: any,
    customRates: Record<string, number> | undefined,
    forceRefresh: boolean,
    userId: string,
    preFetchedPrice?: PriceResult | null
): Promise<AssetDisplay> {

    // Use name as-is (no repair)
    const assetName = asset.name || asset.symbol;

    // SPECIAL HANDLING FOR BES (Turkish Individual Pension System)
    // BES value is calculated from metadata.contracts, not market price
    if (asset.type === 'BES' && asset.metadata) {
        const besMeta = asset.metadata as any;
        const totalKP = besMeta?.contracts?.reduce((s: number, c: any) => s + (c.katkiPayi || 0), 0) || 0;
        const totalDK = besMeta?.contracts?.reduce((s: number, c: any) => s + (c.devletKatkisi || 0), 0) || 0;
        const besTotalTRY = totalKP + totalDK;

        // Convert TRY to EUR
        const tryToEur = customRates?.['TRY'] || 38.5; // Fallback rate
        const totalValueEUR = besTotalTRY / tryToEur;

        // Calculate P&L based on total contributions vs current value
        const totalContributions = besMeta?.contracts?.reduce((s: number, c: any) => s + (c.katkiPayi || 0), 0) || 0;
        const totalCostEUR = totalContributions / tryToEur;
        const plValueEUR = totalValueEUR - totalCostEUR;
        const plPercentage = totalCostEUR > 0 ? ((totalValueEUR / totalCostEUR - 1) * 100) : 0;

        return {
            ...asset,
            name: assetName,
            currentPrice: besTotalTRY,
            previousClose: besTotalTRY,
            totalValueInAssetCurrency: besTotalTRY,
            totalCostInAssetCurrency: totalContributions,
            totalValueEUR,
            totalCostEUR,
            plValueEUR,
            plPercentage,
            dailyChange: 0,
            dailyChangePercentage: 0,
            marketState: 'CLOSED',
            nextOpen: null,
            nextClose: null,
        };
    }

    // 1. Get Price (Use Pre-fetched OR Individual Fallback)
    let priceData = preFetchedPrice;
    if (!priceData) {
        // Fallback for non-batchable assets (like TEFAS) or failed batch items
        priceData = await getMarketPrice(asset.symbol, asset.type, asset.exchange, forceRefresh, userId);
    }

    const previousClose = (asset.type === 'CASH' || asset.symbol === 'EUR') ? 1 : (priceData ? priceData.price : asset.buyPrice);

    // Use currency as-is (no auto-repair on read)
    const activeCurrency = asset.currency;

    // If there's a currency mismatch but we can still work with it, just convert
    const priceCurrency = priceData?.currency || activeCurrency;

    // 2. Convert Price to Asset Currency (if needed)
    let currentPriceInAssetCurrency = previousClose;

    if (priceCurrency !== activeCurrency && activeCurrency !== 'EUR' && activeCurrency !== 'USD' && activeCurrency !== 'TRY') {
        // Only convert if necessary and if currencies are different
        try {
            currentPriceInAssetCurrency = await convertCurrency(previousClose, priceCurrency, activeCurrency, customRates);
        } catch (e) {
            console.warn(`[Portfolio] Currency conversion failed for ${asset.symbol}:`, e);
            currentPriceInAssetCurrency = previousClose; // Use as-is if conversion fails
        }
    } else if (priceCurrency !== activeCurrency) {
        // Standard currencies - perform conversion
        try {
            currentPriceInAssetCurrency = await convertCurrency(previousClose, priceCurrency, activeCurrency, customRates);
        } catch (e) {
            currentPriceInAssetCurrency = previousClose;
        }
    }

    // 3. Calculate Values
    const totalCostInAssetCurrency = asset.buyPrice * asset.quantity;
    const totalValueInAssetCurrency = currentPriceInAssetCurrency * asset.quantity;

    // 4. Convert to EUR for Portfolio Total
    let totalValueEUR = 0;
    let totalCostEUR = 0;

    try {
        totalValueEUR = await convertCurrency(totalValueInAssetCurrency, activeCurrency, 'EUR', customRates);
        totalCostEUR = await convertCurrency(totalCostInAssetCurrency, activeCurrency, 'EUR', customRates);
    } catch (e) {
        console.warn(`[Portfolio] EUR conversion failed for ${asset.symbol}:`, e);
        totalValueEUR = totalValueInAssetCurrency; // Fallback
        totalCostEUR = totalCostInAssetCurrency;
    }

    // 5. Calculate P&L
    const plValueEUR = totalValueEUR - totalCostEUR;
    const plPercentage = totalCostEUR > 0 ? ((totalValueEUR / totalCostEUR - 1) * 100) : 0;

    // 6. Daily Change (from priceData if available)
    const dailyChange = priceData?.change24h || 0;
    const dailyChangePercentage = priceData?.changePercent || 0;

    // 7. Market Status
    // 7. Market Status (Simple String Return)
    const marketStateStr = calculateMarketStatus(
        asset.symbol,
        asset.exchange,
        asset.type
    );

    return {
        ...asset,
        name: assetName,
        currentPrice: currentPriceInAssetCurrency,
        previousClose: currentPriceInAssetCurrency,  // Dashboard expects this field name
        totalValueInAssetCurrency,
        totalCostInAssetCurrency,
        totalValueEUR,
        totalCostEUR,
        plValueEUR,
        plPercentage,
        dailyChange,
        dailyChangePercentage,
        marketState: marketStateStr,
        nextOpen: null,
        nextClose: null,
    };
}
