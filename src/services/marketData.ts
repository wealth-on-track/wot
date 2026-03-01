/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { getYahooQuote, searchYahoo } from './yahooApi';
import { getTefasFundInfo } from './tefasApi';
import { cleanAssetName } from '@/lib/companyNames';
import { calculateMarketStatus } from '@/lib/market-timing';
import { ensureAssetHistory, getAssetPerformance } from './historyService';
import { prisma } from '@/lib/prisma';

export interface MarketData {

    symbol: string;
    price: number;
    currency: string;
    change24h?: number;
}

export interface PriceResult {
    price: number;
    timestamp: string;
    currency?: string;
    change24h?: number;
    changePercent?: number;
    changePercent1W?: number;
    changePercent1M?: number;
    changePercentYTD?: number;
    changePercent1Y?: number;
    previousClose?: number;
    country?: string;
    sector?: string;
    industry?: string;
}

// Shared logic to translate raw symbols to searchable tickers (e.g., ASML -> ASML.AS)
export function getSearchSymbol(symbol: string, type: string, exchange?: string | null): string {
    const s = symbol.toUpperCase();
    const t = type.toUpperCase();
    const e = exchange?.toUpperCase();

    // 0. Explicit Exchange Overrides
    if (e === 'BIST' && !s.endsWith('.IS')) return `${s}.IS`;
    if (e === 'AMSTERDAM' && !s.endsWith('.AS')) return `${s}.AS`;
    if (e === 'PARIS' && !s.endsWith('.PA')) return `${s}.PA`;

    // 1. Known BIST Stocks (Fallback if exchange not set)
    const bistStocks = [
        'TAVHL', 'THYAO', 'GARAN', 'AKBNK', 'EREGL', 'KCHOL', 'SAHOL', 'SISE', 'BIMAS', 'ASELS',
        'RYGYO', 'FROTO', 'TUPRS', 'PETKM', 'YKBNK', 'ISCTR', 'VAKBN', 'HALKB', 'EKGYO', 'TTKOM',
        'TCELL', 'ENKAI', 'VESTL', 'ARCLK', 'TOASO', 'MGROS', 'PGSUS', 'SOKM', 'AEFES', 'DOHOL'
    ];
    if (t === 'STOCK' && bistStocks.includes(s)) return `${s}.IS`;

    // 2. Specific Global Mappings
    if (s === 'ASML') return 'ASML.AS'; // Primary Euronext listing
    if (s === 'RABO') return 'RABO.AS';

    // 3. Commodities
    if (s === 'XAU') return 'GC=F';
    if (s === 'XPT' || s === 'XPT-USD') return 'PL=F'; // Platinum Futures
    // REMOVED dangerous GAUTRY -> GC=F mapping.
    // GAUTRY is calculated synthetically via derivedQuote.
    // Mapping it here causes fallback to USD Futures price (treated as TRY) if synthetic calc fails.
    // if (s === 'GAUTRY') return 'GC=F';
    // if (s === 'XAGTRY') return 'SI=F';

    // 4. Normalize Platinum TRY variants to canonical XPTTRY
    // Supported: XPTTRY, XPTgTRY, XPT-TRY, XPTGTRY, PLTTRY
    const platinumTryVariants = ['XPTTRY', 'XPTGTRY', 'XPT-TRY', 'XPTG-TRY', 'PLTTRY'];
    if (platinumTryVariants.includes(s) || s === 'XPT TRY' || s === 'XPTG TRY') return 'XPTTRY';

    // 5. Default
    return s;
}

export async function getAssetName(symbol: string, type: string, exchange?: string): Promise<string | null> {
    // CASH is simple
    if (type === 'CASH') return null;

    try {
        if (exchange === 'TEFAS' || (type === 'FUND' && symbol.length === 3 && !symbol.includes('.'))) {
            const tefasData = await getTefasFundInfo(symbol);
            if (tefasData) return tefasData.title;
        }

        const searchSymbol = getSearchSymbol(symbol, type);

        // Handle Crypto Pairs (e.g. BTC-EUR -> search "BTC-EUR" or just "BTC")
        // If symbol has hyphen, let's try searching it directly first.

        if (symbol === 'GAUTRY') return "GR Altın";
        if (symbol === 'XAGTRY') return "GR Gümüş";
        if (symbol === 'XPTTRY' || symbol === 'XPTgTRY' || symbol === 'XPT-TRY' || symbol === 'XPTGTRY' || symbol === 'PLTTRY') return "GR Platin";

        const results = await searchYahoo(searchSymbol);

        if (results && results.length > 0) {
            // Find best match. Usually first is best.
            // Prefer shortname or longname
            const match = results[0];
            const rawName = match.shortname || match.longname;
            return rawName ? cleanAssetName(rawName) : null;
        }

        // Fallback for crypto components if pair not found?
        // e.g. BTC-EUR not found -> try BTC?
        if (type === 'CRYPTO' && symbol.includes('-')) {
            const base = symbol.split('-')[0];
            const baseResults = await searchYahoo(base);
            if (baseResults && baseResults.length > 0) {
                const rawName = baseResults[0].shortname || baseResults[0].longname;
                return rawName ? cleanAssetName(rawName) : null;
            }
        }

    } catch (e) {
        console.warn('Warning fetching asset name:', e);
    }
    return null;
}

