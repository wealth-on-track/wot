/**
 * CACHED Portfolio Metrics - Instant Load
 *
 * Reads ONLY from PriceCache database table.
 * NO external API calls = instant page load.
 * Live updates happen client-side via SSE streaming.
 */

import { prisma } from "@/lib/prisma";
import { AssetDisplay } from "@/lib/types";
import { calculateMarketStatus } from "@/lib/market-timing";

interface CachedPortfolioResult {
    totalValueEUR: number;
    assetsWithValues: AssetDisplay[];
    cacheTimestamps: Record<string, Date>;
}

export async function getCachedPortfolioMetrics(
    assets: any[],
    customRates?: Record<string, number>
): Promise<CachedPortfolioResult> {
    // 1. Get all symbols
    const symbols = assets
        .filter(a => a.type !== 'CASH' && a.type !== 'BES')
        .map(a => a.symbol);

    // 2. Single DB query for all cached prices
    const cachedPrices = await prisma.priceCache.findMany({
        where: { symbol: { in: symbols } },
        select: {
            symbol: true,
            previousClose: true,
            actualPreviousClose: true,
            currency: true,
            updatedAt: true
        }
    });

    const priceMap = new Map(cachedPrices.map(c => [c.symbol, c]));
    const cacheTimestamps: Record<string, Date> = {};

    // 3. Process assets using ONLY cached data
    const assetsWithValues: AssetDisplay[] = assets.map(asset => {
        // Store timestamp
        const cached = priceMap.get(asset.symbol);
        if (cached) {
            cacheTimestamps[asset.symbol] = cached.updatedAt;
        }

        return processAssetCached(asset, cached, customRates);
    });

    // 4. Calculate total
    const totalValueEUR = assetsWithValues.reduce((sum, a) => sum + a.totalValueEUR, 0);

    return {
        totalValueEUR,
        assetsWithValues,
        cacheTimestamps
    };
}

function processAssetCached(
    asset: any,
    cached: { previousClose: number; actualPreviousClose: number | null; currency: string | null } | undefined,
    customRates?: Record<string, number>
): AssetDisplay {
    const assetName = asset.name || asset.symbol;

    // SPECIAL: BES (Turkish Pension)
    if (asset.type === 'BES' && asset.metadata) {
        const besMeta = asset.metadata as any;
        const totalKP = besMeta?.contracts?.reduce((s: number, c: any) => s + (c.katkiPayi || 0), 0) || 0;
        const totalDK = besMeta?.contracts?.reduce((s: number, c: any) => s + (c.devletKatkisi || 0), 0) || 0;
        const besTotalTRY = totalKP + totalDK;

        const tryToEur = customRates?.['TRY'] || 38.5;
        const totalValueEUR = besTotalTRY / tryToEur;
        const totalContributions = totalKP;
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

    // SPECIAL: CASH
    if (asset.type === 'CASH' || asset.symbol === 'EUR') {
        const rate = customRates?.[asset.currency] || 1;
        const totalValueEUR = (asset.quantity * 1) / rate;
        const totalCostEUR = (asset.buyPrice * asset.quantity) / rate;

        return {
            ...asset,
            name: assetName,
            currentPrice: 1,
            previousClose: 1,
            totalValueInAssetCurrency: asset.quantity,
            totalCostInAssetCurrency: asset.buyPrice * asset.quantity,
            totalValueEUR,
            totalCostEUR,
            plValueEUR: totalValueEUR - totalCostEUR,
            plPercentage: 0,
            dailyChange: 0,
            dailyChangePercentage: 0,
            marketState: 'CLOSED',
            nextOpen: null,
            nextClose: null,
        };
    }

    // REGULAR ASSETS - Use cached price or fallback to buyPrice
    // PriceCache stores current price in previousClose field (legacy naming)
    const currentPrice = cached?.previousClose || asset.buyPrice;
    const previousClosePrice = cached?.actualPreviousClose || currentPrice;
    const activeCurrency = asset.currency;

    // Calculate values
    const totalCostInAssetCurrency = asset.buyPrice * asset.quantity;
    const totalValueInAssetCurrency = currentPrice * asset.quantity;

    // Convert to EUR
    const rate = customRates?.[activeCurrency] || 1;
    const totalValueEUR = totalValueInAssetCurrency / rate;
    const totalCostEUR = totalCostInAssetCurrency / rate;

    // P&L
    const plValueEUR = totalValueEUR - totalCostEUR;
    const plPercentage = totalCostEUR > 0 ? ((totalValueEUR / totalCostEUR - 1) * 100) : 0;

    // Daily change
    const dailyChange = currentPrice - previousClosePrice;
    const dailyChangePercentage = previousClosePrice > 0
        ? ((currentPrice - previousClosePrice) / previousClosePrice) * 100
        : 0;

    // Market status
    const marketStateStr = calculateMarketStatus(
        asset.symbol,
        asset.exchange,
        asset.type
    );

    return {
        ...asset,
        name: assetName,
        currentPrice,
        previousClose: previousClosePrice,
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
        // Historical performance - will be filled by live updates
        changePercent1D: dailyChangePercentage,
        changePercent1W: 0,
        changePercent1M: 0,
        changePercentYTD: 0,
        changePercent1Y: 0,
    };
}
