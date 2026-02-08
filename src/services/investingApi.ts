/**
 * Investing.com Scraping Service
 *
 * Fetches spot commodity prices from Investing.com
 * Used for assets not available on Yahoo Finance (e.g., XPT spot prices)
 */

import { load } from 'cheerio';

export interface InvestingQuote {
    symbol: string;
    price: number;
    currency: string;
    change: number;
    changePercent: number;
    timestamp: Date;
    source: 'INVESTING';
}

// Investing.com URL mappings for commodities
const INVESTING_URLS: Record<string, string> = {
    // Platinum
    'XPT-USD': 'https://www.investing.com/currencies/xpt-usd',
    'XPT-TRY': 'https://www.investing.com/currencies/xpt-try',
    'XPTG-TRY': 'https://www.investing.com/currencies/xptg-try', // Gram platinum TRY

    // Gold (backup)
    'XAU-USD': 'https://www.investing.com/currencies/xau-usd',
    'XAU-TRY': 'https://www.investing.com/currencies/xau-try',

    // Silver (backup)
    'XAG-USD': 'https://www.investing.com/currencies/xag-usd',
    'XAG-TRY': 'https://www.investing.com/currencies/xag-try',
};

// Browser-like headers to bypass basic bot detection
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,tr;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"macOS"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
};

/**
 * Fetches a quote from Investing.com
 * @param symbol - The symbol to fetch (e.g., 'XPT-USD', 'XPTG-TRY')
 * @returns InvestingQuote or null if fetch fails
 */
export async function getInvestingQuote(symbol: string): Promise<InvestingQuote | null> {
    const upperSymbol = symbol.toUpperCase();
    const url = INVESTING_URLS[upperSymbol];

    if (!url) {
        console.warn(`[InvestingAPI] No URL mapping for symbol: ${symbol}`);
        return null;
    }

    try {
        console.log(`[InvestingAPI] Fetching ${symbol} from ${url}`);

        const response = await fetch(url, {
            headers: HEADERS,
            // Add a small random delay to seem more human-like
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            console.error(`[InvestingAPI] HTTP ${response.status} for ${symbol}`);
            return null;
        }

        const html = await response.text();
        const $ = load(html);

        // Investing.com uses various selectors for price display
        // Try multiple selectors to find the price
        let priceText: string | null = null;
        let changeText: string | null = null;
        let changePercentText: string | null = null;

        // Selector 1: Modern layout (data-test attributes)
        priceText = $('[data-test="instrument-price-last"]').text().trim();
        changeText = $('[data-test="instrument-price-change"]').text().trim();
        changePercentText = $('[data-test="instrument-price-change-percent"]').text().trim();

        // Selector 2: Alternative layout
        if (!priceText) {
            priceText = $('.instrument-price_last__2sGsP').text().trim();
        }

        // Selector 3: Older layout
        if (!priceText) {
            priceText = $('#last_last').text().trim();
            changeText = $('span.parentheses').text().trim();
        }

        // Selector 4: Currency pair specific
        if (!priceText) {
            priceText = $('span[class*="text-2xl"]').first().text().trim();
        }

        // Selector 5: JSON-LD structured data
        if (!priceText) {
            const jsonLd = $('script[type="application/ld+json"]').html();
            if (jsonLd) {
                try {
                    const data = JSON.parse(jsonLd);
                    if (data['@type'] === 'ExchangeRateSpecification' || data.price) {
                        priceText = String(data.price || data.currentExchangeRate?.price);
                    }
                } catch (e) {
                    // JSON parse failed, continue
                }
            }
        }

        if (!priceText) {
            console.warn(`[InvestingAPI] Could not find price for ${symbol}`);
            console.log(`[InvestingAPI] HTML snippet (first 2000 chars):`, html.substring(0, 2000));
            return null;
        }

        // Parse price (remove commas, handle Turkish number format)
        const price = parsePrice(priceText);
        if (isNaN(price) || price <= 0) {
            console.warn(`[InvestingAPI] Invalid price for ${symbol}: ${priceText}`);
            return null;
        }

        // Parse change values
        let change = 0;
        let changePercent = 0;

        if (changeText) {
            change = parsePrice(changeText);
        }
        if (changePercentText) {
            // Remove % and parentheses
            changePercent = parsePrice(changePercentText.replace(/[%()]/g, ''));
        }

        // Determine currency from symbol
        const currency = upperSymbol.endsWith('-TRY') ? 'TRY' : 'USD';

        console.log(`[InvestingAPI] Successfully fetched ${symbol}: ${price} ${currency}`);

        return {
            symbol: upperSymbol,
            price,
            currency,
            change,
            changePercent,
            timestamp: new Date(),
            source: 'INVESTING',
        };

    } catch (error) {
        console.error(`[InvestingAPI] Error fetching ${symbol}:`, error);
        return null;
    }
}

/**
 * Parse a price string to number
 * Handles both US (1,234.56) and Turkish (1.234,56) formats
 */
function parsePrice(text: string): number {
    if (!text) return NaN;

    // Remove whitespace and currency symbols
    let cleaned = text.trim().replace(/[₺$€£\s]/g, '');

    // Detect format by looking at last separator
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');

    if (lastComma > lastDot) {
        // Turkish format: 1.234,56 -> 1234.56
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
        // US format: 1,234.56 -> 1234.56
        cleaned = cleaned.replace(/,/g, '');
    }

    return parseFloat(cleaned);
}

/**
 * Get platinum spot price in TRY (gram)
 * This is the main function for XPTTRY
 */
export async function getPlatinumSpotTRY(): Promise<InvestingQuote | null> {
    // Try XPTG-TRY first (gram price directly)
    let quote = await getInvestingQuote('XPTG-TRY');
    if (quote) {
        return quote;
    }

    // Fallback: Get XPT-TRY (ounce) and convert to gram
    quote = await getInvestingQuote('XPT-TRY');
    if (quote) {
        const gramPrice = quote.price / 31.1034768;
        return {
            ...quote,
            symbol: 'XPTTRY',
            price: gramPrice,
        };
    }

    return null;
}

/**
 * Get platinum spot price in USD (ounce)
 */
export async function getPlatinumSpotUSD(): Promise<InvestingQuote | null> {
    return getInvestingQuote('XPT-USD');
}
