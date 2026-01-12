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
            batch.map((a: any) => ({ symbol: a.symbol, type: a.type, exchange: a.exchange })),
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
        priceData = await getMarketPrice(asset.symbol, asset.type, asset.exchange, forceRefresh, userId);
    }

    const previousClose = (asset.type === 'CASH' || asset.symbol === 'EUR') ? 1 : (priceData ? priceData.price : asset.buyPrice);

    // 1b. Check & Fix Currency Mismatch
    let activeCurrency = asset.currency;

    // AUTO-REPAIR CASH CURRENCY
    if (asset.type === 'CASH') {
        const validCurrencies = ["USD", "EUR", "TRY", "GBP", "JPY", "AUD", "CAD", "CHF", "CNY"];
        if (validCurrencies.includes(asset.symbol) && asset.currency !== asset.symbol) {
            console.log(`[Portfolio] Auto-repairing CASH currency for ${asset.symbol}: ${asset.currency} -> ${asset.symbol}`);
            activeCurrency = asset.symbol;
            await prisma.asset.update({
                where: { id: asset.id },
                data: { currency: activeCurrency }
            }).catch(err => console.warn('[Portfolio] CASH currency auto-fix failed:', err));
        }
    }

    // AUTO-REPAIR CRYPTO/FOREX CURRENCY (Suffix Rule)
    // Fixes issue where BTC-EUR is saved as USD because of API default
    if (asset.symbol.endsWith('-EUR') && asset.currency !== 'EUR') {
        console.log(`[Portfolio] Auto-repairing CRYPTO currency for ${asset.symbol}: ${asset.currency} -> EUR`);
        activeCurrency = 'EUR';
        await prisma.asset.update({
            where: { id: asset.id },
            data: { currency: 'EUR' }
        }).catch(err => console.warn('[Portfolio] Crypto EUR auto-fix failed:', err));
    }
    if (asset.symbol.endsWith('-USD') && asset.currency !== 'USD') {
        console.log(`[Portfolio] Auto-repairing CRYPTO currency for ${asset.symbol}: ${asset.currency} -> USD`);
        activeCurrency = 'USD';
        await prisma.asset.update({
            where: { id: asset.id },
            data: { currency: 'USD' }
        }).catch(err => console.warn('[Portfolio] Crypto USD auto-fix failed:', err));
    }
    if (asset.symbol.endsWith('-TRY') && asset.currency !== 'TRY') {
        console.log(`[Portfolio] Auto-repairing CRYPTO currency for ${asset.symbol}: ${asset.currency} -> TRY`);
        activeCurrency = 'TRY';
        await prisma.asset.update({
            where: { id: asset.id },
            data: { currency: 'TRY' }
        }).catch(err => console.warn('[Portfolio] Crypto TRY auto-fix failed:', err));
    }
    // AUTO-REPAIR COMMODITY (Gram Gold/Silver/AET)
    if ((asset.symbol === 'GAUTRY' || asset.symbol === 'XAGTRY' || asset.symbol === 'AET') && asset.currency !== 'TRY') {
        console.log(`[Portfolio] Auto-repairing SPECIAL currency for ${asset.symbol}: ${asset.currency} -> TRY`);
        activeCurrency = 'TRY';
        await prisma.asset.update({
            where: { id: asset.id },
            data: { currency: 'TRY' }
        }).catch(err => console.warn('[Portfolio] Special TRY auto-fix failed:', err));
    }

    if (priceData?.currency && priceData.currency !== activeCurrency) {
        // GUARD: Never allow converting TEFAS funds (which must be TRY) to USD.
        // ALSO GUARD: CASH assets should never have their currency changed by external price data
        // NEW GUARD: If asset has explicit suffix (-EUR, -USD, -TRY), DO NOT allow external data to change it.
        const isTefasAsset = asset.type === 'TEFAS' || asset.type === 'FON' || asset.type === 'FUND' || asset.exchange === 'TEFAS';
        const isCashAsset = asset.type === 'CASH';
        const isTryingToConvertToUSD = priceData.currency === 'USD';
        const isLockedBySuffix = asset.symbol.endsWith('-EUR') || asset.symbol.endsWith('-USD') || asset.symbol.endsWith('-TRY');
        const isCommodityPair = asset.symbol === 'GAUTRY' || asset.symbol === 'XAGTRY' || asset.symbol === 'AET';

        // Strict protection for TEFAS, CASH, Suffixed Cryptos, and Known Commodities
        if ((isTefasAsset && isTryingToConvertToUSD && activeCurrency === 'TRY') || isCashAsset || isLockedBySuffix || isCommodityPair) {
            if (isCashAsset) {
                console.warn(`[Portfolio] Blocked erroneous currency update for CASH asset ${asset.symbol}. Keeping ${activeCurrency}.`);
            } else if (isLockedBySuffix || isCommodityPair) {
                console.warn(`[Portfolio] Blocked erroneous currency update for Protected Asset ${asset.symbol}. Keeping ${activeCurrency}.`);
            } else {
                console.warn(`[Portfolio] Blocked erroneous currency switch for TEFAS asset ${asset.symbol} (TRY -> USD). Keeping TRY.`);
            }
            // Do NOT update activeCurrency
        } else {
            activeCurrency = priceData.currency;
            prisma.asset.update({
                where: { id: asset.id },
                data: { currency: activeCurrency }
            }).catch(err => console.warn('[Portfolio] Currency auto-fix failed:', err));
        }
    }

    // 1c. Auto-enrich Metadata (Sector, Country)
    if ((!asset.sector && priceData?.sector) || (!asset.country && priceData?.country)) {
        prisma.asset.update({
            where: { id: asset.id },
            data: {
                sector: asset.sector || priceData.sector,
                country: asset.country || priceData.country
            }
        }).catch(err => console.warn('[Portfolio] Metadata auto-enrich failed:', err));
    }

    // 1d. Auto-Persist Logo URL
    let resolvedLogoUrl = asset.logoUrl;
    if (!resolvedLogoUrl) {
        try {
            // Dynamically import to avoid circular dep issues if any, though likely fine static
            const { getLogoUrl } = await import('@/lib/logos');
            const generatedUrl = getLogoUrl(asset.symbol, asset.type, asset.exchange, asset.country || priceData?.country);

            if (generatedUrl) {
                resolvedLogoUrl = generatedUrl;
                console.log(`[Portfolio] Persisting logo for ${asset.symbol}`);
                prisma.asset.update({
                    where: { id: asset.id },
                    data: { logoUrl: generatedUrl }
                }).catch(err => console.warn('[Portfolio] Logo persistence failed:', err));
            }
        } catch (e) {
            console.warn('[Portfolio] Logo generation failed:', e);
        }
    }

    // 2. Calculate Total Value using previous close
    const totalValueNative = previousClose * asset.quantity;

    // 3. Convert to EUR
    const totalValueEUR = await convertCurrency(totalValueNative, activeCurrency, "EUR", customRates);

    // 4. Calculate P/L
    const costBasisNative = asset.buyPrice * asset.quantity;
    const plPercentage = costBasisNative !== 0
        ? ((totalValueNative - costBasisNative) / costBasisNative) * 100
        : 0;

    return {
        id: asset.id,
        symbol: asset.symbol,
        name: assetName, // Use resolved name
        type: asset.type,
        quantity: asset.quantity,
        buyPrice: asset.buyPrice,
        currency: activeCurrency, // Return corrected currency
        previousClose,
        totalValueEUR,
        plPercentage,
        exchange: asset.exchange,
        // SYSTEMATIC RULE: Use database metadata as source of truth, NOT price data
        // Price data is for prices only, metadata comes from search/database
        sector: asset.sector || priceData?.sector,
        country: asset.country || priceData?.country,
        originalName: asset.originalName || undefined,
        logoUrl: resolvedLogoUrl,
        platform: asset.platform || undefined,
        customGroup: asset.customGroup || undefined,
        updatedAt: priceData?.timestamp
    };
}
