"use server";

import { searchYahoo } from "@/services/yahooApi";
import { getTefasFundInfo } from "@/services/tefasApi";
import { SymbolOption, getCountryFromExchange, getExchangeName } from "@/lib/symbolSearch";
import { cleanAssetName } from "@/lib/companyNames";
import { trackActivity } from "@/services/telemetry";
import { auth } from "@/auth";
import { getAssetCategory, categoryToLegacyType } from "@/lib/assetCategories";

export async function searchSymbolsAction(query: string): Promise<SymbolOption[]> {
    if (!query || query.length < 2) return [];

    const startTime = Date.now();
    const session = await auth();

    const results = await searchYahoo(query);

    // Map first to easily check types
    const mappedResults: SymbolOption[] = results
        // NOTE: We NO LONGER filter out currency pairs - FX is now a valid category!
        .map(item => {
            const assetType = mapYahooType(item.quoteType);
            const exchangeCountry = getCountryFromExchange(item.exchange);
            let exchange = getExchangeName(item.exchange);

            // Determine category based on type + exchange
            const category = getAssetCategory(assetType, exchange, item.symbol);

            // SYSTEMATIC FIX: Crypto assets always have "Crypto" exchange
            if (category === 'CRYPTO') {
                exchange = 'Crypto';
            }

            return {
                symbol: item.symbol,
                fullName: cleanAssetName(item.shortname || item.longname || item.symbol),
                exchange,
                category,  // NEW: 8-category system
                type: assetType,
                currency: getCurrencyFromExchange(item.exchange, item.symbol, assetType),
                // Rule 1: Use API data if available, otherwise enrich
                country: exchangeCountry || getCountryFromType(assetType, item.symbol),
                sector: getSectorFromType(assetType),
                source: 'YAHOO' as const,
                // Keep raw name for filtering
                rawName: (item.shortname || item.longname || item.symbol).toUpperCase()
            };
        });

    // Inject CASH option if query matches a supported currency
    const upperQuery = query.toLocaleUpperCase('tr-TR');
    const currencies = ["USD", "EUR", "TRY", "GBP", "JPY", "AUD", "CAD", "CHF", "CNY"];

    // Determine which currencies to suggest as CASH options
    let targetCurrencies: string[] = [];
    const exactMatch = currencies.find(c => c === upperQuery);
    const specificCashMatch = currencies.find(c => upperQuery.includes(c) && (upperQuery.includes("CASH") || upperQuery.includes("NAKIT")));

    if (exactMatch) {
        targetCurrencies = [exactMatch];
    } else if (specificCashMatch) {
        targetCurrencies = [specificCashMatch];
    } else if (upperQuery.includes("CASH") || upperQuery.includes("NAKIT")) {
        targetCurrencies = currencies;
    }

    if (targetCurrencies.length > 0) {
        const cashType = 'CASH' as const;
        const cashOptions: SymbolOption[] = targetCurrencies.map(curr => ({
            symbol: curr,
            fullName: `${curr} - Cash`,
            exchange: 'Forex',
            category: 'CASH',  // NEW: 8-category system
            type: cashType,
            currency: curr,
            country: getCountryFromType(cashType, curr),
            sector: getSectorFromType(cashType),
            source: 'MANUAL' as const,
            rawName: `${curr} CASH`
        }));
        // Prepend to results
        mappedResults.unshift(...cashOptions);
    }

    // GRAM GOLD / ALTIN Special Handling
    const gramKeywords = ["GRAM", "ALTIN", "GOLD", "GAU", "XAU", "GAUTRY", "XAUTRY"];
    // Check if query is in keyword OR keyword starts with query (partial match)
    if (gramKeywords.some(k => upperQuery.includes(k) || k.startsWith(upperQuery))) {
        // Add Gram Gold option
        // GAUTRY = Gram Gold in TRY (Turkish Lira per gram)
        const goldType = 'GOLD' as const;
        mappedResults.unshift({
            symbol: 'GAUTRY',
            fullName: 'GR Altın',
            exchange: 'Commodity',  // Default exchange for commodities
            category: 'COMMODITIES',
            type: goldType,
            currency: 'TRY',  // Priced in Turkish Lira
            country: 'Global',  // All commodities are Global
            sector: 'Commodity',
            source: 'MANUAL' as const,
            rawName: 'GR ALTIN'
        });
    }

    // SILVER / GÜMÜŞ Special Handling
    const silverKeywords = ["GUMUS", "GÜMÜŞ", "SILVER", "XAG", "XAGTRY"];
    if (silverKeywords.some(k => upperQuery.includes(k) || k.startsWith(upperQuery))) {
        const silverType = 'COMMODITY' as const;
        mappedResults.unshift({
            symbol: 'XAGTRY',
            fullName: 'GR Gümüş',
            exchange: 'Commodity',  // Default exchange for commodities
            category: 'COMMODITIES',
            type: silverType,
            currency: 'TRY',  // Priced in Turkish Lira
            country: 'Global',  // All commodities are Global
            sector: 'Commodity',
            source: 'MANUAL' as const,
            rawName: 'GR GUMUS'
        });
    }

    // PLATINUM / PLATİN Special Handling
    const platinumKeywords = ["PLATIN", "PLATİN", "PLATINUM", "XPT", "XPTTRY", "XPTGTRY", "XPT-TRY", "XPTG-TRY", "PLTTRY"];
    const shouldInjectPlatinum = platinumKeywords.some(k => upperQuery.includes(k) || k.startsWith(upperQuery));
    if (shouldInjectPlatinum) {
        const platinumType = 'COMMODITY' as const;
        mappedResults.unshift({
            symbol: 'XPTTRY',
            fullName: 'GR Platin',
            exchange: 'Commodity',  // Default exchange for commodities
            category: 'COMMODITIES',
            type: platinumType,
            currency: 'TRY',  // Priced in Turkish Lira (from Investing.com spot)
            country: 'Global',  // All commodities are Global
            sector: 'Commodity',
            source: 'INVESTING' as const,  // Sourced from Investing.com
            rawName: 'GR PLATIN'
        });
    }

    // FX / Currency Pair Special Handling
    // Check if query looks like a currency pair (EURUSD, EUR USD, EUR/USD)
    const fxKeywords = ["EUR", "USD", "TRY", "GBP", "JPY", "CHF", "CAD", "AUD"];
    const queryNormalized = upperQuery.replace(/[\/\s-]/g, ''); // Remove separators

    // Check if query matches currency pair patterns
    for (const curr1 of fxKeywords) {
        for (const curr2 of fxKeywords) {
            if (curr1 !== curr2 && queryNormalized.includes(curr1 + curr2)) {
                // Add FX pair option
                const pairSymbol = `${curr1}${curr2}=X`;
                const fxType = 'CURRENCY' as const;
                mappedResults.unshift({
                    symbol: pairSymbol,
                    fullName: `${curr1}/${curr2}`,
                    exchange: 'Forex',
                    category: 'FX',  // NEW: FX category
                    type: fxType,
                    currency: curr1,  // Base currency
                    country: 'Global',
                    sector: 'Currency',
                    source: 'MANUAL' as const,
                    rawName: `${curr1}${curr2}`
                });
            }
        }
    }

    // Check for TEFAS Fund (if query is 3 letters)
    if (upperQuery.length === 3) {
        // Try fetching it to see if it exists
        // Note: This makes the search slower for 3 letter queries, but it's necessary since we don't have a DB
        // We run it in parallel with other logic if possible, but here we just await or fire and forget?
        // Let's await it to be sure.
        try {
            const tefasFund = await getTefasFundInfo(upperQuery);
            if (tefasFund) {
                const fundType = 'FUND' as const;
                mappedResults.unshift({
                    symbol: tefasFund.code,
                    fullName: tefasFund.title,
                    exchange: 'TEFAS',
                    category: 'TEFAS',  // NEW: 8-category system
                    type: fundType,
                    currency: 'TRY',
                    country: 'Turkey',  // Rule 2b: TEFAS is always Turkey
                    sector: getSectorFromType(fundType),
                    source: 'TEFAS' as const,
                    rawName: tefasFund.title.toUpperCase()
                });
            }
        } catch (e) {
            // ignore
        }
    }

    // Heuristic Filtering:
    // If we have a "Strong Equity Match" (Stock where symbol or name includes query),
    // we filter out derivative ETFs/Funds that just have the query in their name.

    const queryUpper = query.toLocaleUpperCase('tr-TR');
    const hasStrongEquityMatch = mappedResults.some(r =>
        r.type === 'STOCK' &&
        (r.symbol.toUpperCase().startsWith(queryUpper) || (r.rawName || '').startsWith(queryUpper))
    );

    const finalResults = hasStrongEquityMatch
        ? mappedResults.filter(r => {
            // Always keep stocks and special types
            if (r.type === 'STOCK' || r.type === 'GOLD' || r.type === 'COMMODITY' || r.type === 'CASH' || r.exchange === 'TEFAS') return true;

            // For others (ETF, FUND), exclude if they are likely just tracking the equity
            // e.g. "YieldMax NVDA Option...", "GraniteShares 3x Long NVIDIA"
            // We keep them ONLY if their symbol matches the query (unlikely for derivatives but safe)
            if (r.symbol.toUpperCase() === queryUpper) return true;

            // Otherwise exclude
            return false;
        }).map(({ rawName, ...rest }) => rest)
        : mappedResults.map(({ rawName, ...rest }) => rest);

    // Track search activity
    const duration = Date.now() - startTime;
    await trackActivity('SEARCH', 'QUERY', {
        userId: session?.user?.id,
        username: session?.user?.name || undefined,
        details: {
            query,
            resultsCount: finalResults.length,
            sources: Array.from(new Set(mappedResults.map(r => r.source).filter(Boolean)))
        },
        duration
    });

    return finalResults;
}

