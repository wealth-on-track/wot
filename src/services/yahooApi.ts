/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { apiCache } from '@/lib/cache';
import YahooFinance from 'yahoo-finance2';
import { prisma } from '@/lib/prisma';
import { trackApiRequest } from './telemetry';
import { isPriceStale } from './marketData';

const yahooFinance = new YahooFinance({
    suppressNotices: ['yahooSurvey'],
    logger: { info: () => { }, warn: () => { }, error: () => { }, debug: () => { }, dir: () => { } }
});

export interface YahooSymbol {
    symbol: string;
    shortname?: string;
    longname?: string;
    exchange?: string;
    quoteType?: string;
    typeDisp?: string;
}

export interface YahooQuote {
    regularMarketPrice?: number;
    currency?: string;
    regularMarketTime?: Date;
    symbol: string;
    marketState?: string;
    regularMarketPreviousClose?: number;
    earningsTimestamp?: number;
}



async function searchDirect(query: string, useQuery2 = false): Promise<YahooSymbol[]> {
    try {
        const subdomain = useQuery2 ? 'query2' : 'query1';
        console.log(`[YahooApi] Direct Search (${subdomain}): ${query}`);

        // Yahoo Finance Search API
        // query1 is usually faster/newer, query2 is the classic fallback
        const url = `https://${subdomain}.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&lang=en-US&region=US&quotesCount=10&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query&multiQuoteQueryId=multi_quote_single_token_query`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Referer': 'https://finance.yahoo.com/'
            }
        });

        if (!response.ok) {
            console.warn(`[YahooApi] Direct search (${subdomain}) failed: ${response.status} ${response.statusText}`);
            await trackApiRequest(`YAHOO_DIRECT_${subdomain.toUpperCase()}`, false);
            return [];
        }

        const data = await response.json();
        const quotes = data.quotes || [];
        await trackApiRequest(`YAHOO_DIRECT_${subdomain.toUpperCase()}`, true);

        return quotes.map((q: any) => ({
            symbol: q.symbol,
            shortname: q.shortname || q.longname,
            longname: q.longname || q.shortname,
            exchange: q.exchange,
            quoteType: q.quoteType,
            typeDisp: q.typeDisp
        }));

    } catch (e: any) {
        console.warn(`[YahooApi] Direct search error:`, e.message || e);
        // await trackApiRequest('YAHOO_DIRECT', false); // Optional: don't span telemetry with catches
        return [];
    }
}


/**
 * Search for symbols using Yahoo Finance with flexible query variations
 */
export async function searchYahoo(query: string): Promise<YahooSymbol[]> {
    if (!query) return [];

    const cacheKey = `yahoo:search:${query.toLowerCase()}`;
    const cached = apiCache.get<YahooSymbol[]>(cacheKey);

    if (cached) return cached;

    // Generate query variations for fuzzy search
    // e.g., "BTC EUR" -> ["BTC EUR", "BTC-EUR", "BTCEUR"]
    const queryVariations = [
        query,
        query.replace(/\s+/g, '-'),  // Replace spaces with dash
        query.replace(/\s+/g, ''),   // Remove spaces entirely
        query.replace(/-/g, ' '),    // Replace dash with space
    ];

    // Remove duplicates
    const uniqueQueries = [...new Set(queryVariations)];

    // Try each query variation with Primary Search (query1)
    for (const searchQuery of uniqueQueries) {
        const directResults = await searchDirect(searchQuery, false); // False = query1
        if (directResults.length > 0) {
            apiCache.set(cacheKey, directResults, 10);
            return directResults;
        }
    }

    // Fallback: Try Original Query with Secondary Server (query2)
    // This replaces the unstable library call with a controlled fetch
    try {
        console.log(`[YahooApi] Secondary Search Fallback: ${query}`);
        const fallbackResults = await searchDirect(query, true); // True = query2

        if (fallbackResults.length > 0) {
            apiCache.set(cacheKey, fallbackResults, 10);
            return fallbackResults;
        }
    } catch (error: any) {
        console.warn(`[YahooApi] Secondary fallback failed:`, error);
        return [];
    }

    return [];
}

/**
 * Get quote from Yahoo Finance
 */

