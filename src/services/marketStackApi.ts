
import { apiCache } from '@/lib/cache';
import { trackApiRequest } from '@/services/telemetry';

const MARKETSTACK_API_KEY = process.env.MARKETSTACK_API_KEY || '';
const MARKETSTACK_BASE_URL = 'http://api.marketstack.com/v1';

export interface MarketStackTicker {
    name: string;
    symbol: string;
    stock_exchange: {
        name: string;
        acronym: string;
        country: string;
    };
}

/**
 * Get ticker details from Marketstack
 * Strict Limit: 100 requests / month
 */
export async function getMarketStackTicker(symbol: string): Promise<{ country?: string, sector?: string, exchange?: string } | null> {
    if (!MARKETSTACK_API_KEY) return null;

    // Normalize symbol for Marketstack (often pure ticker, but supports some suffixes)
    // Marketstack often uses "AAPL" or "INGA.XAMS" format. 
    // We'll trust the input symbol for now but might need mapping.
    const cacheKey = `marketstack_ticker_${symbol}`;
    const cached = apiCache.get<{ country?: string, sector?: string, exchange?: string }>(cacheKey);

    if (cached) return cached;

    const startTime = Date.now();
    try {
        console.log(`[MarketStack] Fetching ${symbol}... (Quota: 100/mo)`);

        // Using /tickers endpoint
        const url = `${MARKETSTACK_BASE_URL}/tickers/${encodeURIComponent(symbol)}?access_key=${MARKETSTACK_API_KEY}`;

        const response = await fetch(url);

        if (!response.ok) {
            console.warn('[MarketStack] API error:', response.status);
            await trackApiRequest('MARKETSTACK', false, { endpoint: 'tickers', params: symbol, statusCode: response.status, duration: Date.now() - startTime, error: `HTTP ${response.status}` });
            return null;
        }

        const data = await response.json();

        if (data.error) {
            console.warn('[MarketStack] API returned error:', data.error);
            await trackApiRequest('MARKETSTACK', false, { endpoint: 'tickers', params: symbol, statusCode: 200, duration: Date.now() - startTime, error: data.error.message || 'API Error' });
            return null;
        }

        const ticker = data; // Root object is the ticker data or data key depending on endpoint? 
        // Docs say /tickers/SYMBOL returns the ticker object directly usually.
        // Let's assume standard response structure.

        // Mapping
        const result = {
            country: ticker.stock_exchange?.country || ticker.country || '',
            exchange: ticker.stock_exchange?.name || ticker.stock_exchange?.acronym || '',
            // Marketstack basic tier doesn't always give sector, but let's check custom fields or assumption
            sector: '' // Marketstack primarily good for exchange/country info on basic tier
        };

        apiCache.set(cacheKey, result, 10080); // Cache for 7 days since quota is expensive
        await trackApiRequest('MARKETSTACK', true, { endpoint: 'tickers', params: symbol, duration: Date.now() - startTime, statusCode: 200 });

        return result;

    } catch (error) {
        console.error('[MarketStack] Error:', error);
        await trackApiRequest('MARKETSTACK', false, { endpoint: 'tickers', params: symbol, duration: Date.now() - startTime, error: String(error) });
        return null;
    }
}
