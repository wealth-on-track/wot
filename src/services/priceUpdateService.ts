import { prisma } from '@/lib/prisma';
import { getSearchSymbol } from './marketData';
import { getYahooQuotes, getYahooQuote } from './yahooApi';

// Optimized batch size for Yahoo Finance API
const BATCH_SIZE = 20;
const SKIP_THRESHOLD_MS = 60 * 60 * 1000; // 60 minutes

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

    if (uniqueSearchSymbols.length === 0) {
        return { count: 0, message: "No symbols to update." };
    }

    console.log(`[PriceServer] Found ${uniqueSearchSymbols.length} unique tickers to update.`);

    // 2. Filter Fresh Symbols - Single batch query instead of checking each
    const now = new Date();
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

    console.log(`[PriceServer] Updating ${symbolsToFetch.length} symbols`);

    // 3. Use batch fetch for efficiency (getYahooQuotes handles caching internally)
    let updatedCount = 0;
    const errors: { symbol: string; error: string }[] = [];

    // Process in larger batches using the batch API
    for (let i = 0; i < symbolsToFetch.length; i += BATCH_SIZE) {
        const batch = symbolsToFetch.slice(i, i + BATCH_SIZE);

        try {
            const quotes = await getYahooQuotes(batch, true);
            updatedCount += Object.values(quotes).filter(q => q !== null).length;
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error(`[PriceServer] Batch failed:`, errorMessage);
            batch.forEach(s => errors.push({ symbol: s, error: errorMessage }));
        }

        // Small buffer between batches to avoid rate limiting
        if (i + BATCH_SIZE < symbolsToFetch.length) {
            await new Promise(r => setTimeout(r, 500));
        }
    }

    console.log(`[PriceServer] Update complete. Updated ${updatedCount}/${symbolsToFetch.length} requested symbols.`);

    // 4. Update Currency Rates (Hourly) - in parallel
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
        // Check if rates were updated within the last 60 minutes (same as price threshold)
        const recentRate = await prisma.exchangeRate.findFirst({
            where: { currency: { in: ['USD', 'TRY', 'GBP'] } },
            orderBy: { updatedAt: 'desc' }
        });

        if (recentRate) {
            const timeSinceUpdate = Date.now() - recentRate.updatedAt.getTime();
            if (timeSinceUpdate < SKIP_THRESHOLD_MS) {
                console.log(`[PriceServer] Exchange Rates are fresh (${Math.round(timeSinceUpdate / 60000)}min old). Skipping.`);
                return;
            }
        }

        console.log("[PriceServer] Updating Exchange Rates (EUR base)...");
        const currencies = ['EURUSD=X', 'EURTRY=X', 'EURGBP=X'];

        // Batch fetch all currency rates at once
        const quotes = await getYahooQuotes(currencies, true);

        const updates: Promise<unknown>[] = [];

        for (const [symbol, quote] of Object.entries(quotes)) {
            if (!quote?.regularMarketPrice) continue;

            let currencyCode = '';
            if (symbol === 'EURUSD=X') currencyCode = 'USD';
            if (symbol === 'EURTRY=X') currencyCode = 'TRY';
            if (symbol === 'EURGBP=X') currencyCode = 'GBP';

            if (currencyCode) {
                updates.push(
                    prisma.exchangeRate.upsert({
                        where: { currency: currencyCode },
                        create: { currency: currencyCode, rate: quote.regularMarketPrice },
                        update: { rate: quote.regularMarketPrice }
                    })
                );
            }
        }

        // Always ensure EUR = 1
        updates.push(
            prisma.exchangeRate.upsert({
                where: { currency: 'EUR' },
                create: { currency: 'EUR', rate: 1 },
                update: { rate: 1 }
            })
        );

        // Execute all updates in parallel
        await Promise.all(updates);
        console.log("[PriceServer] Exchange Rates updated.");
    } catch (e) {
        console.error("[PriceServer] Failed to update currency rates:", e);
    }
}
