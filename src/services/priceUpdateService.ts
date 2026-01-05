import { prisma } from '@/lib/prisma';
import YahooFinance from 'yahoo-finance2';
import { detectCurrency } from './yahooApi';
import { getSearchSymbol } from './marketData';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export async function updateAllPrices() {
    // 1. Get all unique symbols from Assets with their types
    const assets = await prisma.asset.findMany({
        select: { symbol: true, type: true },
    });

    // Create unique search symbols using the shared helper
    // Map: SearchSymbol -> Set of OriginalSymbols that map to it
    const searchToOriginals = new Map<string, Set<string>>();
    assets.forEach(a => {
        if (a.symbol) {
            const original = a.symbol.toUpperCase();
            const search = getSearchSymbol(a.symbol, a.type);
            if (!searchToOriginals.has(search)) {
                searchToOriginals.set(search, new Set());
            }
            searchToOriginals.get(search)!.add(original);
        }
    });

    const uniqueSearchSymbols = Array.from(searchToOriginals.keys());

    if (uniqueSearchSymbols.length === 0) return { count: 0, message: "No symbols to update." };

    console.log(`[PriceServer] Found ${uniqueSearchSymbols.length} unique tickers to update.`);

    // 2. Batching
    const BATCH_SIZE = 50;
    let updatedCount = 0;
    const errors: any[] = [];

    for (let i = 0; i < uniqueSearchSymbols.length; i += BATCH_SIZE) {
        const batch = uniqueSearchSymbols.slice(i, i + BATCH_SIZE);

        try {
            // 2.1 Smart Skip Logic
            // Check DB to see if we really need to update these
            const existingCache = await prisma.priceCache.findMany({
                where: {
                    symbol: { in: batch }
                },
                select: { symbol: true, updatedAt: true }
            });

            const now = new Date();
            const SKIP_THRESHOLD_MS = 15 * 60 * 1000; // 15 Minutes

            const symbolsToSkip = new Set<string>();
            existingCache.forEach(c => {
                if (now.getTime() - c.updatedAt.getTime() < SKIP_THRESHOLD_MS) {
                    symbolsToSkip.add(c.symbol);
                }
            });

            const symbolsToFetch = batch.filter(s => !symbolsToSkip.has(s));

            if (symbolsToFetch.length === 0) {
                console.log(`[PriceServer] Batch ${Math.floor(i / BATCH_SIZE) + 1} skipped (All fresh).`);
                continue;
            }

            console.log(`[PriceServer] Fetching batch ${Math.floor(i / BATCH_SIZE) + 1}... (${symbolsToFetch.length} symbols: ${symbolsToFetch.join(', ')})`);

            // Yahoo Finance "quote" method can accept array of symbols
            const results = await yahooFinance.quote(symbolsToFetch, { validateResult: false });
            const quotes = Array.isArray(results) ? results : [results];

            // 3. Update DB
            for (const requestedSymbol of batch) {
                // Find quote that matches requested symbol
                // Yahoo sometimes returns "ASML" for "ASML.AS", so we check both ways if needed
                // but usually the index matches or we can find it.
                const quote = quotes.find(q =>
                    q && q.symbol && (
                        q.symbol.toUpperCase() === requestedSymbol.toUpperCase() ||
                        requestedSymbol.toUpperCase().includes(q.symbol.toUpperCase()) ||
                        q.symbol.toUpperCase().includes(requestedSymbol.toUpperCase())
                    )
                );

                if (!quote) continue;

                const price = quote.regularMarketPrice || 0;
                // Use requested symbol as the primary key for currency detection to be consistent with UI
                const detected = detectCurrency(requestedSymbol);
                const currency = detected || quote.currency || 'USD';

                // Symbols to update: The one we requested + all originals that map to it
                const symbolsToUpdate = new Set([requestedSymbol.toUpperCase()]);

                const originals = searchToOriginals.get(requestedSymbol.toUpperCase());
                if (originals) {
                    originals.forEach(s => symbolsToUpdate.add(s.toUpperCase()));
                }

                // Also update the symbol Yahoo actually returned, just in case
                if (quote.symbol) {
                    symbolsToUpdate.add(quote.symbol.toUpperCase());
                }

                for (const symbol of symbolsToUpdate) {
                    await prisma.priceCache.upsert({
                        where: { symbol },
                        create: {
                            symbol,
                            price,
                            currency,
                            updatedAt: new Date()
                        },
                        update: {
                            price,
                            currency,
                            updatedAt: new Date()
                        }
                    });
                    updatedCount++;
                }
            }

            // Jitter/Sleep to prevent 429
            await new Promise(r => setTimeout(r, 1500));

        } catch (err: any) {
            console.error(`[PriceServer] Batch failed:`, err.message);
            errors.push({ batch: batch, error: err.message });
        }
    }

    console.log(`[PriceServer] Update complete. Updated ${updatedCount}/${uniqueSymbols.length} symbols.`);
    return {
        success: true,
        updatedCount,
        totalSymbols: uniqueSymbols.length,
        errors
    };
}
