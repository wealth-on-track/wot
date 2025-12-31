"use server";

import { searchYahoo } from "@/services/yahooApi";
import { getTefasFundInfo } from "@/services/tefasApi";
import { SymbolOption, getCountryFromExchange, getExchangeName } from "@/lib/symbolSearch";
import { cleanAssetName } from "@/lib/companyNames";

export async function searchSymbolsAction(query: string): Promise<SymbolOption[]> {
    if (!query || query.length < 2) return [];

    const results = await searchYahoo(query);

    // Map first to easily check types
    const mappedResults: SymbolOption[] = results
        .filter(item => !isCurrencyPair(item.symbol)) // Filter out FOREX pairs
        .map(item => ({
            symbol: item.symbol,
            fullName: cleanAssetName(item.shortname || item.longname || item.symbol),
            exchange: getExchangeName(item.exchange),
            type: mapYahooType(item.quoteType),
            currency: getCurrencyFromExchange(item.exchange),
            country: getCountryFromExchange(item.exchange),
            // Keep raw name for filtering
            rawName: (item.shortname || item.longname || item.symbol).toUpperCase()
        }));

    // Inject CASH option if query matches a supported currency
    const upperQuery = query.toLocaleUpperCase('tr-TR');
    const currencies = ["USD", "EUR", "TRY", "GBP", "JPY", "AUD", "CAD", "CHF", "CNY"];

    // Check if query is a currency code
    if (currencies.includes(upperQuery)) {
        const cashOption: SymbolOption = {
            symbol: upperQuery,
            fullName: `${upperQuery} - Cash`,
            exchange: 'Forex',
            type: 'CASH', // Custom type
            currency: upperQuery,
            country: 'Global', // Or lookup based on currency
            rawName: `${upperQuery} CASH`
        };
        // Prepend to results
        mappedResults.unshift(cashOption);
    }

    // GRAM GOLD / ALTIN Special Handling
    const gramKeywords = ["GRAM", "ALTIN", "GOLD", "GAU", "XAU", "GAUTRY", "XAUTRY"];
    // Check if query is in keyword OR keyword starts with query (partial match)
    if (gramKeywords.some(k => upperQuery.includes(k) || k.startsWith(upperQuery))) {
        // Add Gram Gold option
        mappedResults.unshift({
            symbol: 'GAUTRY',
            fullName: 'GR Altın',
            exchange: 'Forex',
            type: 'GOLD',
            currency: 'TRY',
            country: 'Turkey',
            rawName: 'GR ALTIN'
        });
    }

    // SILVER / GÜMÜŞ Special Handling
    const silverKeywords = ["GUMUS", "GÜMÜŞ", "SILVER", "XAG", "XAGTRY"];
    if (silverKeywords.some(k => upperQuery.includes(k) || k.startsWith(upperQuery))) {
        mappedResults.unshift({
            symbol: 'XAGTRY',
            fullName: 'GR Gümüş',
            exchange: 'Forex',
            type: 'COMMODITY',
            currency: 'TRY',
            country: 'Turkey',
            rawName: 'GR GUMUS'
        });
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
                mappedResults.unshift({
                    symbol: tefasFund.code,
                    fullName: tefasFund.title,
                    exchange: 'TEFAS',
                    type: 'FUND',
                    currency: 'TRY',
                    country: 'Turkey',
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

    if (hasStrongEquityMatch) {
        return mappedResults.filter(r => {
            // Always keep stocks and special types
            if (r.type === 'STOCK' || r.type === 'GOLD' || r.type === 'COMMODITY' || r.type === 'CASH' || r.exchange === 'TEFAS') return true;

            // For others (ETF, FUND), exclude if they are likely just tracking the equity
            // e.g. "YieldMax NVDA Option...", "GraniteShares 3x Long NVIDIA"
            // We keep them ONLY if their symbol matches the query (unlikely for derivatives but safe)
            if (r.symbol.toUpperCase() === queryUpper) return true;

            // Otherwise exclude
            return false;
        }).map(({ rawName, ...rest }) => rest);
    }

    return mappedResults.map(({ rawName, ...rest }) => rest);
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
 * Determine currency based on exchange
 * BIST (Borsa Istanbul) stocks are in TRY
 * Most others default to USD
 */
function getCurrencyFromExchange(exchange?: string): string {
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

function mapYahooType(type?: string): 'STOCK' | 'CRYPTO' | 'GOLD' | 'BOND' | 'FUND' | 'ETF' | 'CASH' {
    if (!type) return 'STOCK';
    const t = type.toUpperCase();
    if (t === 'CRYPTOCURRENCY') return 'CRYPTO';
    if (t === 'ETF') return 'ETF';
    if (t === 'MUTUALFUND') return 'FUND';
    if (t === 'FUTURE') return 'GOLD'; // Close enough for XAU
    if (t === 'EQUITY') return 'STOCK';
    return 'STOCK';
}
