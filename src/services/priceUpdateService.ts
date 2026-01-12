/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { prisma } from '@/lib/prisma';
import { getSearchSymbol } from './marketData';

// const yahooFinance removed (unused)

// ... imports
import { getYahooQuote } from './yahooApi';

export async function updateAllPrices() {
    // 1. Get all unique symbols from Assets with their types and categories
    const assets = await prisma.asset.findMany({
        select: { symbol: true, type: true, exchange: true, category: true },
    });

    // Filter by category according to the 8-category system rules:
    // - TEFAS: Updated separately via TEFAS API (not Yahoo)
    // - CASH: Fixed price 1.0, no API update needed
    const assetsToUpdate = assets.filter(a => a.category !== 'TEFAS' && a.category !== 'CASH');

    console.log(`[PriceServer] Total assets: ${assets.length}, After category filter (excluding TEFAS, CASH): ${assetsToUpdate.length}`);

    // Create unique search symbols using the shared helper
    // Map: SearchSymbol -> Set of OriginalSymbols that map to it
    const searchToOriginals = new Map<string, Set<string>>();
    assetsToUpdate.forEach(a => {
        if (a.symbol) {
            const original = a.symbol.toUpperCase();
            const search = getSearchSymbol(a.symbol, a.type, a.exchange);
            if (!searchToOriginals.has(search)) {
                searchToOriginals.set(search, new Set());
            }
            searchToOriginals.get(search)!.add(original);
        }
    });

    const uniqueSearchSymbols = Array.from(searchToOriginals.keys());

    if (uniqueSearchSymbols.length === 0) return { count: 0, message: "No symbols to update." };

    console.log(`[PriceServer] Found ${uniqueSearchSymbols.length} unique tickers to update.`);

    // 2. Filter Fresh Symbols
    const now = new Date();
    const SKIP_THRESHOLD_MS = 60 * 60 * 1000; // 60 Minutes (Requested by User)

    // Fetch existing cache to check timestamps
    const existingCache = await prisma.priceCache.findMany({
        where: { symbol: { in: uniqueSearchSymbols } },
        select: { symbol: true, updatedAt: true }
    });

    const symbolsToSkip = new Set<string>();
    existingCache.forEach(c => {
        if (now.getTime() - c.updatedAt.getTime() < SKIP_THRESHOLD_MS) {
            symbolsToSkip.add(c.symbol);
        }
    });

    const symbolsToFetch = uniqueSearchSymbols.filter(s => !symbolsToSkip.has(s));

    if (symbolsToFetch.length === 0) {
        console.log(`[PriceServer] All symbols are fresh. Skipping update.`);
        return { success: true, updatedCount: 0, message: "All fresh" };
    }

    console.log(`[PriceServer] updating ${symbolsToFetch.length} symbols: ${symbolsToFetch.join(', ')}`);

    // 3. Process in Parallel Batches using Robust getYahooQuote
    // We use getYahooQuote because it includes fallbacks (AlphaVantage, Direct Chart, Finnhub)
    // which are crucial for BIST stocks like RYGYO/TAVHL that fail in bulk quotes.
    const BATCH_SIZE = 5; // Run 5 concurrent requests
    let updatedCount = 0;
    const errors: any[] = [];

    for (let i = 0; i < symbolsToFetch.length; i += BATCH_SIZE) {
        const batch = symbolsToFetch.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (symbol) => {
            try {
                // forceRefresh = true to ensure we try API
                const quote = await getYahooQuote(symbol, true);
                if (quote) {
                    updatedCount++;
                }
            } catch (err: any) {
                console.error(`[PriceServer] Failed to update ${symbol}:`, err.message);
                errors.push({ symbol, error: err.message });
            }
        }));

        // Small buffer between batches
        if (i + BATCH_SIZE < symbolsToFetch.length) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    console.log(`[PriceServer] Update complete. Updated ${updatedCount}/${symbolsToFetch.length} requested symbols.`);

    // 4. Update Currency Rates (Hourly)
    await updateCurrencyRates();

    return {
        success: true,
        updatedCount,
        totalSymbols: uniqueSearchSymbols.length,
        errors
    };
}

async function updateCurrencyRates() {
    try {
        console.log("[PriceServer] Updating Exchange Rates (EUR base)...");
        const currencies = ['EURUSD=X', 'EURTRY=X', 'EURGBP=X'];

        for (const symbol of currencies) {
            try {
                const q = await getYahooQuote(symbol, true);
                if (!q || !q.regularMarketPrice) continue;

                let currencyCode = '';
                if (q.symbol === 'EURUSD=X') currencyCode = 'USD';
                if (q.symbol === 'EURTRY=X') currencyCode = 'TRY';
                if (q.symbol === 'EURGBP=X') currencyCode = 'GBP';

                if (currencyCode) {
                    await prisma.exchangeRate.upsert({
                        where: { currency: currencyCode },
                        create: { currency: currencyCode, rate: q.regularMarketPrice },
                        update: { rate: q.regularMarketPrice }
                    });
                    // Also cache pure EUR (always 1)
                    await prisma.exchangeRate.upsert({
                        where: { currency: 'EUR' },
                        create: { currency: 'EUR', rate: 1 },
                        update: { rate: 1 }
                    });
                }
            } catch (err) {
                console.error(`[PriceServer] Failed for ${symbol}:`, err);
            }
        }
        console.log("[PriceServer] Exchange Rates updated.");
    } catch (e) {
        console.error("[PriceServer] Failed to update currency rates:", e);
    }
}
