import { apiCache } from '@/lib/cache';
import { trackApiRequest } from '@/services/telemetry';

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || '';
const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';

export interface AlphaVantageProfile {
    Symbol: string;
    AssetType: string;
    Name: string;
    Description: string;
    Exchange: string;
    Currency: string;
    Country: string;
    Sector: string;
    Industry: string;
    MarketCapitalization: string;
}

/**
 * Get company overview/profile from Alpha Vantage
 * Includes: country, sector, industry
 */
export async function getCompanyOverview(symbol: string): Promise<{ country?: string, sector?: string, industry?: string } | null> {
    const cacheKey = `alphavantage_profile_${symbol}`;

    // Check cache first (24 hours)
    const cached = apiCache.get<{ country?: string, sector?: string, industry?: string }>(cacheKey);
    if (cached) {
        return cached;
    }


    const startTime = Date.now();
    try {
        const url = `${ALPHA_VANTAGE_BASE_URL}?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error('[AlphaVantage] API error:', response.status);
            await trackApiRequest('ALPHA', false, { endpoint: 'OVERVIEW', params: symbol, statusCode: response.status, duration: Date.now() - startTime, error: `HTTP ${response.status}` });
            return null;
        }

        const data = await response.json();

        // Check if we got valid data
        if (!data || !data.Symbol || data.Note || data['Error Message']) {
            if (data.Note) {
                console.warn('[AlphaVantage] Rate limit reached:', data.Note);
                await trackApiRequest('ALPHA', false, { endpoint: 'OVERVIEW', params: symbol, duration: Date.now() - startTime, error: 'Rate Limit', statusCode: 429 });
            } else {
                await trackApiRequest('ALPHA', false, { endpoint: 'OVERVIEW', params: symbol, duration: Date.now() - startTime, error: 'Invalid Data/Not Found', statusCode: 200 });
            }
            apiCache.set(cacheKey, null, 60);
            return null;
        }

        const profile = {
            country: data.Country,
            sector: data.Sector,
            industry: data.Industry
        };

        apiCache.set(cacheKey, profile, 1440);
        await trackApiRequest('ALPHA', true, { endpoint: 'OVERVIEW', params: symbol, duration: Date.now() - startTime, statusCode: 200 });

        return profile;
    } catch (error) {
        console.error('[AlphaVantage] Error fetching company overview:', error);
        apiCache.set(cacheKey, null, 60);
        await trackApiRequest('ALPHA', false, { endpoint: 'OVERVIEW', params: symbol, duration: Date.now() - startTime, error: String(error) });
        return null;
    }
}