/**
 * Look up a single TEFAS fund by code
 * Returns fund info with name and current price
 */
export async function lookupTefasFund(code: string): Promise<{ code: string; name: string; price: number } | null> {
    if (!code || code.length < 2 || code.length > 4) return null;

    try {
        const tefasFund = await getTefasFundInfo(code.toUpperCase().trim());
        if (tefasFund) {
            return {
                code: tefasFund.code,
                name: tefasFund.title,
                price: tefasFund.price
            };
        }
        return null;
    } catch (e) {
        console.error('TEFAS lookup error:', e);
        return null;
    }
}

/**
 * Check if a symbol is a currency pair (FOREX)
 * Currency pairs are not investable assets, just exchange rates
 * Examples: EUR/TRY, USD/TRY, EUR/USD, GBP/USD
 */
function isCurrencyPair(symbol: string): boolean {
    if (!symbol) return false;

    const s = symbol.toUpperCase();

    // Common currency codes
    const currencies = ['USD', 'EUR', 'TRY', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'CNY', 'INR', 'RUB', 'BRL', 'ZAR'];

    // Check for patterns like EURTRY=X, EUR/TRY, EURUSD, etc.
    if (s.includes('/')) return true;
    if (s.includes('=X')) return true;

    // Check if symbol is exactly two currency codes concatenated (e.g., EURTRY, USDTRY)
    for (const curr1 of currencies) {
        for (const curr2 of currencies) {
            if (curr1 !== curr2 && s === curr1 + curr2) return true;
        }
    }

    return false;
}

