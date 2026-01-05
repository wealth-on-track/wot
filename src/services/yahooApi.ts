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
const CACHE_DURATION_MINUTES = 1440; // 24 Hours Cache (Closing Price Strategy)

// Helper to forcefully detect currency from symbol suffix to prevent "USD" errors on fallbacks/cache
export const detectCurrency = (sym: string): string | null => {
    if (!sym) return null;
    const s = sym.toUpperCase();
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

    // Default to USD for major US exchanges or no suffix
    if (!s.includes('.')) return 'USD';

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
        if (!forceRefresh) {
            const dbCache = await prisma.priceCache.findUnique({ where: { symbol } });

            if (dbCache) {
                const quote: YahooQuote = {
                    symbol: dbCache.symbol,
                    regularMarketPrice: dbCache.price,
                    currency: forcedCurrency || dbCache.currency, // Force correct currency
                    regularMarketTime: dbCache.updatedAt,
                    regularMarketPreviousClose: dbCache.price,
                    marketState: dbCache.marketState || undefined
                };
                apiCache.set(cacheKey, quote, 0.5); // Refill memory cache
                return quote;
            }
        }

        // 3. Fetch from API (Yahoo Finance - Primary)
        if (forceRefresh) {
            console.log(`[YahooApi] Force Refresh: Trying Direct Fallback first for ${symbol}`);
            const direct = await getDirectQuoteFallback(symbol);
            if (direct) return direct;
        }

        console.log(`[YahooApi] Fetching fresh quote for ${symbol}...`);
        // Random jitter
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
        const result = await yahooFinance.quote(symbol);
        if (!result || !result.symbol) {
            console.warn(`[YahooApi] No result from Yahoo Finance for ${symbol}`);
            // If no result, proceed to fallbacks
            throw new Error(`No result from Yahoo Finance for ${symbol}`);
        }

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
                price: quote.regularMarketPrice || 0,
                currency: quote.currency || 'USD',
                marketState: quote.marketState,
                updatedAt: new Date()
            },
            update: {
                price: quote.regularMarketPrice || 0,
                currency: quote.currency || 'USD',
                marketState: quote.marketState,
                updatedAt: new Date() // Force update timestamp
            }
        }).catch(err => console.error('[YahooApi] DB Upsert Error:', err));

        // Crypto 7/24 Logic
        if (isCrypto(quote.symbol)) {
            quote.marketState = 'REGULAR';
        }

        // Save to Memory
        apiCache.set(cacheKey, quote, 0.5);

        return quote;

    } catch (error: any) {
        console.warn(`[YahooApi] Primary quote failed for ${symbol}:`, error?.message || error);

        // Use the detectCurrency defined at the top of the function
        const forcedCurrencyFallback = detectCurrency(symbol);


        // FALLBACK 1: Alpha Vantage Quote
        try {
            console.log(`[YahooApi] Trying Alpha Vantage Quote fallback for ${symbol}...`);
            const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`, { cache: 'no-store' });
            const data = await response.json();
            const globalQuote = data['Global Quote'];

            if (globalQuote && globalQuote['05. price']) {
                const quote: YahooQuote = {
                    symbol: symbol,
                    regularMarketPrice: parseFloat(globalQuote['05. price']),
                    currency: forcedCurrencyFallback || 'USD', // Crucial Fix
                    regularMarketPrice: parseFloat(globalQuote['05. price']),
                    currency: forcedCurrencyFallback || 'USD', // Crucial Fix
                    regularMarketTime: new Date(),
                    regularMarketPreviousClose: parseFloat(globalQuote['08. previous close']),
                    marketState: getEstimatedUSMarketState()
                };

                // Save to DB
                await prisma.priceCache.upsert({
                    where: { symbol: quote.symbol },
                    create: { symbol: quote.symbol, price: quote.regularMarketPrice || 0, currency: quote.currency, updatedAt: new Date() },
                    update: { price: quote.regularMarketPrice || 0, currency: quote.currency, updatedAt: new Date() }
                }).catch(err => console.error('[YahooApi] DB Upsert (Alpha) Error:', err));

                return quote;
            }
        } catch (e) {
            console.warn(`[YahooApi] Alpha Vantage fallback failed:`, e);
        }

        // FALLBACK 2: Finnhub Quote
        try {
            console.log(`[YahooApi] Trying Finnhub Quote fallback for ${symbol}...`);
            const { getQuote } = await import('./finnhubApi');
            const finnhubQuote = await getQuote(symbol);

            if (finnhubQuote && finnhubQuote.c > 0) {
                const quote: YahooQuote = {
                    symbol: symbol,
                    regularMarketPrice: finnhubQuote.c,
                    currency: forcedCurrencyFallback || 'USD', // Crucial Fix
                    currency: forcedCurrencyFallback || 'USD', // Crucial Fix
                    regularMarketTime: new Date(finnhubQuote.t * 1000),
                    regularMarketPreviousClose: finnhubQuote.pc,
                    marketState: getEstimatedUSMarketState()
                };

                await prisma.priceCache.upsert({
                    where: { symbol: quote.symbol },
                    create: { symbol: quote.symbol, price: quote.regularMarketPrice || 0, currency: quote.currency, updatedAt: new Date() },
                    update: { price: quote.regularMarketPrice || 0, currency: quote.currency, updatedAt: new Date() }
                }).catch(err => console.error('[YahooApi] DB Upsert (Finnhub) Error:', err));

                return quote;
            }
        } catch (e) {
            console.warn(`[YahooApi] Finnhub fallback failed:`, e);
        }

        console.error(`[YahooApi] Primary and secondary quote sources failed for ${symbol}. Trying Direct Fallback.`);

        // FINAL FALLBACK: Direct Chart API (Doesn't need crumb, usually bypasses 429)
        const directQuote = await getDirectQuoteFallback(symbol);
        if (directQuote) return directQuote;

        // Last Resort: Return any stale data if we have it
        const dbCachedFallback = await prisma.priceCache.findUnique({ where: { symbol } });
        if (dbCachedFallback) {
            console.warn(`[YahooApi] Rate Limit/Errors for ${symbol}. Returning stale DB data.`);
            return {
                symbol: dbCachedFallback.symbol,
                regularMarketPrice: dbCachedFallback.price,
                currency: forcedCurrencyFallback || dbCachedFallback.currency,
                regularMarketTime: dbCachedFallback.updatedAt
            };
        }
    }

    return null;
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
                        price: quote.regularMarketPrice || 0,
                        currency: quote.currency || 'USD',
                        marketState: quote.marketState,
                        updatedAt: new Date()
                    },
                    update: {
                        price: quote.regularMarketPrice || 0,
                        currency: quote.currency || 'USD',
                        marketState: quote.marketState,
                        updatedAt: new Date()
                    }
                });

                return quote;
            }
            else {
                console.warn(`[YahooApi] Direct Fallback: No meta in result for ${symbol}`);
            }
        } else {
            console.error(`[YahooApi] Direct Fallback Failed for ${symbol}: Status ${response.status}`);
        }
    } catch (e) {
        console.error(`[YahooApi] Direct Chart fallback failed for ${symbol}:`, e);
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
    } catch (e) {
        // Silently fail - sector is optional
    }

    // Cache null result for 1 hour to avoid repeated failed requests
    apiCache.set(cacheKey, null, 60);
    return null;
}