// 24 Hour constant kept for profile, but let's see where 15 min cache is.
// The caching logic is actually in the `forceRefresh` check and DB `updatedAt` comparison.
// We need to find where the "15 minutes" logic resides. It is likely in `portfolio.ts` or `market-timing.ts`?
// Or maybe simple: if createdAt is older than X.

export const detectCurrency = (sym: string): string | null => {

    if (!sym) return null;
    const s = sym.toUpperCase();

    // Explicit Suffix Rules (Crypto/Pairs)
    if (s.endsWith('-EUR')) return 'EUR';
    if (s.endsWith('-USD')) return 'USD';
    if (s.endsWith('-TRY')) return 'TRY';
    if (s.endsWith('-GBP')) return 'GBP';
    if (s.endsWith('-CAD')) return 'CAD';
    if (s.endsWith('-AUD')) return 'AUD';
    if (s.endsWith('-JPY')) return 'JPY';
    if (s.endsWith('-CHF')) return 'CHF';

    if (s.endsWith('.AS') || s.endsWith('.DE') || s.endsWith('.PA') || s.endsWith('.MI') || s.endsWith('.MC') || s.endsWith('.BR') || s.endsWith('.VI') || s.endsWith('.MA') || s.endsWith('.IR') || s.endsWith('.TR') || s.endsWith('.SW')) return 'EUR';
    if (s.endsWith('.L')) return 'GBP';
    if (s.endsWith('.TO') || s.endsWith('.V') || s.endsWith('.CN') || s.endsWith('.NE')) return 'CAD';
    if (s.endsWith('.AX')) return 'AUD';
    if (s.endsWith('.HK')) return 'HKD';
    if (s.endsWith('.T')) return 'JPY';
    if (s.endsWith('.SI')) return 'SGD';
    if (s.endsWith('.SW')) return 'CHF';
    if (s.endsWith('.JO')) return 'ZAR';
    if (s.endsWith('.IS') || s.endsWith('TRY')) return 'TRY'; // BIST and GAUTRY, XAUTRY, etc.

    // Default to USD only for dotless tickers that don't look like pairs
    if (!s.includes('.')) return 'USD';

    return null;
};

// Simple helper to identify Crypto for 24/7 Open status
function isCrypto(symbol: string): boolean {
    const s = symbol.toUpperCase();
    return s.endsWith('-USD') || s.endsWith('-EUR') || s.includes('BTC') || s.includes('ETH') || s.includes('XRP');
}

// Simple helper to estimate US Market State (9:30 AM - 4:00 PM ET)
// ET is UTC-5 (or -4 in Daylight). Simplified to 14:30 - 21:00 UTC for now.
function getEstimatedUSMarketState(): string {
    const now = new Date();
    const output = now.getUTCHours() * 60 + now.getUTCMinutes(); // Minutes from midnight UTC
    // Market Open: 14:30 UTC (870 min) -> 21:00 UTC (1260 min)
    // This is approximate but better than nothing for fallbacks
    if (output >= 870 && output < 1260) return 'REGULAR';
    return 'CLOSED';
}