// Old estimateMarketState removed. Use calculateMarketStatus from '@/lib/market-timing'

// Helper: Determine if a price is stale based on "Half-Past Hour" (XX:30) strategy
// Rule: Refresh if we have crossed a XX:30 boundary since the last update.
// RULE 2: Quiet Hours (00:00 - 08:00 CET). Do not update during night.
export function isPriceStale(lastUpdate: Date): boolean {
    // Fast initial load: In development, never consider prices stale on server-side
    // Client will refresh in background after page loads
    if (process.env.FAST_INITIAL_LOAD === 'true') return false;

    const now = new Date();
    const currentHour = now.getHours();

    // Quiet Hours Check
    if (currentHour >= 0 && currentHour < 8) return false;

    // Construct the candidate threshold for the CURRENT hour (XX:30:00)

    // Construct the candidate threshold for the CURRENT hour (XX:30:00)
    const currentThreshold = new Date(now);
    currentThreshold.setMinutes(30, 0, 0);

    // If we are currently BEFORE XX:30 (e.g. 10:15), the effective threshold is PREVIOUS hour's XX:30 (09:30).
    // If we are currently AFTER XX:30 (e.g. 10:45), the effective threshold is CURRENT hour's XX:30 (10:30).
    const effectiveThreshold = (now.getTime() < currentThreshold.getTime())
        ? new Date(currentThreshold.getTime() - (60 * 60 * 1000)) // Minus 1 hour
        : currentThreshold;

    // If last update was BEFORE this threshold, it's stale.
    return lastUpdate.getTime() < effectiveThreshold.getTime();
}

