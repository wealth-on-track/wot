import { getMarketPrice, convertCurrency, getAssetName } from "@/services/marketData";
import { prisma } from "@/lib/prisma";
import { cleanAssetName } from "@/lib/companyNames";
import { AssetDisplay } from "@/lib/types";

/**
 * Portfolio Metrics Calculator
 * - Batch processing for performance
 * - Background updates for non-blocking operations
 * - Type-safe asset processing
 */

// Type definitions for better type safety
interface AssetInput {
    id: string;
    symbol: string;
    name: string | null;
    type: string;
    category?: string;
    quantity: number;
    buyPrice: number;
    currency: string;
    exchange: string;
    sector: string;
    country: string;
    customSector?: string | null;
    customCountry?: string | null;
    customCurrency?: string | null;
    customType?: string | null;
    customExchange?: string | null;
    platform?: string | null;
    customGroup?: string | null;
    logoUrl?: string | null;
    originalName?: string | null;
    metadata?: any;
}

// Background update queue to prevent memory leaks
const pendingUpdates: Array<() => Promise<void>> = [];
let isProcessingUpdates = false;

/**
 * Queue a database update to run in the background
 * Prevents blocking the main response while ensuring updates complete
 */
function queueBackgroundUpdate(updateFn: () => Promise<void>): void {
    pendingUpdates.push(updateFn);
    processBackgroundUpdates();
}

async function processBackgroundUpdates(): Promise<void> {
    if (isProcessingUpdates || pendingUpdates.length === 0) return;

    isProcessingUpdates = true;

    // Process updates in batches to avoid overwhelming the database
    while (pendingUpdates.length > 0) {
        const batch = pendingUpdates.splice(0, 10);
        try {
            await Promise.allSettled(batch.map(fn => fn()));
        } catch (e) {
            // Silently handle - these are non-critical background updates
            if (process.env.NODE_ENV === 'development') {
                console.warn('[Portfolio] Background update batch error:', e);
            }
        }
    }

    isProcessingUpdates = false;
}

const BATCH_SIZE = 50;

export async function getPortfolioMetrics(
    assets: AssetInput[],
    customRates?: Record<string, number>,
    forceRefresh: boolean = false,
    userId: string = 'System'
): Promise<{ totalValueEUR: number; assetsWithValues: AssetDisplay[] }> {
    if (!assets || assets.length === 0) {
        return { totalValueEUR: 0, assetsWithValues: [] };
    }

    const assetsWithValues: AssetDisplay[] = [];

    // Import Batch Function
    const { getBatchMarketPrices } = await import('@/services/marketData');

    // Process in batches for memory efficiency
    for (let i = 0; i < assets.length; i += BATCH_SIZE) {
        const batch = assets.slice(i, i + BATCH_SIZE);

        // 1. Pre-fetch Market Data for the entire batch
        const marketDataBatch = await getBatchMarketPrices(
            batch.map(a => ({
                symbol: a.symbol,
                type: a.type,
                exchange: a.exchange,
                category: a.category
            })),
            forceRefresh
        );

        // 2. Process assets using pre-fetched data with error isolation
        const batchResults = await Promise.allSettled(
            batch.map(asset =>
                processAsset(asset, customRates, forceRefresh, userId, marketDataBatch[asset.symbol])
            )
        );

        // 3. Collect successful results, log failures
        for (let j = 0; j < batchResults.length; j++) {
            const result = batchResults[j];
            if (result.status === 'fulfilled') {
                assetsWithValues.push(result.value);
            } else {
                console.error(`[Portfolio] Failed to process asset ${batch[j].symbol}:`, result.reason);
                // Add a fallback entry so the asset isn't lost
                assetsWithValues.push(createFallbackAssetDisplay(batch[j]));
            }
        }
    }

    const totalPortfolioValueEUR = assetsWithValues.reduce((sum, asset) => sum + asset.totalValueEUR, 0);

    return {
        totalValueEUR: totalPortfolioValueEUR,
        assetsWithValues
    };
}

/**
 * Create a fallback display for assets that failed processing
 */
function createFallbackAssetDisplay(asset: AssetInput): AssetDisplay {
    return {
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name || asset.symbol,
        type: asset.type,
        quantity: asset.quantity,
        buyPrice: asset.buyPrice,
        currency: asset.currency,
        previousClose: asset.buyPrice, // Use buy price as fallback
        totalValueEUR: 0, // Will be recalculated on next refresh
        plPercentage: 0,
        exchange: asset.exchange,
        sector: asset.sector || '',
        country: asset.country || '',
        logoUrl: asset.logoUrl || undefined,
        platform: asset.platform || undefined,
        customGroup: asset.customGroup || undefined,
        metadata: asset.metadata,
    };
}

