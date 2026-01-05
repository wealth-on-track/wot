import { getYahooQuote, searchYahoo } from './yahooApi';
import { getTefasFundInfo } from './tefasApi';
import { cleanAssetName } from '@/lib/companyNames';

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
    previousClose?: number;
    nextEarningsDate?: string;
    country?: string;
    sector?: string;
    industry?: string;
    marketState?: string;
}

/**
 * Shared logic to translate raw symbols to searchable tickers (e.g., ASML -> ASML.AS)
 */
export function getSearchSymbol(symbol: string, type: string): string {
    const s = symbol.toUpperCase();
    const t = type.toUpperCase();

    // 1. Known BIST Stocks
    const bistStocks = ['TAVHL', 'THYAO', 'GARAN', 'AKBNK', 'EREGL', 'KCHOL', 'SAHOL', 'SISE', 'BIMAS', 'ASELS'];
    if (t === 'STOCK' && bistStocks.includes(s)) return `${s}.IS`;

    // 2. Specific Global Mappings
    if (s === 'ASML') return 'ASML.AS'; // Primary Euronext listing
    if (s === 'RABO') return 'RABO.AS';

    // 3. Commodities
    if (s === 'XAU') return 'GC=F';
    if (s === 'GAUTRY') return 'GC=F'; // Use Gold Futures directly to avoid XAUTRY=X 404
    if (s === 'XAGTRY') return 'SI=F'; // Use Silver Futures to avoid XAGTRY=X 404

    // 4. Default
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
        console.error('Error fetching asset name:', e);
    }
    return null;
}

function estimateMarketState(exchange?: string): string {
    if (!exchange) return 'CLOSED';

    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const totalMinutes = utcHours * 60 + utcMinutes;

    // US Markets (NYSE, NASDAQ): ~14:30 - 21:00 UTC
    if (['NASDAQ', 'NYSE', 'US', 'NMS', 'NGM'].includes(exchange)) {
        if (totalMinutes >= 870 && totalMinutes < 1260) return 'REGULAR';
        return 'CLOSED';
    }

    // European Markets (AMS, PAR, BRU, MIL, MAD, LSE): ~08:00 - 16:30 UTC
    if (['AMS', 'PAR', 'BRU', 'MIL', 'MC', 'LSE', 'AS', 'PA'].includes(exchange)) {
        if (totalMinutes >= 480 && totalMinutes < 990) return 'REGULAR';
        return 'CLOSED';
    }

    // Istanbul (BIST) & TEFAS Funds: ~07:00 - 15:00 UTC (10:00 - 18:00 TRT)
    if (['IST', 'BIST', 'IS', 'TEFAS'].includes(exchange)) {
        if (totalMinutes >= 420 && totalMinutes < 900) return 'REGULAR';
        return 'CLOSED';
    }

    return 'CLOSED';
}