export async function getMarketPrice(symbol: string, type: string, exchange?: string, forceRefresh: boolean = false, userId: string = 'System', category?: string): Promise<PriceResult | undefined> {
    // Development mode: Skip external API calls for faster page loads
    const skipPriceFetch = process.env.SKIP_PRICE_FETCH === 'true';
    if (skipPriceFetch && !forceRefresh) {
        // Return cached data only, don't fetch from external APIs
        const cached = await prisma.priceCache.findUnique({ where: { symbol } });
        if (cached && cached.previousClose > 0) {
            return {
                price: cached.previousClose,
                currency: cached.currency,
                timestamp: (cached.tradeTime || cached.updatedAt).toLocaleString('tr-TR'),
                previousClose: cached.actualPreviousClose || cached.previousClose,
                change24h: 0,
                changePercent: 0,
                sector: cached.sector || 'N/A',
                country: cached.country || 'N/A'
            };
        }
        // If no cache, return undefined (will use buyPrice as fallback)
        return undefined;
    }

    // Ticker Normalization (Force correct symbols for known issues)
    if (symbol.toUpperCase() === 'SOIT.PA') symbol = 'SOI.PA';

    // FORCE REFRESH for Soitec if we suspect bad cache (Price 0)
    if (symbol === 'SOI.PA' && !forceRefresh) {
        const checkCache = await prisma.priceCache.findUnique({ where: { symbol: 'SOI.PA' } });
        if (checkCache && checkCache.previousClose === 0) {
            console.log(`[MarketData] Forcing refresh for Soitec (SOI.PA) due to zero price in cache.`);
            forceRefresh = true;
        }
    }

    // 0. GLOBAL CACHE CHECK (Closing Price Strategy)
    // If we have data in DB, use it unless forced.
    if (!forceRefresh) {
        try {
            const cached = await prisma.priceCache.findUnique({ where: { symbol } });
            if (cached) {
                // NEGATIVE CACHING (Stop spamming API for known bad symbols)
                // If we marked it as ERROR recently, return undefined immediately.
                if (cached.source === 'ERROR') {
                    const now = new Date().getTime();
                    const updated = new Date(cached.updatedAt).getTime();
                    // Cache errors for 24 hours to stop the flood
                    if ((now - updated) < (24 * 60 * 60 * 1000)) {
                        console.log(`[MarketData] Skipping ${symbol} (Cached ERROR)`);
                        return {
                            price: 0,
                            previousClose: 0,
                            currency: cached.currency || 'USD',
                            timestamp: cached.updatedAt.toLocaleString('tr-TR'),
                            sector: 'N/A',
                            country: 'N/A'
                        };
                    }
                }

                // Apply country fallback if missing
                let countryValue = cached.country;
                if (!countryValue || countryValue.trim() === '') {
                    // 1. Check if TEFAS/FON (currency TRY + type)
                    if ((type === 'TEFAS' || type === 'FON' || cached.source === 'TEFAS') && cached.currency === 'TRY') {
                        // console.log(`[MarketData] Derived country "Turkey" from TEFAS source for cached ${symbol}`);
                        countryValue = 'Turkey';
                        await prisma.priceCache.update({
                            where: { symbol },
                            data: { country: 'Turkey' }
                        });
                    } else {
                        // 2. Try exchange-based fallback
                        const { getCountryFromExchange } = await import('@/lib/exchangeToCountry');
                        const derivedCountry = getCountryFromExchange(exchange, symbol);
                        if (derivedCountry) {
                            // console.log(`[MarketData] Derived country "${derivedCountry}" from exchange for cached ${symbol}`);
                            countryValue = derivedCountry;
                            await prisma.priceCache.update({
                                where: { symbol },
                                data: { country: derivedCountry }
                            });
                        }
                    }
                }

                // STRICT CURRENCY ENFORCEMENT (Suffix Rule)
                let finalCurrency = cached.currency;
                if (symbol.endsWith('-EUR')) finalCurrency = 'EUR';
                if (symbol.endsWith('-USD')) finalCurrency = 'USD';
                if (symbol.endsWith('-TRY')) finalCurrency = 'TRY';
                // Platinum TRY variants: XPTTRY, XPTgTRY, XPT-TRY, XPTGTRY, PLTTRY
                const platinumTryCheck = ['XPTTRY', 'XPTGTRY', 'XPT-TRY', 'XPTG-TRY', 'PLTTRY'].includes(symbol.toUpperCase());
                if (symbol === 'GAUTRY' || symbol === 'XAGTRY' || symbol === 'AET' || platinumTryCheck) finalCurrency = 'TRY';

                // 3. Invalid Cache Check (Price 0)
                // If price is 0 (and not CASH), assume data is broken/delisted/error and try fresh fetch
                // UNLESS it's already marked as ERROR (handled above)
                if (cached.previousClose === 0 && type !== 'CASH' && cached.source !== 'ERROR') {
                    console.warn(`[MarketData] Cached price for ${symbol} is 0. Forcing refresh.`);
                    // Fall through to fetch logic
                } else {
                    // Check freshness using "Half-Past Hour" strategy
                    if (!isPriceStale(cached.updatedAt)) {
                        // Calculate 1D change using actualPreviousClose if available
                        const currentPrice = cached.previousClose; // Legacy: previousClose stores current price
                        const truePreviousClose = cached.actualPreviousClose || cached.previousClose;
                        const change24h = currentPrice - truePreviousClose;
                        const changePercent = truePreviousClose > 0 ? (change24h / truePreviousClose) * 100 : 0;

                        // Debug log for 1D calculation from cache
                        if (symbol === 'SOI.PA') {
                            console.log(`[MarketData] SOI.PA cache read: currentPrice=${currentPrice}, actualPrevClose=${cached.actualPreviousClose}, truePrevClose=${truePreviousClose}, changePercent=${changePercent.toFixed(2)}%`);
                        }

                        return {
                            price: currentPrice,
                            currency: finalCurrency,
                            timestamp: (cached.tradeTime || cached.updatedAt).toLocaleString('tr-TR'),
                            previousClose: truePreviousClose, // Return TRUE previous close
                            change24h: change24h,
                            changePercent: changePercent,
                            sector: cached.sector || 'N/A',
                            country: countryValue || 'N/A'
                        };
                    }
                    // If stale, fall through to API fetch
                }
            }
        } catch (e) {
            console.warn('[MarketData] Cache check failed:', e);
        }
    }

    // CASH and BES (pension) assets always have a price of 1.0 (relative to themselves)
    // The valuation logic converts this 1.0 * quantity (which is the amount) to the target currency.
    // BES = Bireysel Emeklilik Sistemi (Turkish Individual Pension System)
    // BES contract value is calculated from transaction history, not market price
    if (type === 'CASH' || type === 'BES') {
        return {
            price: 1.0,
            currency: type === 'BES' ? 'TRY' : undefined,
            timestamp: new Date().toLocaleString('tr-TR')
        };
    }

    // 4. Determine Source (Yahoo vs TEFAS vs CoinGecko vs etc)
    // STRICT TEFAS GUARD: If type=FUND and exchange=TEFAS, block Yahoo completely
    const isStrictTefas = (type === 'FUND' || type === 'TEFAS' || type === 'FON') && exchange?.toUpperCase() === 'TEFAS';

    if (isStrictTefas) {
        console.log(`[MarketData] Strict TEFAS mode for ${symbol}: Blocking Yahoo, forcing TRY/Turkey`);
        const tefasData = await getTefasFundInfo(symbol);
        if (tefasData) {
            // SAVE TO CACHE (TEFAS funds are always Turkey-based)
            await prisma.priceCache.upsert({
                where: { symbol },
                create: {
                    symbol,
                    previousClose: tefasData.price,
                    currency: 'TRY',
                    country: 'Turkey',
                    updatedAt: new Date(),
                    tradeTime: new Date(tefasData.lastUpdated || new Date()),
                    source: 'TEFAS',
                    lastRequestedBy: userId
                },
                update: {
                    previousClose: tefasData.price,
                    currency: 'TRY',
                    country: 'Turkey',
                    updatedAt: new Date(),
                    tradeTime: new Date(tefasData.lastUpdated || new Date()),
                    source: 'TEFAS',
                    lastRequestedBy: userId
                }
            });

            return {
                price: tefasData.price,
                timestamp: tefasData.lastUpdated || new Date().toLocaleString('tr-TR'),
                currency: 'TRY',
                country: 'Turkey',
                sector: 'N/A'
            };
        }

        // TEFAS lookup failed - block Yahoo fallback
        console.warn(`[MarketData] TEFAS Guard: ${symbol} is marked as TEFAS FUND but lookup failed. Blocking Yahoo.`);
        try {
            await prisma.priceCache.upsert({
                where: { symbol },
                create: {
                    symbol,
                    previousClose: 0,
                    currency: 'TRY',
                    country: 'Turkey',
                    tradeTime: new Date(),
                    updatedAt: new Date(),
                    source: 'ERROR'
                },
                update: {
                    previousClose: 0,
                    currency: 'TRY',
                    country: 'Turkey',
                    tradeTime: new Date(),
                    updatedAt: new Date(),
                    source: 'ERROR'
                }
            });
        } catch (e) {
            console.error('[MarketData] Guard cache write failed', e);
        }
        return undefined;
    }

    // LEGACY LOGIC: Try TEFAS for 3-letter symbols (with Yahoo fallback)
    const isExplicitTefas = type === 'TEFAS' || type === 'FON';
    // Fix: Only treat as implicit TEFAS if exchange is empty, UNKNOWN, or explicitly TEFAS.
    // This prevents blocking VOO (NYSE), SPY (Arca) etc.
    const isTefasFundSignature = type === 'FUND' && symbol.length === 3 && !symbol.includes('.') && (!exchange || exchange === 'TEFAS' || exchange === 'UNKNOWN');
    // If category is definitive US/EU/CRYPTO/etc, DO NOT assume TEFAS even for 3-letter stocks (like NKE, TAV, etc)
    const isCategoryNonTefas = category && (category === 'US_MARKETS' || category === 'EU_MARKETS' || category === 'CRYPTO' || category === 'COMMODITIES' || category === 'FX' || category === 'BIST' || category === 'BENCHMARK');

    // Only check implicit if NO definitive category is provided OR the category is strictly TEFAS
    const isImplicitTefasCandidate = !isCategoryNonTefas && (type === 'STOCK' || type === 'ETF') && symbol.length === 3 && !symbol.includes('.');

    // Union of all TEFAS candidates (but not strict)
    if (isExplicitTefas || isTefasFundSignature || isImplicitTefasCandidate) {
        const tefasData = await getTefasFundInfo(symbol);
        if (tefasData) {
            // SAVE TO CACHE (TEFAS funds are always Turkey-based)
            await prisma.priceCache.upsert({
                where: { symbol },
                create: {
                    symbol,
                    previousClose: tefasData.price,
                    currency: 'TRY',
                    country: 'Turkey',
                    updatedAt: new Date(),
                    tradeTime: new Date(tefasData.lastUpdated || new Date()),
                    source: 'TEFAS',
                    lastRequestedBy: userId
                },
                update: {
                    previousClose: tefasData.price,
                    currency: 'TRY',
                    country: 'Turkey',
                    updatedAt: new Date(),
                    tradeTime: new Date(tefasData.lastUpdated || new Date()),
                    source: 'TEFAS',
                    lastRequestedBy: userId
                }
            });

            return {
                price: tefasData.price,
                timestamp: tefasData.lastUpdated || new Date().toLocaleString('tr-TR'),
                currency: 'TRY',
                country: 'Turkey',
                sector: 'N/A'
            };
        }

        // FAIL-SAFE LOGIC:

        // 1. Explicit TEFAS or explicit FUND signature:
        // If these fail TEFAS lookup, we BLOCK Yahoo fallback because it will likely return a US Stock USD price.
        if (isExplicitTefas || isTefasFundSignature) {
            console.warn(`[MarketData] Strict Guard: ${symbol} is a TEFAS fund but lookup failed. Blocking Yahoo fallback.`);

            try {
                await prisma.priceCache.upsert({
                    where: { symbol },
                    create: {
                        symbol,
                        previousClose: 0,
                        currency: 'TRY',
                        tradeTime: new Date(),
                        updatedAt: new Date(),
                        source: 'ERROR'
                    },
                    update: {
                        previousClose: 0,
                        currency: 'TRY',
                        tradeTime: new Date(),
                        updatedAt: new Date(),
                        source: 'ERROR'
                    }
                });
            } catch (e) {
                console.error('[MarketData] Guard cache write failed', e);
            }

            return undefined;
        }

        // 2. Implicit Candidate (STOCK/ETF):
        // If "TI2" (identifying as STOCK) fails TEFAS, we might want to block it too if the user insists "TEFAS must be TRY".
        // But if it's "IBM" (STOCK), we MUST allow fallback.
        // There is no perfect heuristic without a whitelist.
        // However, given the user's specific context "TI2 showing as USD", it likely fell through here.
        // If getTefasFundInfo returned null, it means TI2 was NOT found in TEFAS service at that moment.
    }

    // Try Yahoo Finance API
    try {
        const searchSymbol = getSearchSymbol(symbol, type);
        // Calculate robust status based on time (structural solution)
        const computedState = calculateMarketStatus(symbol, exchange, type);

        let derivedQuote: any = null;
        // Normalize XPTTRY variants
        const normalizedSymbol = getSearchSymbol(symbol, type);
        const isXptTry = normalizedSymbol === 'XPTTRY';

        // PLATINUM TRY: Try Investing.com SPOT first, fallback to Yahoo FUTURES
        if (isXptTry) {
            try {
                const { getPlatinumSpotTRY } = await import('./investingApi');
                console.log(`[MarketData] Trying Investing.com SPOT for ${symbol}...`);
                const investingQuote = await getPlatinumSpotTRY();

                if (investingQuote && investingQuote.price > 0) {
                    console.log(`[MarketData] Investing.com SPOT success: ${investingQuote.price} TRY/gram`);
                    // Investing.com returns GRAM price directly - store as-is, skip gram conversion
                    derivedQuote = {
                        symbol: 'XPTTRY',
                        regularMarketPrice: investingQuote.price,
                        currency: 'TRY',
                        regularMarketTime: investingQuote.timestamp,
                        regularMarketPreviousClose: investingQuote.price,
                        source: 'INVESTING_SPOT',
                        _isGramPrice: true
                    };
                }
            } catch (err) {
                console.warn(`[MarketData] Investing.com failed for ${symbol}, falling back to Yahoo Futures`, err);
            }
        }

        // GOLD, SILVER, or PLATINUM (fallback): Use Yahoo Futures + USDTRY
        if (!derivedQuote && (symbol === 'GAUTRY' || symbol === 'XAGTRY' || isXptTry)) {
            try {
                // Gold = GC=F, Silver = SI=F, Platinum = PL=F
                const futuresSymbol = symbol === 'GAUTRY' ? 'GC=F' : (symbol === 'XAGTRY' ? 'SI=F' : 'PL=F');
                console.log(`[MarketData] Using Yahoo FUTURES (${futuresSymbol}) for ${symbol}...`);
                const [commodity, usdtry] = await Promise.all([
                    getYahooQuote(futuresSymbol),
                    getYahooQuote('USDTRY=X')
                ]);
                const commodityPrice = commodity?.regularMarketPrice;
                const parity = usdtry?.regularMarketPrice;
                if (commodityPrice && parity) {
                    derivedQuote = {
                        symbol: isXptTry ? 'XPTTRY' : symbol,
                        regularMarketPrice: (commodityPrice * parity) / 1, // Store Ounce * Parity, applyAdjustments will do / 31.103
                        currency: 'TRY',
                        regularMarketTime: commodity?.regularMarketTime || new Date(),
                        regularMarketPreviousClose: (commodity?.regularMarketPreviousClose || commodityPrice) * (usdtry?.regularMarketPreviousClose || parity),
                        source: 'YAHOO_FUTURES'
                    };
                    // Note: applyAdjustments will handle / 31.103 at the common point below
                }
            } catch (err) {
                console.warn(`[MarketData] Failed to calculate derived ${symbol} price`, err);
            }
        }

        let quote = derivedQuote || await getYahooQuote(searchSymbol, forceRefresh);

        // FALLBACK: If Yahoo fails (rate limit/block), try Finnhub for real-time price
        // UPDATE: Include FUND type in fallback
        if ((!quote || !quote.regularMarketPrice) && !derivedQuote && (type === 'STOCK' || type === 'ETF' || type === 'FUND')) {
            try {
                const { getQuote: getFinnhubQuote } = await import('./finnhubApi');
                console.log(`[MarketData] Yahoo failed for ${symbol}, trying Finnhub fallback...`);

                // Finnhub often works better with clean symbol for US stocks
                // If symbol is VOO, searchSymbol is VOO.
                const fQuote = await getFinnhubQuote(searchSymbol);

                if (fQuote && fQuote.c > 0) {
                    quote = {
                        symbol: searchSymbol,
                        regularMarketPrice: fQuote.c,
                        regularMarketPreviousClose: fQuote.pc,
                        currency: 'USD', // Default, will be refined by profile if possible
                        marketState: 'REGULAR',
                        regularMarketTime: fQuote.t ? new Date(fQuote.t * 1000) : new Date(),
                        ...quote // Keep any partial data
                    } as any;
                    console.log(`[MarketData] Finnhub Fallback Success: ${fQuote.c}`);
                }
            } catch (fallbackErr) {
                console.warn('[MarketData] Finnhub fallback failed:', fallbackErr);
            }
        }

        // ISIN SELF-HEALING FALLBACK
        // If price is still missing or zero, try to resolve via ISIN stored in DB
        if ((!quote || !quote.regularMarketPrice) && !derivedQuote) {
            try {
                // Find ANY asset with this symbol that has an ISIN
                const dbAsset = await prisma.asset.findFirst({
                    where: {
                        symbol: symbol,
                        isin: { not: null }
                    },
                    select: { isin: true }
                });

                if (dbAsset && dbAsset.isin) {
                    console.log(`[MarketData] Price missing for ${symbol}. Attempting recovery via ISIN: ${dbAsset.isin}`);
                    const searchResults = await searchYahoo(dbAsset.isin);

                    if (searchResults.length > 0) {
                        const bestMatch = searchResults[0];
                        const newSymbol = bestMatch.symbol;

                        // Use the new symbol if it's different and looks valid
                        if (newSymbol && newSymbol !== symbol) {
                            console.log(`[MarketData] 🛠️ SELF-HEALING: Updating obsolete ticker ${symbol} -> ${newSymbol}`);

                            // 1. Heal the data in DB (Update all instances with this bad symbol + ISIN)
                            await prisma.asset.updateMany({
                                where: { symbol: symbol, isin: dbAsset.isin },
                                data: {
                                    symbol: newSymbol,
                                    originalName: bestMatch.shortname || bestMatch.longname // Update name too for clarity
                                }
                            });

                            // 2. Recursively fetch with the NEW symbol
                            return getMarketPrice(newSymbol, type, exchange, true, userId, category);
                        }
                    }
                }
            } catch (healingErr) {
                console.warn('[MarketData] Self-healing failed:', healingErr);
            }
        }

        if (quote && quote.regularMarketPrice) {
            // Apply special adjustments (Units, Splits fallback)
            const applyAdjustments = (p: number) => {
                let adjusted = p;
                if (symbol === 'GAUTRY') adjusted = adjusted / 31.1034768;
                if (symbol === 'XAGTRY') adjusted = adjusted / 31.1034768;
                // Platinum: Only convert to gram if NOT already gram price (Investing.com returns gram directly)
                if (isXptTry && !quote._isGramPrice) adjusted = adjusted / 31.1034768;
                if (symbol === 'RABO') adjusted = adjusted / 100.0;
                return adjusted;
            };

            const price = applyAdjustments(quote.regularMarketPrice);
            let previousClose = quote.regularMarketPreviousClose ? applyAdjustments(quote.regularMarketPreviousClose) : undefined;

            // Calculate change if previous close is available
            let change24h = 0;
            if (previousClose) {
                change24h = price - previousClose;
            }

            // Multi-Tier Profile Fetching System (%100 Coverage)
            let profileData: { country?: string; sector?: string; industry?: string } | null = null;

            // OPTIMIZATION: Check DB first to avoid expensive API calls.
            // Rule: If we have ANY metadata (even 'Unknown' or 'N/A'), we consider it "fetched" and do not retry.
            // This strictly follows "Only fetch when new/missing".
            const existingMetadata = await prisma.priceCache.findUnique({
                where: { symbol },
                select: { sector: true, country: true }
            });

            // If sector is not null, we assume we have touched this asset's metadata before.
            const hasMetadataHistory = existingMetadata && existingMetadata.sector !== null;

            if (hasMetadataHistory) {
                // Use existing metadata from DB (Persistence)
                profileData = {
                    sector: existingMetadata!.sector!,
                    country: existingMetadata!.country!
                };
                // console.log(`[MarketData] Using cached metadata for ${symbol}`);
            }
            else if (type === 'STOCK' || type === 'ETF' || type === 'FUND') {
                // METADATA FETCHING (Only runs if we have NO previous record of metadata)

                // TIER 1: Yahoo Finance
                try {
                    const { getYahooAssetProfile } = await import('./yahooApi');
                    profileData = await getYahooAssetProfile(searchSymbol);
                    if (profileData?.sector || profileData?.country) {
                        console.log(`[MarketData] Profile from Yahoo Finance: ${searchSymbol}`);
                    }
                } catch (e) {
                    console.warn('[MarketData] Yahoo profile failed:', e);
                }

                // TIER 2: Alpha Vantage
                if (!profileData || (!profileData.sector && !profileData.country)) {
                    try {
                        const { getCompanyOverview } = await import('./alphaVantageApi');
                        const alphaData = await getCompanyOverview(searchSymbol);
                        if (alphaData) {
                            profileData = {
                                country: profileData?.country || alphaData.country,
                                sector: profileData?.sector || alphaData.sector,
                                industry: profileData?.industry || alphaData.industry
                            };
                            console.log(`[MarketData] Profile from Alpha Vantage: ${searchSymbol}`);
                        }
                    } catch (e) {
                        console.warn('[MarketData] Alpha Vantage profile failed:', e);
                    }
                }

                // TIER 3: Finnhub
                if (!profileData || (!profileData.sector && !profileData.country)) {
                    try {
                        const { getCompanyProfile } = await import('./finnhubApi');
                        const finnhubData = await getCompanyProfile(searchSymbol);
                        if (finnhubData) {
                            profileData = {
                                country: profileData?.country || finnhubData.country,
                                sector: profileData?.sector || (finnhubData.sector || finnhubData.finnhubIndustry),
                                industry: profileData?.industry || finnhubData.industry
                            };
                            console.log(`[MarketData] Profile from Finnhub: ${searchSymbol}`);
                        }
                    } catch (e) {
                        console.warn('[MarketData] Finnhub profile failed:', e);
                    }
                }

                // TIER 4: Manual Mapping
                if (!profileData || (!profileData.sector && !profileData.country)) {
                    try {
                        const { getManualMapping } = await import('@/lib/symbolMapping');
                        const manualData = getManualMapping(symbol, searchSymbol);
                        if (manualData) {
                            profileData = {
                                country: profileData?.country || manualData.country,
                                sector: profileData?.sector || manualData.sector,
                                industry: profileData?.industry || manualData.industry
                            };
                            console.log(`[MarketData] Profile from Manual Mapping: ${searchSymbol}`);
                        }
                    } catch (e) {
                        console.warn('[MarketData] Manual mapping failed:', e);
                    }
                }

                // FINAL FALLBACK: If we still have no data, set to 'Unknown' to prevent future retries.
                // This marks the asset as "Processed" in the DB.
                if (!profileData) profileData = {};
                if (!profileData.sector) profileData.sector = 'Unknown';
                if (!profileData.country) profileData.country = 'Unknown';
            }

            // FALLBACK: Derive country from exchange if all API calls failed (and we are in the fetch block)
            if ((!profileData?.country || profileData.country === 'Unknown') && !hasMetadataHistory) {
                const { getCountryFromExchange } = await import('@/lib/exchangeToCountry');
                const exchange = (quote as any)?.exchange || (quote as any)?.fullExchangeName || "";
                const derivedCountry = getCountryFromExchange(exchange, searchSymbol);
                if (derivedCountry) {
                    console.log(`[MarketData] Derived country "${derivedCountry}" from exchange for ${searchSymbol}`);
                    profileData = profileData || {};
                    profileData.country = derivedCountry;
                }
            }

            let finalState = quote.marketState;
            if (!finalState || (finalState === 'CLOSED' && computedState === 'REGULAR')) {
                finalState = computedState;
            }

            let finalCurrency = quote.currency || 'USD';
            // STRICT CURRENCY ENFORCEMENT (Suffix Rule)
            if (symbol.endsWith('-EUR')) finalCurrency = 'EUR';
            if (symbol.endsWith('-USD')) finalCurrency = 'USD';
            if (symbol.endsWith('-TRY')) finalCurrency = 'TRY';
            if (symbol === 'GAUTRY' || symbol === 'XAGTRY' || symbol === 'AET' || isXptTry) finalCurrency = 'TRY';

            // Determine source for cache
            const cacheSource = derivedQuote?.source || (derivedQuote ? 'YAHOO_SYNTHETIC' : 'YAHOO');

            // SAVE TO CACHE
            // IMPORTANT: Store BOTH current price AND actual previousClose (for 1D change)
            // - previousClose: stores CURRENT price (legacy naming, used for portfolio value)
            // - actualPreviousClose: stores TRUE previous day close (for 1D change %)
            await prisma.priceCache.upsert({
                where: { symbol },
                create: {
                    symbol,
                    previousClose: price || 0, // Current price (legacy naming)
                    actualPreviousClose: previousClose || null, // True previous day close
                    currency: finalCurrency,
                    sector: profileData?.sector || 'Unknown',
                    country: profileData?.country || 'Unknown',
                    tradeTime: quote.regularMarketTime ? new Date(quote.regularMarketTime) : new Date(),
                    updatedAt: new Date(),
                    source: cacheSource,
                    lastRequestedBy: userId
                },
                update: {
                    previousClose: price || 0, // Current price (legacy naming)
                    actualPreviousClose: previousClose || null, // True previous day close
                    currency: finalCurrency,
                    sector: profileData?.sector,
                    country: profileData?.country,
                    tradeTime: quote.regularMarketTime ? new Date(quote.regularMarketTime) : new Date(),
                    updatedAt: new Date(),
                    source: cacheSource,
                    lastRequestedBy: userId
                }
            });


            return {
                price: price,
                timestamp: (quote.regularMarketTime ? new Date(quote.regularMarketTime) : new Date()).toISOString(),
                currency: finalCurrency,
                previousClose: previousClose,
                change24h: change24h,
                changePercent: previousClose ? (change24h / previousClose) * 100 : 0,
                industry: profileData?.industry || 'N/A',
                sector: profileData?.sector || 'N/A',
                country: profileData?.country || 'N/A'
            };
        }
    } catch (error) {
        console.warn('[MarketData] Yahoo market data error:', error);
    }


    return undefined;
}

