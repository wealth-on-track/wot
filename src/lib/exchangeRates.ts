import { prisma } from "@/lib/prisma";

export interface RatesMap {
    [currency: string]: number;
}

/**
 * Exchange Rates Service
 * - Fetches and caches exchange rates from Yahoo Finance
 * - Race condition protection with in-flight tracking
 * - Quiet hours optimization (no updates 00:00-08:00 CET)
 * - Fallback rates for critical currencies
 */

// Prevent concurrent fetches (race condition protection)
let fetchInProgress: Promise<RatesMap> | null = null;

// Emergency fallback rates (updated periodically)
const FALLBACK_RATES: Record<string, number> = {
    USD: 1.09,
    TRY: 37.5,
    GBP: 0.85,
    CHF: 0.95,
    JPY: 165.0,
};

/**
 * Check if we're in quiet hours (00:00-08:00 CET)
 * No rate updates during this period to reduce API calls
 */
function isQuietHours(): boolean {
    const now = new Date();
    const cetHour = (now.getUTCHours() + 1) % 24;
    return cetHour >= 0 && cetHour < 8;
}

/**
 * Check if a rate is stale (updated before current hour)
 */
function isStale(lastUpdateUTC: Date): boolean {
    if (isQuietHours()) return false;

    const now = new Date();
    const currentHourFloor = new Date(now);
    currentHourFloor.setMinutes(0, 0, 0);

    return lastUpdateUTC.getTime() < currentHourFloor.getTime();
}

export async function getExchangeRates(): Promise<RatesMap> {
    // Return in-progress fetch if one exists (prevents race conditions)
    if (fetchInProgress) {
        return fetchInProgress;
    }

    fetchInProgress = fetchExchangeRatesInternal();

    try {
        return await fetchInProgress;
    } finally {
        fetchInProgress = null;
    }
}

async function fetchExchangeRatesInternal(): Promise<RatesMap> {
    // 0. Detect Required Currencies dynamically from Assets
    const activeAssets = await prisma.asset.findMany({
        where: { quantity: { gt: 0 } },
        select: { currency: true },
        distinct: ['currency']
    });

    const activeCurrencies = activeAssets.map(a => a.currency).filter(c => c !== 'EUR');
    const requiredCurrencies = Array.from(new Set([...activeCurrencies, 'USD', 'TRY']));

    // 1. Check DB
    const storedRates = await prisma.exchangeRate.findMany();

    const rates: RatesMap = { EUR: 1 };
    let needsUpdate = false;

    // Populate rates from DB
    for (const r of storedRates) {
        rates[r.currency] = r.rate;
    }

    // Check freshness
    if (storedRates.length === 0) {
        needsUpdate = true;
    } else {
        for (const cur of requiredCurrencies) {
            const r = storedRates.find(x => x.currency === cur);
            if (!r) {
                if (process.env.NODE_ENV === 'development') {
                    console.log(`[ExchangeRates] Missing rate for: ${cur}`);
                }
                needsUpdate = true;
                break;
            }
            if (isStale(r.updatedAt)) {
                needsUpdate = true;
                break;
            }
        }
    }

    if (needsUpdate && !isQuietHours()) {
        try {
            if (process.env.NODE_ENV === 'development') {
                console.log(`[ExchangeRates] Fetching for: ${requiredCurrencies.join(', ')}`);
            }

            const yahooSymbols = requiredCurrencies.map(c => `EUR${c}=X`);
            const { getYahooQuotes } = await import('@/services/yahooApi');

            // Timeout protection (2.5s for mobile performance)
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Exchange rate fetch timeout')), 2500)
            );

            const quotes = await Promise.race([
                getYahooQuotes(yahooSymbols),
                timeoutPromise
            ]);

            const newRates: Record<string, number> = {};

            for (const cur of requiredCurrencies) {
                const sym = `EUR${cur}=X`;
                const quote = quotes[sym];
                if (quote?.regularMarketPrice && quote.regularMarketPrice > 0) {
                    newRates[cur] = quote.regularMarketPrice;
                }
            }

            // Batch update DB (more efficient than parallel upserts)
            if (Object.keys(newRates).length > 0) {
                const now = new Date();
                await Promise.all(
                    Object.entries(newRates).map(([currency, rate]) =>
                        prisma.exchangeRate.upsert({
                            where: { currency },
                            create: { currency, rate, updatedAt: now },
                            update: { rate, updatedAt: now }
                        })
                    )
                );

                // Update local rates
                Object.assign(rates, newRates);

                if (process.env.NODE_ENV === 'development') {
                    console.log('[ExchangeRates] Updated successfully');
                }
            }
        } catch (e) {
            console.error('[ExchangeRates] Fetch error:', e instanceof Error ? e.message : e);
            // Continue with cached/fallback rates
        }
    }

    // Apply fallback rates for missing critical currencies
    for (const [currency, fallbackRate] of Object.entries(FALLBACK_RATES)) {
        if (!rates[currency]) {
            if (process.env.NODE_ENV === 'development') {
                console.warn(`[ExchangeRates] Using fallback for ${currency}`);
            }
            rates[currency] = fallbackRate;
        }
    }

    return rates;
}

/**
 * Force refresh exchange rates (bypasses cache and quiet hours)
 * Use sparingly - only for admin actions
 */
export async function forceRefreshExchangeRates(): Promise<RatesMap> {
    fetchInProgress = null; // Clear any in-progress fetch
    const currencies = ['USD', 'TRY', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD'];

    try {
        const yahooSymbols = currencies.map(c => `EUR${c}=X`);
        const { getYahooQuotes } = await import('@/services/yahooApi');
        const quotes = await getYahooQuotes(yahooSymbols);

        const rates: RatesMap = { EUR: 1 };
        const now = new Date();

        for (const cur of currencies) {
            const quote = quotes[`EUR${cur}=X`];
            if (quote?.regularMarketPrice) {
                rates[cur] = quote.regularMarketPrice;
                await prisma.exchangeRate.upsert({
                    where: { currency: cur },
                    create: { currency: cur, rate: quote.regularMarketPrice, updatedAt: now },
                    update: { rate: quote.regularMarketPrice, updatedAt: now }
                });
            }
        }

        return rates;
    } catch (e) {
        console.error('[ExchangeRates] Force refresh failed:', e);
        return getExchangeRates(); // Fall back to normal fetch
    }
}
