import { getMarketPrice, convertCurrency, getAssetName } from "@/services/marketData";
import { prisma } from "@/lib/prisma";
import { cleanAssetName } from "@/lib/companyNames";


import { AssetDisplay } from "@/lib/types";
import { calculateMarketStatus } from "@/lib/market-timing";

// function estimateFallbackState removed. Using shared calculateMarketStatus logic.

// ... imports

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function getPortfolioMetrics(assets: any[], customRates?: Record<string, number>, forceRefresh: boolean = false, userId: string = 'System'): Promise<{ totalValueEUR: number, assetsWithValues: AssetDisplay[] }> {
    const BATCH_SIZE = 50;
    const assetsWithValues: AssetDisplay[] = [];

    // Import Batch Function
    const { getBatchMarketPrices } = await import('@/services/marketData');

    // Process in batches
    for (let i = 0; i < assets.length; i += BATCH_SIZE) {
        const batch = assets.slice(i, i + BATCH_SIZE);

        // 1. Pre-fetch Market Data for the entire batch
        const marketDataBatch = await getBatchMarketPrices(
            batch.map((a: any) => ({ symbol: a.symbol, type: a.type, exchange: a.exchange, category: a.category })),
            forceRefresh
        );

        // 2. Process assets using pre-fetched data
        const batchResults = await Promise.all(batch.map((asset: any) =>
            processAsset(asset, customRates, forceRefresh, userId, marketDataBatch[asset.symbol])
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

async function processAsset(asset: any, customRates: Record<string, number> | undefined, forceRefresh: boolean, userId: string, preFetchedPrice?: PriceResult | null): Promise<AssetDisplay> {
    // ... name repair logic ...

    // ... (keep auto-repair name logic same as existing if possible, or omit for brevity if not changing) ...
    // Since we are replacing the function signature, we need to keep the body.
    // For brevity of this tool call, I will perform a targeted replace on the signature and the getMarketPrice call.

    // 0. Lazy Name Repair & Cleaning
    let assetName = asset.name;

    if (!assetName || assetName === asset.symbol) {
        try {
            const fetchedName = await getAssetName(asset.symbol, asset.type);
            if (fetchedName) {
                assetName = fetchedName;
                prisma.asset.update({
                    where: { id: asset.id },
                    data: { name: fetchedName }
                }).catch(err => console.warn('[Portfolio] Name auto-repair failed:', err));
            }
        } catch (e) { }
    } else {
        const cleanName = cleanAssetName(assetName);
        if (cleanName !== assetName) {
            assetName = cleanName;
            prisma.asset.update({
                where: { id: asset.id },
                data: { name: cleanName }
            }).catch(err => console.warn('[Portfolio] Name clean auto-repair failed:', err));
        }
    }

    // 1. Get Price (Use Pre-fetched OR Individual Fallback)
    let priceData = preFetchedPrice;
    if (!priceData) {
        // Fallback for non-batchable assets (like TEFAS) or failed batch items
        priceData = await getMarketPrice(asset.symbol, asset.type, asset.exchange, forceRefresh, userId, asset.category);
    }

    const previousClose = (asset.type === 'CASH' || asset.symbol === 'EUR') ? 1 : (priceData ? priceData.price : asset.buyPrice);

    // ------------------------------------------------------------------
    // 1. DATA RECONCILLIATION (System vs User)
    // ------------------------------------------------------------------
    // We now have strict separation:
    // - asset.currency/type/exchange -> SYSTEM TRUTH (matches API/Price Source)
    // - asset.customCurrency etc. -> USER PREFERENCE (matches Display)

    const systemCurrency = asset.currency; // The currency the PRICE is in
    const systemType = asset.type;
    const systemExchange = asset.exchange;

    // Detect if API has better data for System fields (Non-destructive update)
    if (priceData) {
        // Update Metadata (Sector/Country) only if missing
        if ((!asset.sector && priceData.sector) || (!asset.country && priceData.country)) {
            prisma.asset.update({
                where: { id: asset.id },
                data: {
                    sector: asset.sector || priceData.sector,
                    country: asset.country || priceData.country
                }
            }).catch(e => console.warn('[Portfolio] Metadata enrich failed', e));
        }

        // Update Currency safely?
        // Only valid if we trust the API 100%. For now, let's stick to the "Suffix Rules" 
        // we implemented before, or rely on the user having set the correct System Currency initially.
        // Actually, with customCurrency available, we CAN allow the system to self-correct 
        // the `currency` field to match the API, because the User's preference is safe in `customCurrency`.

        // AUTO-CORRECT SYSTEM CURRENCY (Now safe to do!)
        if (priceData.currency && priceData.currency !== systemCurrency) {
            // Exceptions: TEFAS (Must be TRY), CASH (Self)
            const isTefas = asset.type === 'TEFAS' || asset.type === 'FON';
            const isCash = asset.type === 'CASH';

            if (!isTefas && !isCash) {
                console.log(`[Portfolio] Auto-aligning System Currency for ${asset.symbol}: ${systemCurrency} -> ${priceData.currency}`);
                // We update the DB so next fetch is accurate, but for THIS render we use the new data
                prisma.asset.update({
                    where: { id: asset.id },
                    data: { currency: priceData.currency }
                }).catch(e => console.warn('[Portfolio] Currency align failed', e));
                // (Note: We continue using 'activeCurrency' derived below for calculations)
            }
        }
    }

    // ------------------------------------------------------------------
    // 2. DETERMINE DISPLAY VALUES (User Overrides)
    // ------------------------------------------------------------------
    const displayType = asset.customType || systemType;
    const displayExchange = asset.customExchange || systemExchange;

    // Currency is special: It affects Value Calculation
    const displayCurrency = asset.customCurrency || systemCurrency;
    // Effect: We have a Price in systemCurrency. We want to show Value in displayCurrency.

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
                prisma.asset.update({ where: { id: asset.id }, data: { logoUrl: generatedUrl } }).catch(() => { });
            }
        } catch (e) { }
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
        updatedAt: priceData?.timestamp
    };
}
