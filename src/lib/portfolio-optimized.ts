/**
 * OPTIMIZED Portfolio Metrics Calculation
 *
 * Key optimizations:
 * 1. Removed aggressive auto-repair logic (runs on every page load)
 * 2. Batch processing remains
 * 3. Minimal database writes
 * 4. Faster calculation
 * 5. Historical performance calculation for all periods
 */

import { getMarketPrice, convertCurrency } from "@/services/marketData";
import { AssetDisplay } from "@/lib/types";
import { calculateMarketStatus } from "@/lib/market-timing";
import { ensureAssetHistory, getAssetPerformance, ensureFXHistoryRange } from "@/services/historyService";

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

    // Current price from market data
    const currentPrice = (asset.type === 'CASH' || asset.symbol === 'EUR') ? 1 : (priceData ? priceData.price : asset.buyPrice);
    // Previous close for daily change calculation
    // Use nullish coalescing (??) not || because previousClose could be 0 which is falsy
    // Only fallback to currentPrice if previousClose is null/undefined
    const previousClosePrice = (asset.type === 'CASH' || asset.symbol === 'EUR') ? 1 : (priceData?.previousClose ?? currentPrice);

    // Use currency as-is (no auto-repair on read)
    const activeCurrency = asset.currency;

    // If there's a currency mismatch but we can still work with it, just convert
    const priceCurrency = priceData?.currency || activeCurrency;

    // 2. Convert Price to Asset Currency (if needed)
    let currentPriceInAssetCurrency = currentPrice;
    let previousCloseInAssetCurrency = previousClosePrice;

    if (priceCurrency !== activeCurrency && activeCurrency !== 'EUR' && activeCurrency !== 'USD' && activeCurrency !== 'TRY') {
        // Only convert if necessary and if currencies are different
        try {
            currentPriceInAssetCurrency = await convertCurrency(currentPrice, priceCurrency, activeCurrency, customRates);
            previousCloseInAssetCurrency = await convertCurrency(previousClosePrice, priceCurrency, activeCurrency, customRates);
        } catch (e) {
            console.warn(`[Portfolio] Currency conversion failed for ${asset.symbol}:`, e);
            currentPriceInAssetCurrency = currentPrice; // Use as-is if conversion fails
            previousCloseInAssetCurrency = previousClosePrice;
        }
    } else if (priceCurrency !== activeCurrency) {
        // Standard currencies - perform conversion
        try {
            currentPriceInAssetCurrency = await convertCurrency(currentPrice, priceCurrency, activeCurrency, customRates);
            previousCloseInAssetCurrency = await convertCurrency(previousClosePrice, priceCurrency, activeCurrency, customRates);
        } catch (e) {
            currentPriceInAssetCurrency = currentPrice;
            previousCloseInAssetCurrency = previousClosePrice;
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

    // 5. Calculate P&L (each currency in its own terms, then converted to EUR)
    const plValueEUR = totalValueEUR - totalCostEUR;
    const plPercentage = totalCostEUR > 0 ? ((totalValueEUR / totalCostEUR - 1) * 100) : 0;

    // 6. Daily Change (from priceData if available)
    const dailyChange = priceData?.change24h || 0;
    const dailyChangePercentage = priceData?.changePercent || 0;

    // 7. Market Status (Simple String Return)
    const marketStateStr = calculateMarketStatus(
        asset.symbol,
        asset.exchange,
        asset.type
    );

    // 8. Historical Performance (1D, 1W, 1M, YTD, 1Y)
    let changePercent1D = 0;
    let changePercent1W = 0;
    let changePercent1M = 0;
    let changePercentYTD = 0;
    let changePercent1Y = 0;

    // Only fetch historical data for non-CASH assets with quantity
    // Fast initial load: Skip history fetch, background refresh will update later
    const skipHistoryFetch = process.env.FAST_INITIAL_LOAD === 'true';

    if (asset.type !== 'CASH' && asset.quantity > 0 && !skipHistoryFetch) {
        try {
            // Ensure we have historical data (runs in background, cached)
            await ensureAssetHistory(asset.symbol, asset.exchange);

            // Also ensure FX history if currency is different from EUR
            if (activeCurrency !== 'EUR') {
                const fxPair = `EUR${activeCurrency}=X`;
                await ensureFXHistoryRange(fxPair, 400);
            }

            // Get historical performance
            const performance = await getAssetPerformance(
                asset.symbol,
                currentPriceInAssetCurrency,
                activeCurrency,
                customRates,
                'EUR'
            );

            changePercent1D = performance.changePercent1D;
            changePercent1W = performance.changePercent1W;
            changePercent1M = performance.changePercent1M;
            changePercentYTD = performance.changePercentYTD;
            changePercent1Y = performance.changePercent1Y;
        } catch (e) {
            console.warn(`[Portfolio] Historical performance failed for ${asset.symbol}:`, e);
            // Keep defaults (0) on error
        }
    }

    // For 1D: PRIORITIZE historical calculation because it uses validated previousClose
    // Yahoo's priceData.changePercent often uses chartPreviousClose (wrong reference price)
    // For 1W, 1M, YTD, 1Y: Use historical data (only option)
    let yahooChangePercent1D = priceData?.changePercent || 0;

    // VALIDATE Yahoo's 1D change - reject if suspiciously large (>25% in a day is rare)
    // This catches cases where Yahoo uses chartPreviousClose (multi-day range start) instead of yesterday's close
    const MAX_REASONABLE_1D_CHANGE = 25;
    if (Math.abs(yahooChangePercent1D) > MAX_REASONABLE_1D_CHANGE) {
        console.warn(`[Portfolio] ${asset.symbol}: Yahoo 1D change ${yahooChangePercent1D.toFixed(2)}% exceeds ${MAX_REASONABLE_1D_CHANGE}% threshold - rejecting as invalid`);
        yahooChangePercent1D = 0; // Reject suspicious value
    }

    // Debug log for specific symbols
    if (asset.symbol === 'SOI.PA' || asset.symbol === 'AAPL') {
        console.log(`[Portfolio] ${asset.symbol}: historical1D=${changePercent1D.toFixed(2)}%, yahoo1D=${yahooChangePercent1D.toFixed(2)}%`);
    }

    // PRIORITY: Use historical 1D (validated) first, fallback to Yahoo only if historical is 0
    // This prevents Yahoo's incorrect chartPreviousClose-based percentages from being used
    const finalChangePercent1D = changePercent1D !== 0 ? changePercent1D : yahooChangePercent1D;

    // Override changePercent1D with the corrected value
    changePercent1D = finalChangePercent1D;

    const finalDailyChangePercent = finalChangePercent1D;
    // Calculate dailyChange value from percentage if we have valid data
    const finalDailyChange = finalDailyChangePercent !== 0
        ? (previousCloseInAssetCurrency * finalDailyChangePercent / 100)
        : (priceData?.change24h || 0);

    return {
        ...asset,
        name: assetName,
        currentPrice: currentPriceInAssetCurrency,
        previousClose: previousCloseInAssetCurrency,
        totalValueInAssetCurrency,
        totalCostInAssetCurrency,
        totalValueEUR,
        totalCostEUR,
        plValueEUR,
        plPercentage,
        dailyChange: finalDailyChange,
        dailyChangePercentage: finalDailyChangePercent,
        marketState: marketStateStr,
        nextOpen: null,
        nextClose: null,
        changePercent1D,
        changePercent1W,
        changePercent1M,
        changePercentYTD,
        changePercent1Y,
    };
}