export async function getMarketPrice(symbol: string, type: string, exchange?: string, forceRefresh: boolean = false): Promise<PriceResult | undefined> {

    // CASH assets always have a price of 1.0 (relative to themselves)
    // The valuation logic converts this 1.0 * quantity (which is the amount) to the target currency.
    if (type === 'CASH') {
        return {
            price: 1.0,
            timestamp: new Date().toLocaleString('tr-TR'),
            marketState: 'REGULAR' // Cash is always open
        };
    }

    // TEFAS Fund Check
    if (exchange === 'TEFAS' || (type === 'FUND' && symbol.length === 3 && !symbol.includes('.'))) {
        // Try TEFAS
        const tefasData = await getTefasFundInfo(symbol);
        if (tefasData) {
            return {
                price: tefasData.price,
                timestamp: tefasData.lastUpdated || new Date().toLocaleString('tr-TR'),
                currency: 'TRY',
                marketState: estimateMarketState('TEFAS') // Use shared logic
            };
        }
    }

    // Try Yahoo Finance API
    try {
        const searchSymbol = getSearchSymbol(symbol, type);
        const fallbackState = estimateMarketState(exchange);

        // Special handling for GAUTRY/XAGTRY: Always use derived calculation to avoid 404s/Errors
        if (symbol === 'GAUTRY' || symbol === 'XAGTRY') {
            try {
                const isGold = symbol === 'GAUTRY';
                const [commodity, usdtry] = await Promise.all([
                    getYahooQuote(isGold ? 'GC=F' : 'SI=F'),
                    getYahooQuote('USDTRY=X')
                ]);

                const commodityPrice = commodity?.regularMarketPrice;
                const parity = usdtry?.regularMarketPrice;

                if (commodityPrice && parity) {
                    const gramPrice = (commodityPrice * parity) / 31.1034768;
                    return {
                        price: gramPrice,
                        timestamp: new Date().toLocaleString('tr-TR'),
                        currency: 'TRY',
                        marketState: commodity?.marketState || 'REGULAR' // Inherit or default to Open
                    };
                }
            } catch (err) {
                console.error(`Failed to calculate derived ${symbol} price`, err);
            }
        }

        const quote = await getYahooQuote(searchSymbol, forceRefresh);

        if (quote && quote.regularMarketPrice) {
            let price = quote.regularMarketPrice;

            // Conversion for Gram Gold (if we got the primary XAUTRY quote)
            if (symbol === 'GAUTRY') {
                // XAUTRY=X is per Ounce. 1 Ounce = 31.1035 Grams
                price = price / 31.1034768;
            }

            // Special handling for RABO (Rabobank Certificates treated as 1/100 split by user)
            if (symbol === 'RABO') {
                // RABO.AS is ~115 EUR, User tracks as ~1.15 EUR
                price = price / 100.0;
            }

            // Conversion for Gram Silver
            if (symbol === 'XAGTRY') {
                price = price / 31.1034768;
            }

            // Calculate change if previous close is available
            let change24h = 0;
            let previousClose = quote.regularMarketPreviousClose;

            if (previousClose) {
                // Adjust previous close for Gram Gold/Silver unit conversion
                if (symbol === 'GAUTRY' || symbol === 'XAGTRY') {
                    previousClose = previousClose / 31.1034768;
                }
                change24h = price - previousClose;
            }

            // Fetch company profile for country and sector
            // Priority: Alpha Vantage (free, reliable) → Finnhub → Yahoo (rate-limited)
            let profileData = null;
            if (type === 'STOCK' || type === 'ETF' || type === 'FUND') {
                try {
                    // Try Alpha Vantage first (500 req/day, has sector data)
                    const { getCompanyOverview } = await import('./alphaVantageApi');
                    profileData = await getCompanyOverview(searchSymbol);

                    if (!profileData) {
                        // Fallback to Finnhub (but profile2 is premium)
                        try {
                            const { getCompanyProfile } = await import('./finnhubApi');
                            const profile = await getCompanyProfile(searchSymbol);
                            if (profile) {
                                profileData = {
                                    country: profile.country,
                                    sector: profile.sector || profile.finnhubIndustry,
                                    industry: profile.industry
                                };
                            }
                        } catch (finnhubError) {
                            // Continue to Yahoo fallback
                        }
                    }

                    if (!profileData) {
                        // Last resort: Yahoo (has rate limits)
                        try {
                            const { getYahooAssetProfile } = await import('./yahooApi');
                            profileData = await getYahooAssetProfile(searchSymbol);
                        } catch (yahooError) {
                            console.warn('[MarketData] All profile APIs failed');
                        }
                    }
                } catch (e) {
                    console.warn('[MarketData] Failed to fetch asset profile:', e);
                }
            }

            return {
                price: price,
                timestamp: quote.regularMarketTime ? new Date(quote.regularMarketTime).toLocaleString('tr-TR') : new Date().toLocaleString('tr-TR'),
                currency: quote.currency,
                previousClose: previousClose,
                change24h: change24h,
                changePercent: previousClose ? (change24h / previousClose) * 100 : 0,
                nextEarningsDate: quote.earningsTimestamp ? new Date(quote.earningsTimestamp * 1000).toLocaleDateString('tr-TR') : undefined,
                industry: profileData?.industry,
                marketState: quote.marketState || fallbackState
            };
        }
    } catch (error) {
        console.error('Yahoo market data error:', error);
    }

    // Fallback?
    // If Yahoo fails, maybe return null? Or mock?
    // Let's return null so UI knows.
    return null;
}

import { convertCurrency as sharedConvert } from '@/lib/currency';

export async function convertCurrency(amount: number, from: string, to: string, customRates?: Record<string, number>): Promise<number> {
    return sharedConvert(amount, from, to, customRates);
}