/**
 * Determine currency based on exchange, symbol, and type
 * BIST (Borsa Istanbul) stocks are in TRY
 * Crypto pairs extract quote currency from symbol
 * Most others default to USD
 */
function getCurrencyFromExchange(exchange?: string, symbol?: string, type?: string): string {
    // CRYPTO: Extract quote currency from symbol (BTC-EUR -> EUR, XRP-GBP -> GBP)
    if (type === 'CRYPTO' && symbol && symbol.includes('-')) {
        const parts = symbol.split('-');
        if (parts.length === 2) {
            return parts[1]; // Quote currency (USD, EUR, GBP, etc.)
        }
    }

    if (!exchange) return 'USD';

    const ex = exchange.toUpperCase();

    // Turkish exchanges
    if (ex.includes('IST') || ex.includes('BIST')) return 'TRY';

    // European exchanges
    if (ex.includes('PAR') || ex.includes('FRA') || ex.includes('AMS') ||
        ex.includes('MIL') || ex.includes('MAD') || ex.includes('LIS')) return 'EUR';

    // UK
    if (ex.includes('LON') || ex.includes('LSE')) return 'GBP';

    // Default to USD for US and other exchanges
    return 'USD';
}

function mapYahooType(type?: string): 'STOCK' | 'CRYPTO' | 'GOLD' | 'BOND' | 'FUND' | 'ETF' | 'CASH' | 'COMMODITY' {
    if (!type) return 'STOCK';
    const t = type.toUpperCase();
    if (t === 'CRYPTOCURRENCY') return 'CRYPTO';
    if (t === 'ETF') return 'FUND';  // Map ETF to FUND for AssetSchema compatibility
    if (t === 'MUTUALFUND') return 'FUND';
    if (t === 'FUTURE') return 'GOLD'; // Close enough for XAU
    if (t === 'EQUITY') return 'STOCK';
    return 'STOCK';
}