export async function getYahooQuote(symbol: string, forceRefresh: boolean = false): Promise<YahooQuote | null> {
    // Ticker Normalization (Force correct symbols for known issues)
    if (symbol.toUpperCase() === 'SOIT.PA') symbol = 'SOI.PA';

    const forcedCurrency = detectCurrency(symbol);

    try {

        // 1. Check Memory Cache (Skip if forceRefresh)
        const cacheKey = `yahoo:quote:${symbol}`;
        if (!forceRefresh) {
            const cachedData = apiCache.get<YahooQuote>(cacheKey);
            if (cachedData) {
                // Hotfix: Ensure cached data also has correct currency
                if (forcedCurrency && cachedData.currency !== forcedCurrency) {
                    cachedData.currency = forcedCurrency;
                }
                return cachedData;
            }
        }

        // 2. Check DB Cache (Skip if forceRefresh)
        // User requested "Closing Price" strategy. We prioritize stability.
        // If we have ANY data in DB, we use it to render the page fast and error-free.
        if (!forceRefresh) {
            const dbCache = await prisma.priceCache.findUnique({ where: { symbol } });

            if (dbCache) {
                // Check age (1 Hour Cache)
                const now = new Date().getTime();
                const updated = new Date(dbCache.updatedAt).getTime();
                const isFresh = (now - updated) < (60 * 60 * 1000);

                if (isFresh) {
                    const quote: YahooQuote = {
                        symbol: dbCache.symbol,
                        regularMarketPrice: dbCache.previousClose,
                        // Respect TEFAS currency, otherwise fallback to detection
                        currency: (dbCache.source === 'TEFAS' || dbCache.source === 'FON') ? dbCache.currency : (forcedCurrency || dbCache.currency),
                        regularMarketTime: dbCache.tradeTime || dbCache.updatedAt,
                        regularMarketPreviousClose: dbCache.previousClose,
                        marketState: undefined
                    };

                    // Aggressive caching: Reuse DB data for 10 minutes in memory
                    apiCache.set(cacheKey, quote, 10);
                    return quote;
                }
            }
        }

        // 3. Fetch from API
        // Prioritize Direct Chart for freshness as it is more resilient
        console.log(`[YahooApi] Fetching fresh quote for ${symbol}...`);
        const directQuote = await getDirectQuoteFallback(symbol);
        if (directQuote) {
            // Success with direct, we don't even need the library
            return directQuote;
        }

        // 4. Library Fallback (Only if direct fails)
        try {
            const result = await yahooFinance.quote(symbol);
            if (!result || !result.symbol) throw new Error("No Result");

            await trackApiRequest('YAHOO', true, { endpoint: 'quote_lib', params: symbol });
            // ... Logic continues ...

            // --- CLOSING PRICE LOGIC ---
            // We always want the LATEST available price (regularMarketPrice).
            const effectivePrice = result.regularMarketPrice;
            const effectiveCurrency = forcedCurrency || result.currency; // Override with detected currency if available

            const quote: YahooQuote = {
                symbol: result.symbol,
                regularMarketPrice: effectivePrice,
                currency: effectiveCurrency,
                regularMarketTime: result.regularMarketTime,
                marketState: result.marketState,
                regularMarketPreviousClose: (result as any).main_regularMarketPreviousClose || result.regularMarketPreviousClose,
                earningsTimestamp: (result as any).earningsTimestamp || (result as any).earningsTimestampStart
            };

            // Save to DB
            await prisma.priceCache.upsert({
                where: { symbol: quote.symbol },
                create: {
                    symbol: quote.symbol,
                    previousClose: quote.regularMarketPrice || 0,
                    currency: quote.currency || 'USD',
                    tradeTime: quote.regularMarketTime,
                    updatedAt: new Date()
                },
                update: {
                    previousClose: quote.regularMarketPrice || 0,
                    currency: quote.currency || 'USD',
                    tradeTime: quote.regularMarketTime,
                    updatedAt: new Date()
                    // Note: We deliberately OMIT sector and country here so we don't
                    // overwrite them with nulls if this is a price-only update.
                }
            }).catch(err => console.error('[YahooApi] DB Upsert Error:', err));

            // Crypto 7/24 Logic
            if (isCrypto(quote.symbol)) {
                quote.marketState = 'REGULAR';
            }

            // Save to Memory
            apiCache.set(cacheKey, quote, 0.5);

            return quote;

        } catch (innerError) {
            throw innerError; // Rethrow to trigger outer catch block
        }

    } catch (error: any) {
        console.warn(`[YahooApi] Primary quote failed for ${symbol}:`, error?.message || error);
        await trackApiRequest('YAHOO', false, { endpoint: 'quote_lib', params: symbol, error: error?.message || String(error) });

        // Use the detectCurrency defined at the top of the function
        const forcedCurrencyFallback = detectCurrency(symbol);

        // FALLBACK 1: Direct Chart API (Most robust against 429s)
        const directQuote = await getDirectQuoteFallback(symbol);
        if (directQuote) return directQuote;

        // FALLBACK 2: Alpha Vantage Quote
        try {
            console.log(`[YahooApi] Trying Alpha Vantage Quote fallback for ${symbol}...`);
            const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`, { cache: 'no-store' });
            const data = await response.json();
            const globalQuote = data['Global Quote'];

            if (globalQuote && globalQuote['05. price']) {
                const quote: YahooQuote = {
                    symbol: symbol,
                    regularMarketPrice: parseFloat(globalQuote['05. price']),
                    currency: forcedCurrencyFallback || 'USD',
                    regularMarketTime: new Date(),
                    regularMarketPreviousClose: parseFloat(globalQuote['08. previous close']),
                    marketState: getEstimatedUSMarketState()
                };

                // Save to DB
                await prisma.priceCache.upsert({
                    where: { symbol: quote.symbol },
                    create: { symbol: quote.symbol, previousClose: quote.regularMarketPrice || 0, currency: quote.currency || 'USD', tradeTime: quote.regularMarketTime, updatedAt: new Date() },
                    update: { previousClose: quote.regularMarketPrice || 0, currency: quote.currency || 'USD', tradeTime: quote.regularMarketTime, updatedAt: new Date() }
                }).catch(err => console.error('[YahooApi] DB Upsert (Alpha) Error:', err));

                return quote;
            }
        } catch (e) {
            console.warn(`[YahooApi] Alpha Vantage fallback failed:`, e);
        }

        // FALLBACK 3: Finnhub Quote
        try {
            console.log(`[YahooApi] Trying Finnhub Quote fallback for ${symbol}...`);
            const { getQuote } = await import('./finnhubApi');
            const finnhubQuote = await getQuote(symbol);

            if (finnhubQuote && finnhubQuote.c > 0) {
                const quote: YahooQuote = {
                    symbol: symbol,
                    regularMarketPrice: finnhubQuote.c,
                    currency: forcedCurrencyFallback || 'USD',
                    regularMarketTime: new Date(finnhubQuote.t * 1000),
                    regularMarketPreviousClose: finnhubQuote.pc,
                    marketState: getEstimatedUSMarketState()
                };

                await prisma.priceCache.upsert({
                    where: { symbol: quote.symbol },
                    create: { symbol: quote.symbol, previousClose: quote.regularMarketPrice || 0, currency: quote.currency || 'USD', tradeTime: quote.regularMarketTime, updatedAt: new Date() },
                    update: { previousClose: quote.regularMarketPrice || 0, currency: quote.currency || 'USD', tradeTime: quote.regularMarketTime, updatedAt: new Date() }
                }).catch(err => console.error('[YahooApi] DB Upsert (Finnhub) Error:', err));

                return quote;
            }
        } catch (e) {
            console.warn(`[YahooApi] Finnhub fallback failed:`, e);
        }

        console.warn(`[YahooApi] All quote sources failed for ${symbol}.`);

        // Last Resort: Return any stale data if we have it
        const dbCachedFallback = await prisma.priceCache.findUnique({ where: { symbol } });
        if (dbCachedFallback) {
            console.warn(`[YahooApi] Rate Limit/Errors for ${symbol}. Returning stale DB data.`);
            return {
                symbol: dbCachedFallback.symbol,
                regularMarketPrice: dbCachedFallback.previousClose,
                currency: forcedCurrencyFallback || dbCachedFallback.currency,
                regularMarketTime: dbCachedFallback.tradeTime || dbCachedFallback.updatedAt
            };
        }

        // NEGATIVE CACHING: Save ERROR source so we don't spam API
        await prisma.priceCache.upsert({
            where: { symbol },
            create: {
                symbol,
                previousClose: 0,
                currency: forcedCurrencyFallback || 'USD',
                tradeTime: new Date(),
                updatedAt: new Date(),
                source: 'ERROR'
            },
            update: {
                // Only update if it's not already broken (preserve old data if we made a mistake?)
                // Actually if it failed all sources, it's definitely broken right now.
                previousClose: 0,
                currency: forcedCurrencyFallback || 'USD',
                tradeTime: new Date(),
                updatedAt: new Date(),
                source: 'ERROR'
            }
        }).catch(err => console.error('[YahooApi] DB Upsert (ERROR) Error:', err));
    }


    return null;
}

/**
 * BATCH FETCH: Get multiple quotes from Yahoo Finance
 * Efficiently handles arrays of symbols in single requests.
 */
export async function getYahooQuotes(symbols: string[], forceRefresh: boolean = false): Promise<Record<string, YahooQuote | null>> {
    if (!symbols.length) return {};

    const results: Record<string, YahooQuote | null> = {};

    // Normalize input symbols
    const normalizedSymbols = symbols.map(s => s.toUpperCase() === 'SOIT.PA' ? 'SOI.PA' : s);
    let missingSymbols: string[] = [];

    // 1. Check Memory Cache FIRST (instant)
    const symbolsToCheckDB: string[] = [];
    for (const symbol of normalizedSymbols) {
        const cacheKey = `yahoo:quote:${symbol}`;
        if (!forceRefresh) {
            const cachedData = apiCache.get<YahooQuote>(cacheKey);
            if (cachedData) {
                results[symbol] = cachedData;
                continue;
            }
        }
        symbolsToCheckDB.push(symbol);
    }

    // 2. BATCH DB READ - Single query instead of N queries
    if (symbolsToCheckDB.length > 0 && !forceRefresh) {
        const dbCaches = await prisma.priceCache.findMany({
            where: { symbol: { in: symbolsToCheckDB } }
        });

        const dbCacheMap = new Map(dbCaches.map(c => [c.symbol, c]));

        for (const symbol of symbolsToCheckDB) {
            const dbCache = dbCacheMap.get(symbol);
            if (dbCache && !isPriceStale(dbCache.updatedAt)) {
                const quote: YahooQuote = {
                    symbol: dbCache.symbol,
                    regularMarketPrice: dbCache.previousClose,
                    currency: (dbCache.source === 'TEFAS' || dbCache.source === 'FON') ? dbCache.currency : (detectCurrency(dbCache.symbol) || dbCache.currency),
                    regularMarketTime: dbCache.tradeTime || dbCache.updatedAt,
                    regularMarketPreviousClose: dbCache.previousClose,
                    marketState: undefined
                };
                const cacheKey = `yahoo:quote:${symbol}`;
                apiCache.set(cacheKey, quote, 10);
                results[symbol] = quote;
            } else {
                missingSymbols.push(symbol);
            }
        }
    } else {
        missingSymbols = symbolsToCheckDB;
    }

    // Deduplicate missing symbols
    missingSymbols = [...new Set(missingSymbols)];

    if (missingSymbols.length === 0) return results;

    // 3. Fetch Missing from API (Batch)
    try {
        console.log(`[YahooApi] Batch Fetching for ${missingSymbols.length} symbols:`, missingSymbols);

        // Yahoo library supports array of symbols for 'quote'
        const quotes = await yahooFinance.quote(missingSymbols);

        // Collect DB writes for parallel execution
        const dbWrites: Promise<any>[] = [];

        // Map back to our structure
        for (const q of quotes) {
            const forcedCurrency = detectCurrency(q.symbol);
            const quote: YahooQuote = {
                symbol: q.symbol,
                regularMarketPrice: q.regularMarketPrice,
                currency: forcedCurrency || q.currency,
                regularMarketTime: q.regularMarketTime,
                marketState: q.marketState,
                regularMarketPreviousClose: (q as any).regularMarketPreviousClose,
                earningsTimestamp: (q as any).earningsTimestamp
            };

            // Save to Results
            results[q.symbol] = quote;
            const inputSymbol = missingSymbols.find(s => s.toUpperCase() === q.symbol.toUpperCase());
            if (inputSymbol) results[inputSymbol] = quote;

            // Save to Memory Cache immediately
            const cacheKey = `yahoo:quote:${q.symbol}`;
            apiCache.set(cacheKey, quote, 0.5);

            // Queue DB write (non-blocking)
            dbWrites.push(
                prisma.priceCache.upsert({
                    where: { symbol: quote.symbol },
                    create: {
                        symbol: quote.symbol,
                        previousClose: quote.regularMarketPrice || 0,
                            currency: quote.currency || 'USD',
                        tradeTime: quote.regularMarketTime,
                        updatedAt: new Date()
                    },
                    update: {
                        previousClose: quote.regularMarketPrice || 0,
                            currency: quote.currency || 'USD',
                        tradeTime: quote.regularMarketTime,
                        updatedAt: new Date()
                    }
                }).catch(e => console.warn(`[YahooApi] Batch Write Error for ${q.symbol}`, e))
            );
        }

        // Execute all DB writes in parallel (fire-and-forget style, don't block response)
        Promise.all(dbWrites).catch(() => { });

        // 4. Handle missed symbols - use cache values or null (skip slow fallbacks for speed)
        for (const s of missingSymbols) {
            if (!results[s]) {
                // Don't do expensive individual fallbacks - just return null
                // The next refresh will try again
                console.warn(`[YahooApi] Batch missed ${s}, skipping fallback for speed`);
                results[s] = null;
            }
        }

    } catch (e: any) {
        console.warn('[YahooApi] Batch Fetch Error (likely 429/Crumb):', e.message || e);
        // Quick fallback: Try Direct Chart API in parallel (limited concurrency)
        const PARALLEL_LIMIT = 5;
        for (let i = 0; i < missingSymbols.length; i += PARALLEL_LIMIT) {
            const batch = missingSymbols.slice(i, i + PARALLEL_LIMIT);
            await Promise.all(batch.map(async (s) => {
                try {
                    const fallback = await getDirectQuoteFallback(s);
                    results[s] = fallback;
                } catch {
                    results[s] = null;
                }
            }));
        }
    }

    return results;
}



function deriveMarketState(meta: any): string {
    if (meta.marketState) return meta.marketState;
    if (meta.exchangeState) return meta.exchangeState;

    // Fallback: Check Trading Periods
    const cp = meta.currentTradingPeriod;
    if (cp) {
        const now = Math.floor(Date.now() / 1000); // Yahoo uses Unix seconds

        if (cp.regular && now >= cp.regular.start && now < cp.regular.end) return 'REGULAR';
        if (cp.pre && now >= cp.pre.start && now < cp.pre.end) return 'PRE';
        if (cp.post && now >= cp.post.start && now < cp.post.end) return 'POST';

        // If outside all periods, assume closed
        return 'CLOSED';
    }

    return 'CLOSED'; // Default fallback
}

/**
 * Robust Direct Fetch Fallback using the Chart API
 */
async function getDirectQuoteFallback(symbol: string): Promise<YahooQuote | null> {
    const forcedCurrency = detectCurrency(symbol);
    try {
        console.log(`[YahooApi] Direct Chart Fallback for ${symbol}`);
        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*'
            },
            cache: 'no-store'
        });

        if (response.ok) {
            const data = await response.json();
            const result = data.chart?.result?.[0];
            if (result?.meta) {
                const quote: YahooQuote = {
                    symbol: result.meta.symbol,
                    regularMarketPrice: result.meta.regularMarketPrice,
                    currency: forcedCurrency || result.meta.currency || 'USD',
                    regularMarketTime: new Date(result.meta.regularMarketTime * 1000),
                    regularMarketPreviousClose: result.meta.chartPreviousClose,
                    marketState: deriveMarketState(result.meta)
                };

                await prisma.priceCache.upsert({
                    where: { symbol: quote.symbol },
                    create: {
                        symbol: quote.symbol,
                        previousClose: quote.regularMarketPrice || 0,
                            currency: quote.currency || 'USD',
                        tradeTime: quote.regularMarketTime,
                        updatedAt: new Date()
                    },
                    update: {
                        previousClose: quote.regularMarketPrice || 0,
                            currency: quote.currency || 'USD',
                        tradeTime: quote.regularMarketTime,
                        updatedAt: new Date()
                    }
                });

                await trackApiRequest('YAHOO_DIRECT', true, { endpoint: 'chart', params: symbol });
                return quote;
            }
            else {
                console.warn(`[YahooApi] Direct Fallback: No meta in result for ${symbol}`);
                await trackApiRequest('YAHOO_DIRECT', false, { endpoint: 'chart', params: symbol, error: 'No Meta' });
            }
        } else {
            console.warn(`[YahooApi] Direct Fallback Failed for ${symbol}: Status ${response.status} ${response.statusText}`);
            await trackApiRequest('YAHOO_DIRECT', false, { endpoint: 'chart', params: symbol, error: `Status ${response.status}` });
        }
    } catch (e) {
        console.warn(`[YahooApi] Direct Chart fallback failed for ${symbol}:`, e);
        await trackApiRequest('YAHOO_DIRECT', false, { endpoint: 'chart', params: symbol, error: String(e) });
    }
    return null;
}

/**
 * Get Profile/Summary for a symbol (Country, Sector, Industry)
 */
export async function getYahooAssetProfile(symbol: string): Promise<{ country?: string, sector?: string, industry?: string } | null> {
    const cacheKey = `yahoo_profile_${symbol}`;

    // Check memory cache first (24 hours)
    const cached = apiCache.get<{ country?: string, sector?: string, industry?: string }>(cacheKey);
    if (cached) {
        return cached;
    }

    try {
        // ATTEMPT 1: Try quote endpoint first (faster, less rate-limited)
        try {
            const quote = await yahooFinance.quote(symbol);
            if (quote && (quote as any).sector) {
                const profileData = {
                    country: (quote as any).country,
                    sector: (quote as any).sector,
                    industry: (quote as any).industry
                };
                // Cache for 24 hours
                apiCache.set(cacheKey, profileData, 1440);
                return profileData;
            }
        } catch (e) {
            // Continue to quoteSummary
        }

        // ATTEMPT 2: Try quoteSummary (more detailed but rate-limited)
        const result = await yahooFinance.quoteSummary(symbol, { modules: ['summaryProfile', 'assetProfile', 'summaryDetail'] });
        const summary = result.summaryProfile || result.assetProfile || (result as any).summaryDetail;

        if (summary) {
            const profileData = {
                country: summary.country,
                sector: summary.sector,
                industry: summary.industry
            };
            // Cache for 24 hours
            apiCache.set(cacheKey, profileData, 1440);
            return profileData;
        }
    } catch (e: any) {
        if (e.code !== 404) {
            console.warn(`[YahooApi] Profile Fetch Error for ${symbol}:`, e.message || e);
        }
    }

    // Cache null result for 1 hour to avoid repeated failed requests
    apiCache.set(cacheKey, null, 60);
    return null;
}

/**
 * Attempt to find ISIN for a symbol using Yahoo Search
 * Useful for bridging Yahoo tickers (e.g. ABN.AS) to Finnhub (requires ISIN)
 */
export async function getISINFromYahoo(symbol: string): Promise<string | null> {
    try {
        // We use the existing search function which caches results
        const results = await searchDirect(symbol); // Use direct search to get 'exchange' and 'symbol'
        // Unfortunately, public search doesn't reliably return ISIN.
        // We might need to use the 'quote' endpoint again but specifically look for ISIN in other fields?
        // Actually, let's try 'searchYahoo' which uses the library if direct fails.
        // But the library 'search' results generally don't have ISIN.

        // Alternative: Try to fetch 'quote' and check for ISIN hidden field
        try {
            const quote = await yahooFinance.quote(symbol);
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
            if ((quote as any).isin) return (quote as any).isin;
        } catch { }

        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Attempt to find a US Proxy Ticker (e.g. ADYEN.AS -> ADYEY)
 * This allows us to query Finnhub/AlphaVantage using the US ticker to get metadata (Sector/Country)
 * which is usually shared with the foreign listing.
 */
export async function getUSProxySymbol(symbol: string, companyName?: string): Promise<string | null> {
    try {
        let results: any[] = [];

        // Strategy A: Search by Company Name (Most accurate for Finding ADRs)
        // e.g. "Airbus" -> "EADSY" (OTC)
        if (companyName) {
            // Clean common legal suffixes for better search
            const cleanName = companyName
                .replace(/ (SE|NV|AG|SA|PLC|LTD|INC|CORP|GROUP|HOLDINGS)\.?$/i, '')
                .trim();

            if (cleanName.length > 2) {
                results = await searchDirect(cleanName);
            }
        }

        // Strategy B: Search by Ticker Base (if name search failed or wasn't provided)
        // e.g. "ADYEN.AS" -> "ADYEN" -> "ADYEY"
        if (results.length === 0) {
            const base = symbol.split('.')[0];
            if (base && base.length >= 2) {
                results = await searchDirect(base);
            }
        }

        // 3. Look for US Equity (PNK, OTC, NMS, NYQ, NGM, PCX, OQX, OBB)
        // Usually 5 letters ending in Y or F for ADRs
        const usProxy = results.find((q: any) =>
            (q.exchange === 'PNK' || q.exchange === 'OTC' || q.exchange === 'NMS' || q.exchange === 'NYQ' || q.exchange === 'NGM' || q.exchange === 'PCX' || q.exchange === 'OQX' || q.exchange === 'OBB') &&
            (q.quoteType === 'EQUITY') &&
            !q.symbol.includes('.') && // US tickers rarely have dots
            q.symbol !== symbol // Don't return self
        );

        return usProxy ? usProxy.symbol : null;
    } catch (e) {
        console.warn(`[getUSProxySymbol] Error finding proxy for ${symbol}:`, e);
        return null;
    }
}