import { PriceResult } from "@/services/marketData";

/**
 * Process a single asset and calculate its display values
 * Uses background updates to prevent blocking
 */
async function processAsset(
    asset: AssetInput,
    customRates: Record<string, number> | undefined,
    forceRefresh: boolean,
    userId: string,
    preFetchedPrice?: PriceResult | null
): Promise<AssetDisplay> {
    // Special handling for BES assets - value comes from metadata
    if (asset.type === 'BES' && asset.metadata) {
        const besMeta = asset.metadata;
        const totalKP = besMeta?.contracts?.reduce((s: number, c: any) => s + (c.katkiPayi || 0), 0) || 0;
        const totalDK = besMeta?.contracts?.reduce((s: number, c: any) => s + (c.devletKatkisi || 0), 0) || 0;
        const besTotal = totalKP + totalDK;

        // Convert TRY to EUR
        const tryToEur = await convertCurrency(besTotal, 'TRY', 'EUR', customRates);

        return {
            id: asset.id,
            symbol: asset.symbol,
            name: asset.name || 'BES Emeklilik',
            type: asset.type,
            quantity: 1,
            buyPrice: besTotal,
            currency: 'TRY',
            previousClose: besTotal,
            totalValueEUR: tryToEur,
            plPercentage: 0,
            exchange: '',
            sector: 'Retirement',
            country: 'TR',
            logoUrl: asset.logoUrl || undefined,
            platform: asset.platform || 'Anadolu Hayat',
            customGroup: asset.customGroup || 'Emeklilik',
            metadata: asset.metadata,
        };
    }

    // 0. Lazy Name Repair & Cleaning
    let assetName = asset.name;

    if (!assetName || assetName === asset.symbol) {
        try {
            const fetchedName = await getAssetName(asset.symbol, asset.type);
            if (fetchedName) {
                assetName = fetchedName;
                // Queue background update instead of fire-and-forget
                queueBackgroundUpdate(async () => {
                    await prisma.asset.update({
                        where: { id: asset.id },
                        data: { name: fetchedName }
                    });
                });
            }
        } catch {
            // Silently continue - name is optional
        }
    } else {
        const cleanName = cleanAssetName(assetName);
        if (cleanName !== assetName) {
            assetName = cleanName;
            queueBackgroundUpdate(async () => {
                await prisma.asset.update({
                    where: { id: asset.id },
                    data: { name: cleanName }
                });
            });
        }
    }

    // 1. Get Price (Use Pre-fetched OR Individual Fallback)
    let priceData = preFetchedPrice;
    if (!priceData) {
        // Fallback for non-batchable assets (like TEFAS) or failed batch items
        priceData = await getMarketPrice(asset.symbol, asset.type, asset.exchange, forceRefresh, userId, asset.category);
    }

    const previousClose = (asset.type === 'CASH' || asset.symbol === 'EUR')
        ? 1
        : (priceData?.price ?? asset.buyPrice);

    // ------------------------------------------------------------------
    // 1. DATA RECONCILIATION (System vs User)
    // ------------------------------------------------------------------
    const systemCurrency = asset.currency;
    const systemType = asset.type;
    const systemExchange = asset.exchange;

    // Detect if API has better data for System fields (Non-destructive update)
    if (priceData) {
        // Update Metadata (Sector/Country) only if missing
        const needsMetadataUpdate =
            (!asset.sector && priceData.sector) ||
            (!asset.country && priceData.country);

        if (needsMetadataUpdate) {
            const updateData = {
                sector: asset.sector || priceData.sector,
                country: asset.country || priceData.country
            };
            queueBackgroundUpdate(async () => {
                await prisma.asset.update({
                    where: { id: asset.id },
                    data: updateData
                });
            });
        }

        // AUTO-CORRECT SYSTEM CURRENCY (Safe with customCurrency separation)
        if (priceData.currency && priceData.currency !== systemCurrency) {
            const isTefas = asset.type === 'TEFAS' || asset.type === 'FON';
            const isCash = asset.type === 'CASH';

            if (!isTefas && !isCash) {
                if (process.env.NODE_ENV === 'development') {
                    console.log(`[Portfolio] Auto-aligning currency for ${asset.symbol}: ${systemCurrency} -> ${priceData.currency}`);
                }
                queueBackgroundUpdate(async () => {
                    await prisma.asset.update({
                        where: { id: asset.id },
                        data: { currency: priceData!.currency }
                    });
                });
            }
        }
    }

    // ------------------------------------------------------------------
    // 2. DETERMINE DISPLAY VALUES (User Overrides)
    // ------------------------------------------------------------------
    const displayType = asset.customType || systemType;
    const displayExchange = asset.customExchange || systemExchange;
    const displayCurrency = asset.customCurrency || systemCurrency;

    // ------------------------------------------------------------------
    // 3. PERSIST LOGO URL (If missing)
    // ------------------------------------------------------------------
    let resolvedLogoUrl = asset.logoUrl;
    if (!resolvedLogoUrl) {
        try {
            const { getLogoUrl } = await import('@/lib/logos');
            const generatedUrl = getLogoUrl(asset.symbol, displayType, displayExchange, asset.customCountry || asset.country);
            if (generatedUrl) {
                resolvedLogoUrl = generatedUrl;
                queueBackgroundUpdate(async () => {
                    await prisma.asset.update({
                        where: { id: asset.id },
                        data: { logoUrl: generatedUrl }
                    });
                });
            }
        } catch {
            // Logo is optional, continue without it
        }
    }

    // ------------------------------------------------------------------
    // 4. CALCULATE VALUES
    // ------------------------------------------------------------------
    const currentPriceNative = previousClose; // This is in systemCurrency (e.g. USD)
    const quantity = asset.quantity;

    // Step A: Calculate Native Value (in systemCurrency)
    const totalValueNative = currentPriceNative * quantity;

    // Step B: Convert to Display Currency (if different)
    // Example: Asset is USD (System). User wants EUR (Display). 
    // We convert USD Value -> EUR Value.

    // However, the requested output format assumes "totalValueEUR" is the standard.
    // AND the UI expects "currency" field to imply the currency of `previousClose`.
    // If we return `currency: EUR` (Display), but `previousClose` is 150 (USD), 
    // the UI will show "€150" which is WRONG.

    // CRITICAL DECISION: 
    // The `AssetDisplay` object is strictly "How it looks in the table".
    // If we change the currency to Display Currency, we MUST convert the Price too.

    let finalDisplayPrice = currentPriceNative;
    let finalDisplayValue = totalValueNative;

    // Only convert if display differs from system AND we have specific prices
    if (displayCurrency !== (priceData?.currency || systemCurrency)) {
        // Convert System Currency -> Display Currency
        // We need a helper for straight conversion without "EUR" anchoring if possible,
        // but `convertCurrency` converts TO target.

        const conversionRate = await convertCurrency(1, priceData?.currency || systemCurrency, displayCurrency, customRates);
        finalDisplayPrice = currentPriceNative * conversionRate;
        finalDisplayValue = totalValueNative * conversionRate;
    }

    // Step C: Calculate Total Value in EUR (Global Base) for Portfolio Sum
    // We can convert from Display Currency -> EUR
    const totalValueEUR = await convertCurrency(finalDisplayValue, displayCurrency, "EUR", customRates);

    // Step D: P/L Calculation
    // Cost Basis is historically in... System or User currency?
    // `buyPrice` is usually entered in the currency of the asset (System).
    // If User overrides currency to EUR, did they enter `buyPrice` in EUR? 
    // Assumption: User inputs match the Metadata they set. 
    // If they set Custom Currency = EUR, they likely entered Buy Price in EUR.
    // If Custom Currency is NULL, they entered in System Currency (USD).

    // So:
    // If customCurrency exists -> buyPrice is in customCurrency. compare with finalDisplayPrice (EUR).
    // If customCurrency is null -> buyPrice is in systemCurrency. compare with currentPriceNative (USD).

    const relevantBuyPrice = asset.buyPrice; // Assumed to match the active logic
    const relevantCurrentPrice = asset.customCurrency ? finalDisplayPrice : currentPriceNative;

    const costBasis = relevantBuyPrice * quantity;
    const currentVal = relevantCurrentPrice * quantity;

    const plPercentage = costBasis !== 0
        ? ((currentVal - costBasis) / costBasis) * 100
        : 0;

    return {
        id: asset.id,
        symbol: asset.symbol,
        name: assetName,
        type: displayType,
        quantity: quantity,
        buyPrice: relevantBuyPrice,
        currency: displayCurrency, // UI will show this symbol (e.g. €)
        previousClose: finalDisplayPrice, // UI will show this number
        totalValueEUR,
        plPercentage,
        exchange: displayExchange,
        // SYSTEMATIC RULE: Prioritize user-defined (custom) metadata, then fallback to API
        sector: asset.customSector || asset.sector || priceData?.sector || '',
        country: asset.customCountry || asset.country || priceData?.country || '',
        originalName: asset.originalName || undefined,
        logoUrl: resolvedLogoUrl,
        platform: asset.platform || undefined,
        customGroup: asset.customGroup || undefined,
        updatedAt: priceData?.timestamp,
        metadata: asset.metadata,
    };
}