/**
 * BATCH: Get prices for multiple symbols at once
 */
export async function getBatchMarketPrices(assets: { symbol: string, type: string, exchange?: string, category?: string }[], forceRefresh: boolean = false): Promise<Record<string, PriceResult | null>> {
    // Development mode: Skip external API calls for faster page loads
    const skipPriceFetch = process.env.SKIP_PRICE_FETCH === 'true';
    if (skipPriceFetch && !forceRefresh) {
        const results: Record<string, PriceResult | null> = {};
        const symbols = assets.map(a => a.symbol);
        const cached = await prisma.priceCache.findMany({ where: { symbol: { in: symbols } } });
        for (const c of cached) {
            if (c.previousClose > 0) {
                results[c.symbol] = {
                    price: c.previousClose,
                    currency: c.currency,
                    timestamp: (c.tradeTime || c.updatedAt).toLocaleString('tr-TR'),
                    previousClose: c.actualPreviousClose || c.previousClose,
                    change24h: 0,
                    changePercent: 0
                };
            }
        }
        return results;
    }

    try {
        // Separate Yahoo-able assets from others
        const yahooSymbols: string[] = [];
        const yahooMap: Record<string, string> = {}; // Search Symbol -> Original Symbol

        for (const a of assets) {
            // Skip non-market assets from batching loop (Cash, BES, TEFAS etc handled separately or ignored here)
            // Also skip if Exchange is explicitly TEFAS (even if type is FUND)
            // Skip Synthetic Assets (GAUTRY, XAGTRY, XPTTRY) as they require multi-step calculation (Commodity * USDTRY)
            // BES = Turkish Pension System - not tradeable on markets
            const platinumTryVariants = ['XPTTRY', 'XPTGTRY', 'XPT-TRY', 'XPTG-TRY', 'PLTTRY'];
            const isPlatinumTry = platinumTryVariants.includes(a.symbol.toUpperCase());
            if (a.type === 'CASH' || a.type === 'BES' || a.type === 'TEFAS' || a.type === 'FON' || a.exchange === 'TEFAS' || a.symbol === 'GAUTRY' || a.symbol === 'XAGTRY' || isPlatinumTry) continue;

            const searchSym = getSearchSymbol(a.symbol, a.type, a.exchange);
            yahooSymbols.push(searchSym);
            yahooMap[searchSym] = a.symbol;
        }

        // Deduplicate symbols to avoid sending same request multiple times
        const uniqueYahooSymbols = [...new Set(yahooSymbols)];

        // Batch Fetch
        const { getYahooQuotes } = await import('./yahooApi');
        const quotes = await getYahooQuotes(uniqueYahooSymbols, forceRefresh);

        const results: Record<string, PriceResult | null> = {};

        // Process only Yahoo results here
        for (const [searchSym, quote] of Object.entries(quotes)) {
            const originalSym = yahooMap[searchSym];
            if (!quote || !originalSym) continue;

            // Apply Adjustments (Gold, Silver, RABO etc)
            const applyAdjustments = (p: number) => {
                let adjusted = p;
                if (originalSym === 'GAUTRY') adjusted = adjusted / 31.1034768;
                if (originalSym === 'XAGTRY') adjusted = adjusted / 31.1034768;
                if (originalSym === 'RABO') adjusted = adjusted / 100.0;
                return adjusted;
            };

            const price = applyAdjustments(quote.regularMarketPrice || 0);
            const prevClose = quote.regularMarketPreviousClose ? applyAdjustments(quote.regularMarketPreviousClose) : 0;
            const change24h = (price - prevClose);

            // STRICT CURRENCY ENFORCEMENT for Batch (Suffix Rule)
            let batchCurrency = quote.currency || 'USD';
            if (originalSym.endsWith('-EUR')) batchCurrency = 'EUR';
            if (originalSym.endsWith('-USD')) batchCurrency = 'USD';
            if (originalSym.endsWith('-TRY')) batchCurrency = 'TRY';
            const batchPlatinumTryCheck = ['XPTTRY', 'XPTGTRY', 'XPT-TRY', 'XPTG-TRY', 'PLTTRY'].includes(originalSym.toUpperCase());
            if (originalSym === 'GAUTRY' || originalSym === 'XAGTRY' || originalSym === 'AET' || batchPlatinumTryCheck) batchCurrency = 'TRY';


            results[originalSym] = {
                price,
                currency: batchCurrency,
                timestamp: (quote.regularMarketTime || new Date()).toISOString(),
                previousClose: prevClose,
                change24h,
                changePercent: prevClose ? (change24h / prevClose) * 100 : 0
            };
        }

        return results;

    } catch (e) {
        console.error("Batch market price error:", e);
        return {};
    }
}


import { convertCurrency as sharedConvert } from '@/lib/currency';

export async function convertCurrency(amount: number, from: string, to: string, customRates?: Record<string, number>): Promise<number> {
    return sharedConvert(amount, from, to, customRates);
}
