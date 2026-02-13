import { apiCache } from '@/lib/cache';
import { trackApiRequest } from '@/services/telemetry';
import { fetchWithTimeout, API_TIMEOUT } from '@/lib/fetch-with-timeout';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

/**
 * Get Finnhub API key from environment
 * Returns null if not configured (disables Finnhub features)
 */
function getFinnhubApiKey(): string | null {
    const key = process.env.FINNHUB_API_KEY;
    if (!key) {
        if (process.env.NODE_ENV === 'development') {
            console.warn('[Finnhub] API key not configured - Finnhub features disabled');
        }
        return null;
    }
    return key;
}

export interface FinnhubSymbol {
    description: string;
    displaySymbol: string;
    symbol: string;
    type: string;
}

export interface FinnhubQuote {
    c: number;  // Current price
    h: number;  // High price of the day
    l: number;  // Low price of the day
    o: number;  // Open price of the day
    pc: number; // Previous close price
    t: number;  // Timestamp
}

export interface FinnhubProfile {
    country: string;
    currency: string;
    exchange: string;
    name: string;
    ticker: string;
    finnhubIndustry?: string;  // Finnhub's industry classification
    sector?: string;            // Company sector (e.g., "Technology")
    industry?: string;          // Company industry
}

/**
 * Search for symbols (stocks, crypto, etc.)
 */
export async function searchSymbols(query: string): Promise<FinnhubSymbol[]> {
    if (!query || query.length < 2) return [];

    const apiKey = getFinnhubApiKey();
    if (!apiKey) return [];

    const cacheKey = `search:${query.toLowerCase()}`;
    const cached = apiCache.get<FinnhubSymbol[]>(cacheKey);

    if (cached) return cached;

    try {
        const response = await fetchWithTimeout(
            `${FINNHUB_BASE_URL}/search?q=${encodeURIComponent(query)}&token=${apiKey}`,
            { timeout: API_TIMEOUT }
        );

        if (!response.ok) {
            console.error('Finnhub search error:', response.status);
            return [];
        }

        const data = await response.json();
        const results = data.result || [];

        // Cache for 5 minutes
        apiCache.set(cacheKey, results, 5);

        return results;
    } catch (error) {
        console.error('Error searching symbols:', error);
        return [];
    }
}

/**
 * Get real-time quote for a symbol
 */
export async function getQuote(symbol: string): Promise<FinnhubQuote | null> {
    const apiKey = getFinnhubApiKey();
    if (!apiKey) return null;

    const cacheKey = `quote:${symbol.toUpperCase()}`;
    const cached = apiCache.get<FinnhubQuote>(cacheKey);

    if (cached) return cached;

    try {
        const response = await fetchWithTimeout(
            `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
            { timeout: API_TIMEOUT }
        );

        if (!response.ok) {
            if (response.status !== 403) {
                console.warn('Finnhub quote error:', response.status);
            }
            return null;
        }

        const quote = await response.json();

        // Cache for 1 minute
        apiCache.set(cacheKey, quote, 1);

        return quote;
    } catch (error) {
        console.error('Error fetching quote:', error);
        return null;
    }
}

/**
 * Get company profile
 */
export async function getCompanyProfile(symbol: string): Promise<FinnhubProfile | null> {
    const apiKey = getFinnhubApiKey();
    if (!apiKey) return null;

    const cacheKey = `profile:${symbol.toUpperCase()}`;
    const cached = apiCache.get<FinnhubProfile>(cacheKey);

    if (cached) return cached;

    const startTime = Date.now();
    try {
        const response = await fetchWithTimeout(
            `${FINNHUB_BASE_URL}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
            { timeout: API_TIMEOUT }
        );

        if (!response.ok) {
            if (response.status !== 403) {
                console.warn('Finnhub profile error:', response.status);
            }
            await trackApiRequest('FINNHUB', false, { endpoint: 'profile2', params: symbol, statusCode: response.status, duration: Date.now() - startTime, error: `HTTP ${response.status}` });
            return null;
        }

        const profile = await response.json();

        apiCache.set(cacheKey, profile, 1440);
        await trackApiRequest('FINNHUB', true, { endpoint: 'profile2', params: symbol, duration: Date.now() - startTime, statusCode: 200 });

        return profile;
    } catch (error) {
        console.error('Error fetching company profile:', error);
        await trackApiRequest('FINNHUB', false, { endpoint: 'profile2', params: symbol, duration: Date.now() - startTime, error: String(error) });
        return null;
    }
}
