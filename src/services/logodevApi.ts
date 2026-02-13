import { trackApiRequest } from './telemetry';

/**
 * LogoDev API - Company logo fetcher
 * SECURITY: API key must be set via environment variable
 * No fallback - if key not set, service is disabled
 */

export interface LogoDevResponse {
    url: string;
    success: boolean;
}

/**
 * Get company logo URL from LogoDev
 * Returns null if API key is not configured or request fails
 */
export const getLogoDevLogo = async (ticker: string): Promise<string | null> => {
    const apiKey = process.env.NEXT_PUBLIC_LOGODEV_API_KEY;

    // SECURITY: Require API key - no fallback
    if (!apiKey) {
        if (process.env.NODE_ENV === 'development') {
            console.warn('[LogoDev] API key not configured - logo service disabled');
        }
        return null;
    }

    const url = `https://img.logo.dev/ticker/${ticker}?token=${apiKey}`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'WealthOnTrack/1.0'
            }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            await trackApiRequest('LOGODEV', true);
            return url;
        } else {
            await trackApiRequest('LOGODEV', false, { error: `HTTP ${response.status}` });
            return null;
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await trackApiRequest('LOGODEV', false, { error: errorMessage });
        return null;
    }
};
