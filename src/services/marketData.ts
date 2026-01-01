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
}

export async function getAssetName(symbol: string, type: string, exchange?: string): Promise<string | null> {
    // CASH is simple
    if (type === 'CASH') return null;

    try {
        if (exchange === 'TEFAS' || (type === 'FUND' && symbol.length === 3 && !symbol.includes('.'))) {
            const tefasData = await getTefasFundInfo(symbol);
            if (tefasData) return tefasData.title;
        }

        let searchSymbol = symbol;

        // Handle BIST stocks suffix for search as well
        if (type === 'STOCK' && (symbol === 'TAVHL' || symbol === 'THYAO' || symbol === 'GARAN' || symbol === 'AKBNK')) {
            searchSymbol = `${symbol}.IS`;
        }

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

export async function getMarketPrice(symbol: string, type: string, exchange?: string): Promise<PriceResult | null> {

    // CASH assets always have a price of 1.0 (relative to themselves)
    // The valuation logic converts this 1.0 * quantity (which is the amount) to the target currency.
    if (type === 'CASH') {
        return {
            price: 1.0,
            timestamp: new Date().toLocaleString('tr-TR')
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
                currency: 'TRY'
            };
        }
    }

    // Try Yahoo Finance API
    try {
        // Handle BIST stocks suffix
        let searchSymbol = symbol;
        if (type === 'STOCK' && (symbol === 'TAVHL' || symbol === 'THYAO' || symbol === 'GARAN' || symbol === 'AKBNK')) {
            searchSymbol = `${symbol}.IS`;
        } else if (type === 'STOCK' && symbol === 'ASML') {
            searchSymbol = 'ASML.AS'; // Favor Euronext Amsterdam for ASML (Primary Listing)
        } else if (symbol === 'XAU') {
            searchSymbol = 'GC=F'; // Gold Futures (working ticker)
        } else if (symbol === 'GAUTRY') {
            searchSymbol = 'XAUTRY=X'; // Ounce Gold in TRY
        } else if (symbol === 'XAGTRY') {
            searchSymbol = 'XAGTRY=X'; // Ounce Silver in TRY
        } else if (type === 'STOCK' && !symbol.includes('.')) {
            // Check if it's a known BIST stock or trust Yahoo to find it? 
            // Better to try direct symbol first.
            // Yahoo usually needs suffix for non-US. 
        }

        const quote = await getYahooQuote(searchSymbol);

        // Special handling for GAUTRY fallback
        if (symbol === 'GAUTRY' && (!quote || !quote.regularMarketPrice)) {
            // Fallback: Calculate via XAUUSD * USDTRY / 31.10
            try {
                // Try XAUUSD first, then GC=F (Gold Futures)
                const [xau, gcf, usdtry] = await Promise.all([
                    getYahooQuote('XAUUSD=X'),
                    getYahooQuote('GC=F'), // Fallback for gold price
                    getYahooQuote('USDTRY=X')
                ]);

                const goldPrice = xau?.regularMarketPrice || gcf?.regularMarketPrice;
                const parity = usdtry?.regularMarketPrice;

                if (goldPrice && parity) {
                    const gramPrice = (goldPrice * parity) / 31.1034768;
                    return {
                        price: gramPrice,
                        timestamp: new Date().toLocaleString('tr-TR'),
                        currency: 'TRY'
                    };
                }
            } catch (err) {
                console.error("Failed to calculate derived gold price", err);
            }
        }

        // Special handling for XAGTRY (Silver) fallback
        if (symbol === 'XAGTRY' && (!quote || !quote.regularMarketPrice)) {
            // Fallback: Calculate via XAGUSD * USDTRY / 31.10
            try {
                const [xag, sif, usdtry] = await Promise.all([
                    getYahooQuote('XAGUSD=X'),
                    getYahooQuote('SI=F'), // Silver Futures
                    getYahooQuote('USDTRY=X')
                ]);

                const silverPrice = xag?.regularMarketPrice || sif?.regularMarketPrice;
                const parity = usdtry?.regularMarketPrice;

                if (silverPrice && parity) {
                    const gramPrice = (silverPrice * parity) / 31.1034768;
                    return {
                        price: gramPrice,
                        timestamp: new Date().toLocaleString('tr-TR'),
                        currency: 'TRY'
                    };
                }
            } catch (err) {
                console.error("Failed to calculate derived silver price", err);
            }
        }

        if (quote && quote.regularMarketPrice) {
            let price = quote.regularMarketPrice;

            // Conversion for Gram Gold (if we got the primary XAUTRY quote)
            if (symbol === 'GAUTRY') {
                // XAUTRY=X is per Ounce. 1 Ounce = 31.1035 Grams
                price = price / 31.1034768;
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

            return {
                price: price,
                timestamp: quote.regularMarketTime ? new Date(quote.regularMarketTime).toLocaleString('tr-TR') : new Date().toLocaleString('tr-TR'),
                currency: quote.currency,
                previousClose: previousClose,
                change24h: change24h,
                changePercent: previousClose ? (change24h / previousClose) * 100 : 0,
                nextEarningsDate: quote.earningsTimestamp ? new Date(quote.earningsTimestamp * 1000).toLocaleDateString('tr-TR') : undefined
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

export async function convertCurrency(amount: number, from: string, to: string): Promise<number> {
    return sharedConvert(amount, from, to);
}