/**
 * Enrichment Layer: Fill missing metadata based on asset type
 * RULE: Only enrich if API returns blank/null/undefined
 * This is the ONLY place where type-based rules are applied
 */
function getSectorFromType(type: 'STOCK' | 'CRYPTO' | 'GOLD' | 'BOND' | 'FUND' | 'ETF' | 'CASH' | 'COMMODITY'): string {
    switch (type) {
        case 'CASH':
            return 'Cash';              // Rule 2a
        case 'CRYPTO':
            return 'Crypto';            // Rule 2c
        case 'GOLD':
        case 'COMMODITY':
            return 'Commodity';         // Rule 2d
        case 'FUND':
            return 'Fund';              // Rule 2b (TEFAS handled separately)
        case 'ETF':
            return 'ETF';
        case 'BOND':
            return 'Bond';
        case 'STOCK':
        default:
            return 'UNKNOWN';           // No enrichment for stocks
    }
}

/**
 * Enrichment Layer: Fill missing country based on asset type
 * RULE: Only enrich if API/exchange lookup returns undefined
 */
function getCountryFromType(type: 'STOCK' | 'CRYPTO' | 'GOLD' | 'BOND' | 'FUND' | 'ETF' | 'CASH' | 'COMMODITY', symbol?: string): string {
    switch (type) {
        case 'CASH':
            // Rule 2a: Cash country based on currency code
            if (symbol === 'EUR') return 'Europe';
            if (symbol === 'USD') return 'USA';
            if (symbol === 'TRY') return 'Turkey';
            if (symbol === 'GBP') return 'United Kingdom';
            return 'Global';
        case 'CRYPTO':
            return 'Global';            // Rule 2c
        case 'GOLD':
        case 'COMMODITY':
            // ALL COMMODITIES are Global (including GAUTRY, XAGTRY)
            // Even Turkish gram gold/silver are Global because they track global metal prices
            return 'Global';
        case 'STOCK':
        case 'ETF':
        case 'BOND':
        case 'FUND':
        default:
            return 'UNKNOWN';           // No enrichment
    }
}
