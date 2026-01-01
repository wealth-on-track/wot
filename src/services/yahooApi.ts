import { apiCache } from '@/lib/cache';
import YahooFinance from 'yahoo-finance2';
import { prisma } from '@/lib/prisma';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

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

async function searchDirect(query: string): Promise<YahooSymbol[]> {
    try {
        console.log(`[YahooApi] Fallback Direct Search: ${query}`);
        const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=5&newsCount=0`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': 'https://finance.yahoo.com',
                'Referer': 'https://finance.yahoo.com/',
                'Accept': '*/*'
            }
        });

        if (!response.ok) {
            console.error(`[YahooApi] Direct search failed: ${response.status}`);
            return [];
        }

        const data = await response.json();
        const quotes = data.quotes || [];

        return quotes.map((q: any) => ({
            symbol: q.symbol,
            shortname: q.shortname,
            longname: q.longname,
            exchange: q.exchange,
            quoteType: q.quoteType,
            typeDisp: q.typeDisp
        }));

    } catch (e) {
        console.error('[YahooApi] Direct search error:', e);
        return [];
    }
}

/**
 * Search for symbols using Yahoo Finance
 */
export async function searchYahoo(query: string): Promise<YahooSymbol[]> {
    if (!query) return [];

    const cacheKey = `yahoo:search:${query.toLowerCase()}`;
    const cached = apiCache.get<YahooSymbol[]>(cacheKey);

    if (cached) return cached;

    try {
        console.log(`[YahooApi] Searching with Library: ${query}`);
        const results = await yahooFinance.search(query);
        const quotes = results.quotes.filter((q: any) => q.isYahooFinance);

        const mapped = quotes.map((q: any) => ({
            symbol: q.symbol,
            shortname: q.shortname,
            longname: q.longname,
            exchange: q.exchange,
            quoteType: q.quoteType,
            typeDisp: q.typeDisp
        }));

        apiCache.set(cacheKey, mapped, 10);
        return mapped;
    } catch (error) {
        console.error('[YahooApi] Library search error, trying fallback:', error);
    }

    // Fallback
    const fallbackResults = await searchDirect(query);
    if (fallbackResults.length > 0) {
        apiCache.set(cacheKey, fallbackResults, 10);
    }
    return fallbackResults;
}

/**
 * Get quote from Yahoo Finance
 */
const CACHE_DURATION_MINUTES = 5;

export async function getYahooQuote(symbol: string): Promise<YahooQuote | null> {
    const cacheKey = `yahoo:quote:${symbol}`;
    // L1: Memory Cache (very short, 20s) to prevent identical simultaneous requests
    const memoryCached = apiCache.get<YahooQuote>(cacheKey);
    if (memoryCached) return memoryCached;

    // L2: Database Cache
    try {
        const dbCached = await prisma.priceCache.findUnique({
            where: { symbol }
        });

        if (dbCached) {
            const age = (Date.now() - dbCached.updatedAt.getTime()) / 1000 / 60;
            if (age < CACHE_DURATION_MINUTES) {
                // console.log(`[YahooApi] Serving from DB: ${symbol} (${age.toFixed(1)}m old)`);
                const quote: YahooQuote = {
                    symbol: dbCached.symbol,
                    regularMarketPrice: dbCached.price,
                    currency: dbCached.currency,
                    regularMarketTime: dbCached.updatedAt
                };
                // Populate L1 cache
                apiCache.set(cacheKey, quote, 0.5); // 0.5 min = 30s
                return quote;
            } else {
                console.log(`[YahooApi] DB Cache Stale: ${symbol} (${age.toFixed(1)}m old)`);
            }
        }
    } catch (e) {
        console.error('[YahooApi] DB Cache Error:', e);
    }

    // Fetch from API
    try {
        const result = await yahooFinance.quote(symbol);
        if (!result || !result.symbol) {
            console.warn(`[YahooApi] No result from Yahoo Finance for ${symbol}`);
            return null;
        }

        // --- CLOSING PRICE LOGIC REMOVED ---
        // We always want the LATEST available price (regularMarketPrice).
        // If the market is open, this is the live price.
        // If the market is closed, this is the closing price.
        // We strictly avoid returning 'Previous Close' as 'Current Price' because it causes
        // stale data to be displayed during active market sessions (especially for Crypto).
        const effectivePrice = result.regularMarketPrice;

        const quote: YahooQuote = {
            symbol: result.symbol,
            regularMarketPrice: effectivePrice, // This is now the "Closing Price" we determined
            currency: result.currency,
            regularMarketTime: result.regularMarketTime,
            marketState: result.marketState,
            regularMarketPreviousClose: (result as any).main_regularMarketPreviousClose || result.regularMarketPreviousClose,
            earningsTimestamp: (result as any).earningsTimestamp || (result as any).earningsTimestampStart
        };

        // Save to DB (async, don't await strictly if not needed, but safer to await)
        await prisma.priceCache.upsert({
            where: { symbol: quote.symbol },
            create: {
                symbol: quote.symbol,
                price: quote.regularMarketPrice || 0,
                currency: quote.currency || 'USD',
            },
            update: {
                price: quote.regularMarketPrice || 0,
                currency: quote.currency || 'USD',
                updatedAt: new Date() // force update timestamp
            }
        }).catch(err => console.error('[YahooApi] DB Upsert Error:', err));

        // Save to Memory
        apiCache.set(cacheKey, quote, 0.5);

        return quote;

    } catch (error) {
        console.error(`[YahooApi] Library quote error for ${symbol}:`, error);
    }

    // Fallback Direct Quote (Chart API)
    try {
        console.log(`[YahooApi] Trying Fallback Direct for ${symbol}`);
        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (response.ok) {
            const data = await response.json();
            const result = data.chart?.result?.[0];
            if (result?.meta) {
                const quote: YahooQuote = {
                    symbol: result.meta.symbol,
                    regularMarketPrice: result.meta.regularMarketPrice,
                    currency: result.meta.currency,
                    regularMarketTime: new Date(result.meta.regularMarketTime * 1000),
                    regularMarketPreviousClose: result.meta.chartPreviousClose
                };

                // Save to DB (Persistent Cache - "Update Asset")
                // This satisfies "update asset when new closing price comes"
                await prisma.priceCache.upsert({
                    where: { symbol: quote.symbol },
                    create: {
                        symbol: quote.symbol,
                        price: quote.regularMarketPrice || 0,
                        currency: quote.currency || 'USD',
                        updatedAt: new Date()
                    },
                    update: {
                        price: quote.regularMarketPrice || 0,
                        currency: quote.currency || 'USD',
                        updatedAt: new Date()
                    }
                }).catch(err => console.error('[YahooApi] DB Upsert (Fallback) Error:', err));

                // Save to Memory
                apiCache.set(cacheKey, quote, 0.5);

                return quote;
            }
        }
    } catch (e) {
        console.error(`[YahooApi] Direct quote error for ${symbol}:`, e);
    }

    return null;
}
