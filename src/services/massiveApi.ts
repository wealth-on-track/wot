
import { apiCache } from '@/lib/cache';
import { trackApiRequest } from '@/services/telemetry';

const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY || '';
// Massive uses the same endpoints as Polygon v3, or api.massive.com
// Docs say api.polygon.io redirects/works. Let's use api.polygon.io for stability unless docs specify api.massive.com exclusively.
// Rebrand info says "api.polygon.io will continue to work". We'll use that to be safe, or try massive if needed.
const MASSIVE_BASE_URL = 'https://api.polygon.io/v3';

/**
 * Get ticker details from Massive (Polygon)
 * Limit: 5 requests / minute (Free Tier)
 */
export async function getMassiveTickerDetails(symbol: string): Promise<{ country?: string, sector?: string, exchange?: string } | null> {
    if (!MASSIVE_API_KEY) return null;

    const cacheKey = `massive_ticker_${symbol}`;
    const cached = apiCache.get<{ country?: string, sector?: string, exchange?: string }>(cacheKey);

    if (cached) return cached;

    // TODO: Implement Token Bucket or simple timestamp check for 5 req/min if needed.
    // For now, telemetry tracks it, and we rely on the API returning 429 if we hit it.

    const startTime = Date.now();
    try {
        console.log(`[Massive] Fetching ${symbol}... (Limit: 5/min)`);

        // Polygon Ticker Details Endpoint
        const url = `${MASSIVE_BASE_URL}/reference/tickers/${encodeURIComponent(symbol)}?apiKey=${MASSIVE_API_KEY}`;

        const response = await fetch(url);

        if (!response.ok) {
            console.warn('[Massive] API error:', response.status);
            if (response.status === 429) {
                await trackApiRequest('MASSIVE', false, { endpoint: 'ticker-details', params: symbol, statusCode: 429, duration: Date.now() - startTime, error: 'Rate Limit (5/min)' });
            } else {
                await trackApiRequest('MASSIVE', false, { endpoint: 'ticker-details', params: symbol, statusCode: response.status, duration: Date.now() - startTime, error: `HTTP ${response.status}` });
            }
            return null;
        }

        const data = await response.json();

        if (!data.results) {
            await trackApiRequest('MASSIVE', false, { endpoint: 'ticker-details', params: symbol, statusCode: 200, duration: Date.now() - startTime, error: 'Not Found' });
            return null;
        }

        const details = data.results;

        // Massive/Polygon mapping
        // sic_description can sometimes map to sector, but they also have 'sic_sector' or 'market'
        // Usually: results.locale (country), results.sic_description (industry/sector), results.primary_exchange

        const result = {
            country: details.locale?.toUpperCase() || '',
            // Polygon gives 'sic_description' usually, e.g. "Services-Computer Programming, Data Processing, Etc."
            sector: details.sic_description || details.market || '',
            exchange: details.primary_exchange || ''
        };

        apiCache.set(cacheKey, result, 10080); // 7 days (static data)
        await trackApiRequest('MASSIVE', true, { endpoint: 'ticker-details', params: symbol, duration: Date.now() - startTime, statusCode: 200 });

        return result;

    } catch (error) {
        console.error('[Massive] Error:', error);
        await trackApiRequest('MASSIVE', false, { endpoint: 'ticker-details', params: symbol, duration: Date.now() - startTime, error: String(error) });
        return null;
    }
}
