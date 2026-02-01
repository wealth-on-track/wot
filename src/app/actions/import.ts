"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { searchYahoo, getYahooQuote, getYahooAssetProfile } from "@/services/yahooApi";
import { getCompanyProfile } from "@/services/finnhubApi";
import { getCompanyOverview } from "@/services/alphaVantageApi";
import { getLogoUrl } from "@/lib/logos";
import { getAssetCategory, getCategoryDefaults } from "@/lib/assetCategories";
import { getTefasFundInfo } from "@/services/tefasApi";
import { trackActivity } from "@/services/telemetry";
import { cleanAssetName } from "@/lib/companyNames";
import { getExchangeRates } from "@/lib/exchangeRates";
import { CRYPTO_ASSET_NAMES } from "@/lib/cryptoNames";

/**
 * CRYPTO RESOLUTION - STRUCTURAL DESIGN
 * =====================================
 * Cryptocurrencies on Yahoo Finance use SYMBOL-CURRENCY format (e.g., XRP-EUR, BTC-USD)
 * Unlike stocks, searching just "XRP" returns ETFs like "Bitwise XRP ETF" instead of the actual crypto.
 *
 * Solution:
 * 1. Maintain a list of known crypto symbols
 * 2. When resolving crypto assets, search with -EUR suffix
 * 3. Prefer quoteType='CRYPTOCURRENCY' in results
 */
const KNOWN_CRYPTO_SYMBOLS = new Set([
    // Major Cryptos
    'BTC', 'ETH', 'XRP', 'SOL', 'ADA', 'DOGE', 'DOT', 'MATIC', 'AVAX', 'LINK',
    'ATOM', 'UNI', 'LTC', 'BCH', 'XLM', 'ALGO', 'VET', 'FIL', 'AAVE', 'EOS',
    'XTZ', 'THETA', 'XMR', 'NEO', 'MKR', 'COMP', 'SNX', 'YFI', 'SUSHI', 'CRV',
    'ENJ', 'MANA', 'SAND', 'AXS', 'GALA', 'CHZ', 'BAT', 'ZRX', 'LRC', 'IMX',
    'APE', 'SHIB', 'PEPE', 'NEAR', 'ICP', 'APT', 'ARB', 'OP', 'SUI', 'SEI',
    // Stablecoins (usually not imported, but included for completeness)
    'USDT', 'USDC', 'DAI', 'BUSD',
    // Additional common cryptos
    'TRX', 'ETC', 'HBAR', 'QNT', 'EGLD', 'FTM', 'KAVA', 'ROSE', 'ZEC', 'DASH',
    'KSM', 'FLOW', 'MINA', 'CELO', 'ONE', 'ANKR', 'STORJ', 'GRT', 'OCEAN', 'REN',
]);

// Map full crypto names to their base symbol (used in getCryptoTicker)
const CRYPTO_NAME_TO_SYMBOL: Record<string, string> = {
    'BITCOIN': 'BTC',
    'ETHEREUM': 'ETH',
    'XRP': 'XRP',
    'RIPPLE': 'XRP',
    'SOLANA': 'SOL',
    'CARDANO': 'ADA',
    'DOGECOIN': 'DOGE',
    'POLKADOT': 'DOT',
    'POLYGON': 'MATIC',
    'AVALANCHE': 'AVAX',
    'CHAINLINK': 'LINK',
    'COSMOS': 'ATOM',
    'UNISWAP': 'UNI',
    'LITECOIN': 'LTC',
    'STELLAR': 'XLM',
    'ALGORAND': 'ALGO',
    'FILECOIN': 'FIL',
    'TEZOS': 'XTZ',
    'MONERO': 'XMR',
    'NEAR PROTOCOL': 'NEAR',
    'APTOS': 'APT',
    'ARBITRUM': 'ARB',
    'OPTIMISM': 'OP',
    'SUI': 'SUI',
    'PEPE': 'PEPE',
    'SHIBA INU': 'SHIB',
};

/**
 * Check if an asset is a cryptocurrency
 * Checks: type, symbol, name, and ISIN pattern (XFC prefix = crypto)
 */
function isCryptoSymbol(symbol: string, type?: string, name?: string, isin?: string): boolean {
    if (type === 'CRYPTO') return true;

    // XFC prefix in ISIN indicates crypto (common pattern)
    if (isin && isin.toUpperCase().startsWith('XFC')) return true;

    const clean = symbol.toUpperCase().replace(/[-.].*$/, '');
    if (KNOWN_CRYPTO_SYMBOLS.has(clean)) return true;

    // Check full name
    const upperName = (name || '').toUpperCase();
    if (CRYPTO_NAME_TO_SYMBOL[upperName]) return true;

    // Check if name contains known crypto keywords
    const cryptoKeywords = ['BITCOIN', 'ETHEREUM', 'CRYPTO', 'COIN'];
    if (cryptoKeywords.some(kw => upperName.includes(kw))) return true;

    return false;
}

/**
 * Get the correct Yahoo ticker for a crypto asset
 * Uses the currency from CSV to determine the correct variant (e.g., BTC-EUR vs BTC-USD)
 */
function getCryptoTicker(symbol: string, name?: string, currency?: string): string {
    // Determine target currency suffix (default to EUR for European users)
    const targetCurrency = (currency || 'EUR').toUpperCase();
    const upperName = (name || '').toUpperCase();

    // Extract base symbol from name mapping or symbol itself
    let baseSymbol: string;

    if (CRYPTO_NAME_TO_SYMBOL[upperName]) {
        baseSymbol = CRYPTO_NAME_TO_SYMBOL[upperName];
    } else {
        // Try to extract from symbol (remove any existing suffix like -EUR, -USD)
        baseSymbol = symbol.toUpperCase().replace(/[-.].*$/, '');
    }

    // Return with target currency suffix
    return `${baseSymbol}-${targetCurrency}`;
}

// Helper: Calculate Jaccard Similarity between two strings with Strict Stopword Filtering
// This prevents "WisdomTree Nasdaq" matching "WisdomTree Silver" just because they share "WisdomTree".
function calculateSimilarity(name1: string, name2: string): number {
    if (!name1 || !name2) return 0;

    // Stopwords to ignore (Generic financial terms that dilute similarity)
    const STOPWORDS = new Set([
        'INC', 'LTD', 'PLC', 'CORP', 'AG', 'SE', 'SA', 'NV', 'B', 'V', 'GMBH', 'COMPANY', 'LIMITED', // Legal Entities
        'ETF', 'UCITS', 'FUND', 'TRUST', 'REIT', 'ETC', 'ETN', // Asset Types
        'USD', 'EUR', 'GBP', 'TRY', 'CAD', 'AUD', 'JPY', // Currencies
        'CLASS', 'SERIES', 'ACC', 'DIST', 'HEDGED', 'DAILY', // Variants
        'GROUP', 'HOLDINGS', 'HOLDING', 'PARTNERS', 'CAPITAL', 'FINANCIAL', 'SOLUTIONS', // Corporate generic
        'GLOBAL', 'INTERNATIONAL', 'PHYSICAL' // Descriptors (Physical is key for Silver vs Physical Silver logic)
    ]);

    // Tokenize: Upper case, remove non-alphanumeric, split by space, remove short/stopwords
    const tokenize = (s: string) => s.toUpperCase()
        .replace(/[^A-Z0-9]/g, ' ')
        .split(/\s+/)
        .filter(x => x.length > 1 && !STOPWORDS.has(x));

    const set1 = new Set(tokenize(name1));
    const set2 = new Set(tokenize(name2));

    // DEBUG LOGGING
    console.log(`[DEBUG_SIM] '${name1}' vs '${name2}'`);
    console.log(`[DEBUG_SIM] Tokens1: ${JSON.stringify([...set1])}`);
    console.log(`[DEBUG_SIM] Tokens2: ${JSON.stringify([...set2])}`);

    if (set1.size === 0 || set2.size === 0) return 0;

    let intersection = 0;
    set1.forEach(t => { if (set2.has(t)) intersection++; });

    // Jaccard Index = Intersection / Union
    const union = set1.size + set2.size - intersection;
    const score = union > 0 ? intersection / union : 0;

    console.log(`[DEBUG_SIM] Score: ${score.toFixed(3)} (Int: ${intersection}, Union: ${union})`);
    return score;
}

export interface ImportAsset {
    symbol: string;
    isin?: string;
    name?: string;
    quantity: number;
    buyPrice: number;
    currency: 'USD' | 'EUR' | 'TRY';
    type?: string;
    platform?: string;
    exchange?: string;  // Exchange from CSV (e.g., "Reference Exchange" in Degiro)
}

export interface ResolvedAsset extends ImportAsset {
    resolvedSymbol: string;
    resolvedName: string;
    resolvedType: string;
    resolvedCurrency: string;
    exchange?: string;
    country?: string;
    sector?: string;
    category?: string; // Asset category (BIST, TEFAS, US_MARKETS, etc.)
    currentPrice?: number;
    confidence: number;
    logoUrl?: string;
    matchSource?: 'MEMORY' | 'ISIN' | 'SEARCH' | 'NONE'; // Expose verification method
    existingAsset?: {
        id: string;
        quantity: number;
        buyPrice: number;
    };
    action: 'add' | 'update' | 'skip' | 'close';
    warnings?: string[];
}




export interface ResolveResult {
    success: boolean;
    resolved: ResolvedAsset[];
    errors: string[];
}

/**
 * Resolve symbols using Yahoo API and check for existing assets
 */
/**
 * Resolve symbols using the "Three-Tier" Architecture:
 * 0. Canonical Truth: Check Shared Crypto Names (100% confidence, forces correct naming)
 * 1. Memory: Check AssetAlias table (100% confidence)
 * 2. Gold Standard: Check ISIN search (99% confidence)
 * 3. Discovery: Check Ticker/Name search with Strict Validation (40-95% confidence)
 */
export async function resolveImportSymbols(assets: ImportAsset[]): Promise<ResolveResult> {
    const session = await auth();
    if (!session?.user?.id) { // explicit ID check
        return { success: false, resolved: [], errors: ['Not authenticated'] };
    }
    const userId = session.user.id;

    // Get user's existing assets for Poison Link Detection
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            portfolio: {
                include: { assets: true }
            }
        }
    });

    if (!user?.portfolio) {
        return { success: false, resolved: [], errors: ['Portfolio not found'] };
    }

    const existingAssets = user.portfolio.assets;

    // SIMPLE & CORRECT: Build lookup maps from EXISTING ASSETS in database
    // No need for separate AssetAlias table - we already have the data!
    const isinToSymbol = new Map<string, string>();  // ISIN → Symbol (e.g., "US0378331005" → "AAPL")
    const nameToSymbol = new Map<string, string>();  // Name → Symbol (e.g., "APPLE INC" → "AAPL")
    const existingSymbols = new Map<string, any>();  // Symbol → Asset (for update detection)

    existingAssets.forEach((a: any) => {
        const symbol = a.symbol.toUpperCase();
        existingSymbols.set(symbol, a);

        // Map ISIN to symbol
        if (a.isin) {
            isinToSymbol.set(a.isin.toUpperCase(), symbol);
        }

        // Map name to symbol (use originalName if available, otherwise name)
        const assetName = (a.originalName || a.name || '').trim().toUpperCase();
        if (assetName) {
            nameToSymbol.set(assetName, symbol);
        }
    });

    console.log(`[Import] Built lookup from ${existingAssets.length} existing assets:`);
    console.log(`[Import]   - ISIN mappings: ${isinToSymbol.size}`);
    console.log(`[Import]   - Name mappings: ${nameToSymbol.size}`);

    // Fetch user's AssetAlias table for MEMORY lookups (saves Yahoo API calls)
    const aliasMap = new Map<string, string>();
    try {
        const aliases = await (prisma as any).assetAlias.findMany({
            where: { userId }
        });
        for (const alias of aliases) {
            aliasMap.set(alias.sourceString.toUpperCase(), alias.resolvedSymbol);
        }
        console.log(`[Import]   - Alias mappings: ${aliasMap.size}`);
    } catch (e) {
        console.warn('[Import] Failed to fetch AssetAlias table (may not exist yet):', e);
    }

    console.log(`[Import Debug] Starting resolution for ${assets.length} assets. User: ${userId}`);

    let rates: Record<string, number> = { EUR: 1, USD: 1.05, TRY: 35 }; // Default fallbacks
    try {
        rates = await getExchangeRates();
    } catch (e) {
        console.warn('[Import Debug] Failed to fetch exchange rates, using defaults', e);
    }
    const resolved: ResolvedAsset[] = [];
    const errors: string[] = [];

    // Process in parallel batches (faster, with rate limit protection)
    const batchSize = 5; // Process 5 at a time
    for (let i = 0; i < assets.length; i += batchSize) {
        const batch = assets.slice(i, i + batchSize);
        // Shorter delay between batches
        if (i > 0) await new Promise(r => setTimeout(r, 200));

        const batchResults = await Promise.all(
            batch.map(async (asset): Promise<ResolvedAsset> => {
                let confidence = 0;
                let resolvedAssetWarnings: string[] = [];
                let resolvedSymbol = asset.symbol;
                let resolvedName = asset.name || asset.symbol;
                let resolvedType = asset.type || 'STOCK';
                let resolvedCurrency = asset.currency;
                // Use CSV exchange first, API will only override if CSV is empty
                let exchange: string | undefined = asset.exchange;
                let country: string | undefined;
                let sector: string | undefined;
                let currentPrice: number | undefined;
                let logoUrl: string | undefined;
                let matchSource: 'MEMORY' | 'ISIN' | 'SEARCH' | 'NONE' = 'NONE';

                console.log(`[Import Debug] Processing Asset ${i}: symbol='${asset.symbol}' name='${asset.name}' isin='${asset.isin}'`);

                try {
                    // --- LEVEL 0: CANONICAL TRUTH (Hardcoded Known Assets) ---
                    // Force correct names for known crypto tickers (e.g. BTC -> Bitcoin)
                    // regardless of what CSV or external APIs say.
                    const canonicalName = CRYPTO_ASSET_NAMES[asset.symbol.toUpperCase()];
                    if (canonicalName) {
                        console.log(`[Import] ✓ CANONICAL HIT: '${asset.symbol}' -> '${canonicalName}'`);
                        // We trust our own canonical list 100%
                        matchSource = 'MEMORY';
                        confidence = 100;
                        resolvedName = canonicalName;
                        resolvedType = 'CRYPTO';

                        // Build the currency-paired ticker (e.g. BTC-EUR)
                        const baseSymbol = asset.symbol.toUpperCase();
                        const targetCurrency = asset.currency || 'EUR';
                        // Check if it already has a suffix
                        const needsSuffix = !baseSymbol.includes('-');
                        // IMPORTANT: Use currency-paired symbol for proper logo resolution and price fetching
                        resolvedSymbol = needsSuffix ? `${baseSymbol}-${targetCurrency}` : baseSymbol;

                        // Fetch the price using the currency-paired ticker
                        const quote = await getYahooQuote(resolvedSymbol) as any;
                        if (quote) {
                            resolvedCurrency = (quote.currency || resolvedCurrency) as any;
                            currentPrice = quote.regularMarketPrice;
                            exchange = exchange || quote.exchange || 'CCC';
                        }
                    }
                    else {
                        // --- LEVEL 1: MEMORY (The System's Brain) ---
                        // CRITICAL: Normalize lookup key - trim whitespace and uppercase
                        const inputName = (asset.name || asset.symbol).trim().toUpperCase();

                        // DEBUG: Show exact key being looked up
                        console.log(`[Import] MEMORY lookup: key='${inputName}', found=${aliasMap.has(inputName)}`);

                        if (aliasMap.has(inputName)) {
                            resolvedSymbol = aliasMap.get(inputName) || asset.symbol;
                            console.log(`[Import] ✓ MEMORY HIT: '${inputName}' -> '${resolvedSymbol}'`);

                            // We trust the memory 100%. Fetch quote directly.
                            matchSource = 'MEMORY';
                            confidence = 100;
                            const quote = await getYahooQuote(resolvedSymbol) as any;
                            if (quote) {
                                resolvedName = cleanAssetName(quote.shortname || quote.longname || resolvedName);
                                resolvedCurrency = (quote.currency || asset.currency) as any;
                                currentPrice = quote.regularMarketPrice;
                                resolvedType = quote.quoteType === 'ETF' ? 'FUND' :
                                    quote.quoteType === 'CRYPTOCURRENCY' ? 'CRYPTO' : 'STOCK';
                                exchange = exchange || quote.exchange; // CSV first, then API
                            }
                        }
                        else {
                            // --- LEVEL 2: TEFAS RESOLUTION (Turkish Mutual Funds) ---
                            // Check if this is a TEFAS fund before going to Yahoo
                            const isTefas = (
                                asset.type === 'TEFAS' ||
                                asset.type === 'FON' ||
                                asset.exchange?.toUpperCase() === 'TEFAS' ||
                                (asset.isin && asset.isin.startsWith('TR') && (asset.type === 'FUND' || asset.type === 'ETF'))
                            );

                            if (isTefas) {
                                console.log(`[Import] TEFAS detected: ${asset.symbol} - fetching from TEFAS API`);
                                const tefasInfo = await getTefasFundInfo(asset.symbol);

                                if (tefasInfo) {
                                    matchSource = 'SEARCH';
                                    confidence = 100; // TEFAS API is authoritative
                                    resolvedSymbol = tefasInfo.code;
                                    resolvedName = tefasInfo.title || asset.name || asset.symbol;
                                    resolvedType = 'TEFAS';
                                    resolvedCurrency = 'TRY' as any;
                                    currentPrice = tefasInfo.price || undefined;
                                    exchange = 'TEFAS';
                                    country = 'Turkey';
                                    sector = 'Fund';
                                    console.log(`[Import] TEFAS resolved: ${asset.symbol} -> ${resolvedName} @ ${currentPrice} TRY`);
                                } else {
                                    // TEFAS API failed - still mark as TEFAS but with lower confidence
                                    matchSource = 'SEARCH';
                                    confidence = 70;
                                    resolvedSymbol = asset.symbol.toUpperCase();
                                    resolvedName = asset.name || asset.symbol;
                                    resolvedType = 'TEFAS';
                                    resolvedCurrency = 'TRY' as any;
                                    exchange = 'TEFAS';
                                    country = 'Turkey';
                                    sector = 'Fund';
                                    console.warn(`[Import] TEFAS API failed for ${asset.symbol}, using CSV data`);
                                }
                            }

                            // --- LEVEL 3 & 4: DISCOVERY (Yahoo API) ---
                            if (matchSource === 'NONE') {
                                console.log(`[Import] ✗ MEMORY MISS for '${inputName}' - going to Yahoo API`);
                            }

                            let searchResults: any[] = [];
                            let usedIsinSearch = false;
                            const isCrypto = isCryptoSymbol(asset.symbol, asset.type, asset.name, asset.isin);

                            // 2a. CRYPTO - Direct ticker lookup (skip ISIN search, use name-to-ticker mapping)
                            if (isCrypto) {
                                // Use currency from CSV to determine the correct variant (e.g., BTC-EUR vs BTC-USD)
                                const targetCurrency = asset.currency || 'EUR';
                                const cryptoTicker = getCryptoTicker(asset.symbol, asset.name, targetCurrency);
                                console.log(`[Import] Crypto detected: ${asset.name} (${targetCurrency}) -> trying ${cryptoTicker}`);

                                // Get quote directly for the crypto ticker
                                const quote = await getYahooQuote(cryptoTicker) as any;
                                if (quote && quote.regularMarketPrice) {
                                    matchSource = 'SEARCH';
                                    confidence = 99;
                                    resolvedSymbol = cryptoTicker;
                                    resolvedName = cleanAssetName(quote.shortname || quote.longname || asset.name || cryptoTicker);
                                    resolvedType = 'CRYPTO';
                                    resolvedCurrency = (quote.currency || targetCurrency) as any;
                                    currentPrice = quote.regularMarketPrice;
                                    exchange = exchange || quote.exchange || 'CCC'; // CSV first
                                    console.log(`[Import] Crypto resolved: ${asset.name} -> ${resolvedSymbol} @ ${currentPrice}`);
                                } else {
                                    // Fallback: search for BASE SYMBOL to get all currency variants
                                    // e.g., search "ETH" returns [ETH-USD, ETH-EUR, ETH-GBP, ...]
                                    const baseSymbol = cryptoTicker.split('-')[0]; // Extract base (ETH from ETH-EUR)
                                    searchResults = await searchYahoo(baseSymbol);
                                    const cryptoOnly = searchResults.filter(r => r.quoteType === 'CRYPTOCURRENCY');

                                    if (cryptoOnly.length > 0) {
                                        // SMART: Find the variant matching target currency from CSV
                                        const currencySuffix = `-${targetCurrency}`;
                                        const matchingVariant = cryptoOnly.find(r => r.symbol.toUpperCase().endsWith(currencySuffix));

                                        if (matchingVariant) {
                                            // Found matching currency variant - use it directly
                                            matchSource = 'SEARCH';
                                            confidence = 98;
                                            resolvedSymbol = matchingVariant.symbol;
                                            resolvedName = cleanAssetName(matchingVariant.shortname || matchingVariant.longname || asset.name || cryptoTicker);
                                            resolvedType = 'CRYPTO';
                                            resolvedCurrency = targetCurrency as any;
                                            exchange = exchange || matchingVariant.exchange || 'CCC'; // CSV first

                                            // Fetch current price
                                            const variantQuote = await getYahooQuote(matchingVariant.symbol) as any;
                                            if (variantQuote) {
                                                currentPrice = variantQuote.regularMarketPrice;
                                            }
                                            console.log(`[Import] Crypto ${targetCurrency} variant found via base search: ${asset.name} -> ${resolvedSymbol}`);
                                        } else {
                                            // Currency variant not found - construct it manually and try direct quote
                                            // e.g., If ETH-EUR not in search, but we want EUR, try ETH-EUR directly
                                            const constructedTicker = `${baseSymbol}-${targetCurrency}`;
                                            const directQuote = await getYahooQuote(constructedTicker) as any;
                                            if (directQuote && directQuote.regularMarketPrice) {
                                                matchSource = 'SEARCH';
                                                confidence = 95;
                                                resolvedSymbol = constructedTicker;
                                                resolvedName = cleanAssetName(directQuote.shortname || directQuote.longname || asset.name || constructedTicker);
                                                resolvedType = 'CRYPTO';
                                                resolvedCurrency = targetCurrency as any;
                                                currentPrice = directQuote.regularMarketPrice;
                                                exchange = exchange || directQuote.exchange || 'CCC'; // CSV first
                                                console.log(`[Import] Crypto ${targetCurrency} constructed: ${asset.name} -> ${resolvedSymbol}`);
                                            } else {
                                                // FINAL FALLBACK: Yahoo API failed completely
                                                // Still use the constructed ticker since we KNOW it's crypto from parser
                                                matchSource = 'SEARCH';
                                                confidence = 80; // Lower confidence but still import
                                                resolvedSymbol = constructedTicker;
                                                resolvedName = asset.name || constructedTicker;
                                                resolvedType = 'CRYPTO';
                                                resolvedCurrency = targetCurrency as any;
                                                exchange = 'CCC';
                                                console.warn(`[Import] Crypto API failed for ${baseSymbol}, using constructed ticker: ${constructedTicker}`);
                                            }
                                        }
                                    } else {
                                        // cryptoOnly is empty (no CRYPTOCURRENCY results from Yahoo search)
                                        // Still use the constructed ticker since parser confirmed this is crypto
                                        const constructedTicker = `${baseSymbol}-${targetCurrency}`;
                                        matchSource = 'SEARCH';
                                        confidence = 75; // Lower confidence - Yahoo had no crypto results
                                        resolvedSymbol = constructedTicker;
                                        resolvedName = asset.name || constructedTicker;
                                        resolvedType = 'CRYPTO';
                                        resolvedCurrency = targetCurrency as any;
                                        exchange = 'CCC';
                                        console.warn(`[Import] No crypto results from Yahoo for ${baseSymbol}, using constructed ticker: ${constructedTicker}`);
                                    }
                                }
                            }

                            // 2b. ISIN Search (Gold Standard) - only for non-crypto
                            if (!isCrypto && asset.isin && asset.isin.length > 5) {
                                searchResults = await searchYahoo(asset.isin);
                                usedIsinSearch = true;
                            }

                            // 2c. Ticker / Name Fallback (skip if already resolved)
                            if (matchSource === 'NONE' && searchResults.length === 0 && asset.symbol !== asset.isin) {
                                console.log(`[Import] Symbol !== ISIN. Searching symbol: ${asset.symbol}`);
                                searchResults = await searchYahoo(asset.symbol);
                                usedIsinSearch = false;
                            }
                            if (matchSource === 'NONE' && searchResults.length === 0 && asset.name) {
                                const cleanName = cleanAssetName(asset.name);
                                console.log(`[Import Debug] Fallback to Name Search: '${asset.name}' -> Clean: '${cleanName}'`);
                                searchResults = await searchYahoo(cleanName);
                                console.log(`[Import Debug] Name Search Results: ${searchResults.length}`);
                            }

                            // --- VALIDATION & SELECTION --- (skip if already resolved, e.g., crypto)
                            if (matchSource === 'NONE' && searchResults.length > 0) {
                                const best = searchResults[0];
                                const resultName = (best.shortname || best.longname || '').toUpperCase();
                                const similarity = calculateSimilarity(resultName, inputName);
                                console.log(`[Import] Checking Match: '${inputName}' vs '${resultName}' (Symbol: ${best.symbol}). Similarity: ${similarity.toFixed(2)}`);

                                // Global Strict Threshold
                                const threshold = 0.4;

                                // Auto-Check: Exact Symbol Match?
                                const exactSymbolMatch = searchResults.find(r =>
                                    r.symbol.toUpperCase() === asset.symbol.toUpperCase() ||
                                    (asset.isin && r.symbol.toUpperCase() === asset.isin.toUpperCase())
                                );

                                if (exactSymbolMatch) {
                                    // Direct Match (Level 3 - Precision)
                                    matchSource = 'SEARCH';
                                    confidence = 95;
                                    resolvedSymbol = exactSymbolMatch.symbol;
                                    resolvedName = cleanAssetName(exactSymbolMatch.shortname || exactSymbolMatch.longname || resolvedName);
                                    exchange = exchange || exactSymbolMatch.exchange; // CSV first
                                    // Update type from search result
                                    if (exactSymbolMatch.quoteType) {
                                        resolvedType = exactSymbolMatch.quoteType === 'ETF' ? 'FUND' :
                                            exactSymbolMatch.quoteType === 'CRYPTOCURRENCY' ? 'CRYPTO' :
                                                exactSymbolMatch.quoteType === 'MUTUALFUND' ? 'FUND' : 'STOCK';
                                    }
                                    // Fetch Price
                                    const quote = await getYahooQuote(resolvedSymbol);
                                    if (quote) currentPrice = quote.regularMarketPrice;
                                }
                                else if (similarity >= threshold || usedIsinSearch) {
                                    // Fuzzy Match (Level 4) OR ISIN Match (Level 2)
                                    // Note: We still check ISIN semantic similarity if possible, but trust ISIN more.
                                    // Wait - "Level 2 ISIN" should be trusted highly, UNLESS it's a known bad mapping (Input Poison).

                                    // Input Poison Protection
                                    // If Yahoo says "Silver" (best.symbol) and Input says "Silver" (asset.symbol),
                                    // BUT similarity < threshold? Then it's a mismatch. 
                                    // Actually, if we found via ISIN, we trust it UNLESS similarity is very low (< 0.2).
                                    // Current plan says: "Enforce 0.4 even for ISIN".

                                    if (similarity >= threshold) {
                                        matchSource = usedIsinSearch ? 'ISIN' : 'SEARCH';
                                        confidence = usedIsinSearch ? 99 : Math.round(similarity * 100);
                                        resolvedSymbol = best.symbol;
                                        resolvedName = cleanAssetName(best.shortname || best.longname || resolvedName);
                                        exchange = exchange || best.exchange; // CSV first
                                        // Update type from search result
                                        if (best.quoteType) {
                                            resolvedType = best.quoteType === 'ETF' ? 'FUND' :
                                                best.quoteType === 'CRYPTOCURRENCY' ? 'CRYPTO' :
                                                    best.quoteType === 'MUTUALFUND' ? 'FUND' : 'STOCK';
                                        }
                                        const quote = await getYahooQuote(resolvedSymbol);
                                        if (quote) currentPrice = quote.regularMarketPrice;
                                    } else {
                                        // REJECTED (Sim < 0.4)
                                        resolvedAssetWarnings.push(`Suspect Match Rejected: '${resultName}' (Sim: ${similarity.toFixed(2)})`);
                                        console.warn(`[Import] Rejected: ${inputName} vs ${resultName} (${similarity.toFixed(2)})`);

                                        // Fallback Logic: Input Poison Prevention
                                        // If we rejected matches, and the Input Symbol matches the Rejected Symbol,
                                        // AND we have an ISIN, force usage of ISIN.
                                        if (best.symbol === asset.symbol && asset.isin) {
                                            resolvedSymbol = asset.isin;
                                            resolvedAssetWarnings.push(`Poisoned Symbol '${asset.symbol}' detected. Forcing ISIN '${asset.isin}'.`);
                                        }
                                        // Else: Keep original symbol, low confidence
                                        confidence = 10;
                                    }
                                } else {
                                    resolvedAssetWarnings.push(`No reliable match found.`);
                                    confidence = 10;
                                }
                            } else {
                                resolvedAssetWarnings.push("No results found on Yahoo Finance.");
                                confidence = 0;
                            }
                        }

                    }
                    // Close the ELSE block for Level 0 Canonical Check
                } catch (error) {
                    confidence = 0;
                    resolvedAssetWarnings.push("Resolution failed unexpectedly.");
                }

                // --- POST-RESOLUTION CHECKS ---

                // --- CATEGORY-BASED METADATA ENRICHMENT ---

                // Step 1: Detect asset category (with ISIN for accurate detection)
                const category = getAssetCategory(resolvedType, exchange, resolvedSymbol, asset.isin);
                console.log(`[Import] Detected category: ${category} for ${resolvedSymbol}`);

                // Step 2: Get category defaults
                const defaults = getCategoryDefaults(category, resolvedSymbol);

                // Step 3: Apply CSV-first priority, then defaults
                exchange = exchange || defaults.exchange;
                country = country || defaults.country;
                sector = sector || defaults.sector;

                // Step 4: Fetch from API only for US_MARKETS and EU_MARKETS
                if (['US_MARKETS', 'EU_MARKETS'].includes(category) && (!country || !sector || country === 'Unknown' || sector === 'Unknown')) {
                    try {
                        console.log(`[Import] Fetching metadata for ${category} asset: ${resolvedSymbol}...`);
                        let profileData: { country?: string; sector?: string; industry?: string; exchange?: string } | null = null;

                        if (category === 'US_MARKETS') {
                            // US_MARKETS: Yahoo → AlphaVantage → Finnhub
                            profileData = await getYahooAssetProfile(resolvedSymbol);
                            if (profileData?.country && profileData?.sector) {
                                console.log(`[Import] ✓ Yahoo metadata: country=${profileData.country}, sector=${profileData.sector}`);
                            } else {
                                // Fallback to AlphaVantage
                                const alphaProfile = await getCompanyOverview(resolvedSymbol);
                                if (alphaProfile) {
                                    profileData = {
                                        country: profileData?.country || alphaProfile.country,
                                        sector: profileData?.sector || alphaProfile.sector,
                                        industry: profileData?.industry || alphaProfile.industry
                                    };
                                    console.log(`[Import] ✓ AlphaVantage metadata: country=${alphaProfile.country}, sector=${alphaProfile.sector}`);
                                }
                            }

                            // Final fallback to Finnhub for US
                            if (!profileData?.country || !profileData?.sector) {
                                const finnhubProfile = await getCompanyProfile(resolvedSymbol);
                                if (finnhubProfile) {
                                    profileData = {
                                        country: profileData?.country || finnhubProfile.country,
                                        sector: profileData?.sector || (finnhubProfile.sector || finnhubProfile.finnhubIndustry),
                                        industry: profileData?.industry || finnhubProfile.industry
                                    };
                                    console.log(`[Import] ✓ Finnhub metadata: country=${finnhubProfile.country}, sector=${finnhubProfile.sector || finnhubProfile.finnhubIndustry}`);
                                }
                            }
                        } else if (category === 'EU_MARKETS') {
                            // EU_MARKETS: Yahoo → Finnhub (skip AlphaVantage, US-focused)
                            profileData = await getYahooAssetProfile(resolvedSymbol);
                            if (profileData?.country && profileData?.sector) {
                                console.log(`[Import] ✓ Yahoo metadata: country=${profileData.country}, sector=${profileData.sector}`);
                            } else {
                                // Fallback to Finnhub for EU
                                const finnhubProfile = await getCompanyProfile(resolvedSymbol);
                                if (finnhubProfile) {
                                    profileData = {
                                        country: profileData?.country || finnhubProfile.country,
                                        sector: profileData?.sector || (finnhubProfile.sector || finnhubProfile.finnhubIndustry),
                                        industry: profileData?.industry || finnhubProfile.industry
                                    };
                                    console.log(`[Import] ✓ Finnhub metadata: country=${finnhubProfile.country}, sector=${finnhubProfile.sector || finnhubProfile.finnhubIndustry}`);
                                }
                            }
                        }

                        // Apply API metadata if found
                        if (profileData) {
                            exchange = exchange || profileData.exchange;
                            country = (country === 'Unknown' || !country) ? (profileData.country || country) : country;
                            sector = (sector === 'Unknown' || !sector) ? (profileData.sector || sector) : sector;
                            console.log(`[Import] Final metadata for ${resolvedSymbol}: exchange=${exchange}, country=${country}, sector=${sector}`);
                        } else {
                            console.log(`[Import] ✗ No API metadata found for ${resolvedSymbol}, using defaults`);
                        }
                    } catch (error) {
                        console.warn(`[Import] Metadata fetch error for ${resolvedSymbol}:`, error);
                    }
                } else {
                    // Auto-fill categories (BIST, TEFAS, CRYPTO, COMMODITIES, etc.)
                    console.log(`[Import] Using auto-fill for ${category}: exchange=${exchange}, country=${country}, sector=${sector}`);
                }

                // Step 5: Final fallback to defaults (in case API failed)
                exchange = exchange || defaults.exchange;
                country = country || defaults.country;
                sector = sector || defaults.sector;


                // 1. Poison Link Detection (Existing DB Check)
                let existing = existingSymbols.get(resolvedSymbol.toUpperCase());
                if (existing) {
                    const poisonSim = calculateSimilarity(existing.name || '', asset.name || asset.symbol);
                    if (poisonSim < 0.4) {
                        console.warn(`[Import] POISON LINK DETECTED: Existing '${existing.symbol}' != Input. Breaking Link.`);
                        existing = undefined;
                        resolvedAssetWarnings.push("Ignored existing asset due to name mismatch.");
                    }
                }

                // 2. Action Determination
                let action: 'add' | 'update' | 'skip' | 'close' = existing ? 'update' : 'add';

                // 3. Closed Position Detection (quantity <= 0)
                if (asset.quantity <= 0.000001) {
                    action = 'close';
                    console.log(`[Import] Detected CLOSED position: ${asset.symbol} (qty=${asset.quantity})`);
                }

                // 4. Logo
                logoUrl = getLogoUrl(resolvedSymbol, resolvedType, exchange, undefined) ?? undefined;

                // 5. Save Alias for future imports (avoid repeat API calls)
                // Save if we got a good resolution from Yahoo (not from memory, and not failed)
                // We save aliases for: name → ticker AND isin → ticker (if different from resolvedSymbol)
                if ((matchSource === 'ISIN' || matchSource === 'SEARCH') && confidence >= 80) {
                    const aliasesToSave: { sourceString: string; platform: string }[] = [];

                    // Map by name (e.g., "APPLE INC" → "AAPL")
                    if (asset.name && asset.name.toUpperCase() !== resolvedSymbol.toUpperCase()) {
                        aliasesToSave.push({
                            sourceString: asset.name.toUpperCase(),
                            platform: asset.platform || ''
                        });
                    }

                    // Map by ISIN (e.g., "US0378331005" → "AAPL")
                    if (asset.isin && asset.isin.toUpperCase() !== resolvedSymbol.toUpperCase()) {
                        aliasesToSave.push({
                            sourceString: asset.isin.toUpperCase(),
                            platform: asset.platform || ''
                        });
                    }

                    // Map by symbol if different (e.g., "ETHEREUM" → "ETH-EUR")
                    if (asset.symbol && asset.symbol.toUpperCase() !== resolvedSymbol.toUpperCase() &&
                        asset.symbol.toUpperCase() !== asset.name?.toUpperCase() &&
                        asset.symbol.toUpperCase() !== asset.isin?.toUpperCase()) {
                        aliasesToSave.push({
                            sourceString: asset.symbol.toUpperCase(),
                            platform: asset.platform || ''
                        });
                    }

                    // Save all aliases
                    for (const alias of aliasesToSave) {
                        try {
                            await (prisma as any).assetAlias.upsert({
                                where: {
                                    userId_sourceString_platform: {
                                        userId,
                                        sourceString: alias.sourceString,
                                        platform: alias.platform
                                    }
                                },
                                update: {
                                    resolvedSymbol,
                                    isVerified: matchSource === 'ISIN'
                                },
                                create: {
                                    userId,
                                    sourceString: alias.sourceString,
                                    platform: alias.platform,
                                    resolvedSymbol,
                                    isVerified: matchSource === 'ISIN'
                                }
                            });
                            console.log(`[Import] ✓ Saved Alias: '${alias.sourceString}' -> '${resolvedSymbol}'`);
                        } catch (aliasError) {
                            console.warn(`[Import] ✗ Failed to save alias for ${alias.sourceString}:`, aliasError);
                        }
                    }

                    if (aliasesToSave.length === 0) {
                        console.log(`[Import] No alias needed for ${resolvedSymbol} (already matches input)`);
                    }
                } else if (matchSource === 'MEMORY') {
                    console.log(`[Import] Skipped alias save - already from MEMORY: ${resolvedSymbol}`);
                } else {
                    console.log(`[Import] Skipped alias save - low confidence or failed: ${resolvedSymbol} (${matchSource}, conf: ${confidence})`);
                }

                return {
                    ...asset,
                    resolvedSymbol,
                    resolvedName,
                    resolvedType,
                    resolvedCurrency,
                    exchange,
                    country,
                    sector,
                    category, // Add detected category
                    currentPrice,
                    confidence,
                    logoUrl,
                    existingAsset: existing ? {
                        id: existing.id,
                        quantity: existing.quantity,
                        buyPrice: existing.buyPrice
                    } : undefined,
                    action,
                    warnings: resolvedAssetWarnings
                };
            })
        );

        resolved.push(...batchResults);
        if (i + batchSize < assets.length) await new Promise(r => setTimeout(r, 200));
    }

    return { success: true, resolved, errors };
}

export interface ImportResult {
    success: boolean;
    added: number;
    updated: number;
    skipped: number;
    errors: string[];
    txAdded?: number;
}

/**
 * Execute the import - add/update assets based on user selections
 */
export async function executeImport(
    assets: ResolvedAsset[],
    transactions: any[] = [], // Using any[] to avoid strict type dependency circularity if needed, but preferably specific type
    portfolioId?: string, // Optional portfolioId - if not provided, use user's default portfolio
    customGroupName?: string // Optional custom group name (e.g. "Long Term", "Speculative", etc.)
): Promise<ImportResult> {
    console.log('[executeImport] Starting import with', assets.length, 'assets');
    assets.forEach(a => console.log(`  - ${a.resolvedSymbol}: qty=${a.quantity}, action=${a.action}`));

    const session = await auth();
    if (!session?.user?.email) {
        return { success: false, added: 0, updated: 0, skipped: 0, errors: ['Not authenticated'] };
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: { portfolio: true }
    });

    if (!user) {
        return { success: false, added: 0, updated: 0, skipped: 0, errors: ['User not found'] };
    }

    // Use provided portfolioId or fall back to user's default portfolio
    const targetPortfolioId = portfolioId || user.portfolio?.id;

    if (!targetPortfolioId) {
        return { success: false, added: 0, updated: 0, skipped: 0, errors: ['Portfolio not found'] };
    }

    // REFECTCH EXISTING ASSETS TO ENSURE IDEMPOTENCY
    // We do this just in case the UI is stale or user double-clicked
    const currentPortfolio = await prisma.portfolio.findUnique({
        where: { id: targetPortfolioId },
        include: { assets: true }
    });

    // Map for quick lookup of ALREADY EXISTING assets in DB
    const dbAssetMap = new Map<string, string>(); // Symbol -> ID
    const dbIsinMap = new Map<string, string>(); // ISIN -> ID

    if (currentPortfolio?.assets) {
        for (const asset of currentPortfolio.assets) {
            // Composite Key: Symbol + CustomGroup + Platform
            const key = `${asset.symbol.toUpperCase()}|${asset.customGroup || ''}|${asset.platform || ''}`;
            dbAssetMap.set(key, asset.id);

            if (asset.isin) {
                const isinKey = `${asset.isin.toUpperCase()}|${asset.customGroup || ''}|${asset.platform || ''}`;
                dbIsinMap.set(isinKey, asset.id);
            }
        }
    }

    let added = 0;
    let updated = 0;
    let skipped = 0;
    let txAdded = 0;
    const errors: string[] = [];

    // Create a map of raw symbol -> resolved asset for quick lookup
    // This helps us link transactions to the correct final symbol
    // We map by multiple keys to ensure we can find the asset regardless of how the transaction references it
    const assetMap = new Map<string, ResolvedAsset>();
    for (const asset of assets) {
        // Map by original symbol (e.g., 'XRP' from Kraken)
        assetMap.set(asset.symbol.toUpperCase(), asset);
        // Map by resolved symbol (e.g., 'XRP-EUR')
        assetMap.set(asset.resolvedSymbol.toUpperCase(), asset);
        // Map by ISIN if available (e.g., DeGiro imports)
        if (asset.isin) {
            assetMap.set(asset.isin.toUpperCase(), asset);
        }
        // Map by name for additional matching (e.g., 'Bitcoin' -> BTC-EUR)
        if (asset.name) {
            assetMap.set(asset.name.toUpperCase(), asset);
        }
    }

    // Get minimum sortOrder for new assets
    const minSortOrder = await prisma.asset.findFirst({
        where: { portfolioId: targetPortfolioId },
        orderBy: { sortOrder: 'asc' },
        select: { sortOrder: true }
    });

    let currentSortOrder = minSortOrder?.sortOrder != null ? minSortOrder.sortOrder - 1 : 0;

    // 1. Process Assets (Snapshots)
    for (const asset of assets) {
        try {
            if (asset.action === 'skip') {
                skipped++;
                continue;
            }

            // IDEMPOTENCY CHECK
            // Check if asset already exists in our fresh DB map using COMPOSITE KEY
            let existingAssetId: string | undefined;
            const lookupKey = `${asset.resolvedSymbol.toUpperCase()}|${customGroupName || ''}|${asset.platform || ''}`;

            if (dbAssetMap.has(lookupKey)) {
                existingAssetId = dbAssetMap.get(lookupKey);
            } else if (asset.isin) {
                const isinKey = `${asset.isin.toUpperCase()}|${customGroupName || ''}|${asset.platform || ''}`;
                if (dbIsinMap.has(isinKey)) {
                    existingAssetId = dbIsinMap.get(isinKey);
                }
            }

            // If we found it exists but action was 'add', switch to 'update' to avoid duplicate
            let finalAction = asset.action;
            if (existingAssetId && finalAction === 'add') {
                console.log(`[Import] Asset ${asset.resolvedSymbol} already exists (${existingAssetId}), switching ADD to UPDATE`);
                finalAction = 'update';
            }

            const category = getAssetCategory(
                asset.resolvedType as any,
                asset.exchange,
                asset.resolvedSymbol,
                asset.isin
            );

            if (finalAction === 'add') {
                // Create new asset
                // STRUCTURAL: Store both names
                // - name: Yahoo name (for display, editable by user)
                // - originalName: CSV product name (preserved, immutable)
                const newAsset = await prisma.asset.create({
                    data: {
                        portfolioId: targetPortfolioId,
                        symbol: asset.resolvedSymbol,
                        name: asset.resolvedName,
                        originalName: asset.name || asset.resolvedName, // CSV name preserved
                        category,
                        type: asset.resolvedType,
                        quantity: asset.quantity,
                        buyPrice: asset.buyPrice,
                        currency: asset.resolvedCurrency,
                        exchange: asset.exchange || 'UNKNOWN',
                        country: asset.country || 'UNKNOWN',
                        sector: asset.sector || 'UNKNOWN',
                        platform: asset.platform || null,
                        customGroup: customGroupName || null,
                        isin: asset.isin || null,
                        sortOrder: currentSortOrder--,
                        logoUrl: asset.logoUrl || getLogoUrl(
                            asset.resolvedSymbol,
                            asset.resolvedType,
                            asset.exchange,
                            asset.country
                        )
                    }
                });

                // Add to our local map so subsequent dupes in same batch are caught
                const newKey = `${newAsset.symbol.toUpperCase()}|${newAsset.customGroup || ''}|${newAsset.platform || ''}`;
                dbAssetMap.set(newKey, newAsset.id);

                if (asset.isin) {
                    const newIsinKey = `${asset.isin.toUpperCase()}|${newAsset.customGroup || ''}|${newAsset.platform || ''}`;
                    dbIsinMap.set(newIsinKey, newAsset.id);
                }

                added++;
            } else if (finalAction === 'update') {
                // Target ID: ONLY from our fresh group-aware lookup. 
                // Ignored asset.existingAsset?.id because it might be from a different group (global match).
                const targetId = existingAssetId;

                if (targetId) {
                    // Update existing asset
                    const existingAsset = currentPortfolio?.assets.find(a => a.id === targetId);

                    // Logic to decide if we should overwrite the name
                    // 1. If existing name is just the symbol (e.g. "BTC"), it's likely unresolved.
                    const isNameGeneric = existingAsset && existingAsset.name === existingAsset.symbol;

                    // 2. If the new name is a Canonical Crypto Name (e.g. "Bitcoin") and different from current
                    const isCanonicalFix = existingAsset &&
                        CRYPTO_ASSET_NAMES[existingAsset.symbol] &&
                        asset.resolvedName === CRYPTO_ASSET_NAMES[existingAsset.symbol] &&
                        existingAsset.name !== asset.resolvedName;

                    await prisma.asset.update({
                        where: { id: targetId },
                        data: {
                            quantity: asset.quantity,
                            buyPrice: asset.buyPrice, // Update average buy price
                            // Update name only if it improves the data
                            name: (isNameGeneric || isCanonicalFix) ? asset.resolvedName : undefined,

                            // SYSTEMATIC METADATA REFRESH
                            // Always update metadata to the latest resolved values
                            // This ensures fixes in parsers/resolvers propagate to existing assets
                            type: asset.resolvedType,
                            exchange: asset.exchange || 'UNKNOWN',
                            currency: asset.resolvedCurrency,
                            category: category || asset.category, // Use recalculated category
                            country: asset.country || 'UNKNOWN',
                            sector: asset.sector || 'UNKNOWN',
                            logoUrl: asset.logoUrl || getLogoUrl(
                                asset.resolvedSymbol,
                                asset.resolvedType,
                                asset.exchange,
                                asset.country
                            )
                        }
                    });
                    updated++;
                } else {
                    // Falls back to create logic below...
                    console.log(`[Import] Update requested for ${asset.resolvedSymbol} but not found in group ${customGroupName || 'Main'}. Creating new.`);
                    await prisma.asset.create({
                        data: {
                            portfolioId: targetPortfolioId,
                            symbol: asset.resolvedSymbol,
                            name: asset.resolvedName,
                            originalName: asset.name || asset.resolvedName, // CSV name preserved
                            category,
                            type: asset.resolvedType,
                            quantity: asset.quantity,
                            buyPrice: asset.buyPrice,
                            currency: asset.resolvedCurrency,
                            exchange: asset.exchange || 'UNKNOWN',
                            country: asset.country || 'UNKNOWN',
                            sector: asset.sector || 'UNKNOWN',
                            platform: asset.platform || null,
                            customGroup: customGroupName || null,
                            isin: asset.isin || null,
                            sortOrder: currentSortOrder--,
                            logoUrl: asset.logoUrl || getLogoUrl(
                                asset.resolvedSymbol,
                                asset.resolvedType,
                                asset.exchange,
                                asset.country
                            )
                        }
                    });
                    added++;
                }
            } else if (finalAction === 'close') {
                const targetId = existingAssetId;
                console.log(`[Import] CLOSE action for ${asset.resolvedSymbol}: existingId=${targetId}, qty=${asset.quantity}`);

                if (targetId) {
                    // Update to 0 quantity (Closed)
                    const existingAsset = currentPortfolio?.assets.find(a => a.id === targetId);

                    // Logic to decide if we should overwrite the name (Same as update block)
                    const isNameGeneric = existingAsset && existingAsset.name === existingAsset.symbol;
                    const isCanonicalFix = existingAsset &&
                        CRYPTO_ASSET_NAMES[existingAsset.symbol] &&
                        asset.resolvedName === CRYPTO_ASSET_NAMES[existingAsset.symbol] &&
                        existingAsset.name !== asset.resolvedName;

                    await prisma.asset.update({
                        where: { id: targetId },
                        data: {
                            quantity: 0,
                            // Keep buy price for history reference
                            // Update name only if it improves the data
                            name: (isNameGeneric || isCanonicalFix) ? asset.resolvedName : undefined,

                            // SYSTEMATIC METADATA REFRESH (Even for Closed Assets)
                            // We want closed assets to look good too (correct type, logo, etc.)
                            type: asset.resolvedType,
                            exchange: asset.exchange || 'UNKNOWN',
                            currency: asset.resolvedCurrency,
                            category: category || asset.category,
                            country: asset.country || 'UNKNOWN',
                            sector: asset.sector || 'UNKNOWN',
                            logoUrl: asset.logoUrl || getLogoUrl(
                                asset.resolvedSymbol,
                                asset.resolvedType,
                                asset.exchange,
                                asset.country
                            )
                        }
                    });
                    console.log(`[Import] Updated ${asset.resolvedSymbol} to quantity=0`);

                    // Helper: Generate dust cleaning transaction?
                    // Verify duplicate transaction not created below
                } else {
                    // Add to closed positions directly (quantity = 0)
                    // If it doesn't exist, we create it as closed (for history tracking?)
                    // Yes, user might want to import closed history for an asset they don't own anymore.
                    console.log(`[Import] Creating CLOSED asset: ${asset.resolvedSymbol} in group ${customGroupName}`);
                    await prisma.asset.create({
                        data: {
                            portfolioId: targetPortfolioId,
                            symbol: asset.resolvedSymbol,
                            name: asset.resolvedName,
                            originalName: asset.name || asset.resolvedName, // CSV name preserved
                            category,
                            type: asset.resolvedType,
                            quantity: 0, // Closed position
                            buyPrice: asset.buyPrice,
                            currency: asset.resolvedCurrency,
                            exchange: asset.exchange || 'UNKNOWN',
                            country: asset.country || 'UNKNOWN',
                            sector: asset.sector || 'UNKNOWN',
                            platform: asset.platform || null,
                            customGroup: customGroupName || null,
                            isin: asset.isin || null,
                            sortOrder: currentSortOrder--,
                            logoUrl: getLogoUrl(
                                asset.resolvedSymbol,
                                asset.resolvedType,
                                asset.exchange,
                                asset.country
                            )
                        }
                    });
                }

                // Create dust clearance transaction for transparency IF and ONLY IF it was an automated 'close' action
                // But typically 'close' action here comes from the Import Logic determining it's Dust.
                // We should only add the Transaction if we are sure one doesn't exist?
                // The transaction logic below handles duplicates via externalId. 
                // Dust cleanup is "System Cleanup" platform.

                // Let's just create it if it's a NEW close.
                // Doing it always is safe if we don't spam.
                added++;
                // txAdded++; // Don't count implicit dust tx as "Transaction Added" for user stats? Maybe yes.
            }
        } catch (error) {
            errors.push(`Failed to ${asset.action} ${asset.resolvedSymbol}: ${error}`);
        }
    }

    // 2. Process Transactions (History)
    if (transactions && transactions.length > 0) {
        console.log(`[Import] Processing ${transactions.length} transactions for group: ${customGroupName || 'Default'}`);
        for (const tx of transactions) {
            try {
                // Determine resolved symbol using our map
                // Try multiple lookup strategies to find the correct asset
                let asset = assetMap.get(tx.symbol.toUpperCase());

                // If not found by symbol, try by ISIN
                if (!asset && tx.isin) {
                    asset = assetMap.get(tx.isin.toUpperCase());
                }

                // If not found by ISIN, try by name
                if (!asset && tx.name) {
                    asset = assetMap.get(tx.name.toUpperCase());
                }

                // IMPORTANT: Don't skip transactions for closed positions
                // Use resolved symbol if available, otherwise try to resolve crypto symbols
                let resolvedSymbol: string;
                if (asset) {
                    resolvedSymbol = asset.resolvedSymbol;
                } else {
                    // Fallback: For crypto assets, try to construct the correct symbol
                    // This handles cases where the asset wasn't in the assets array but we still have transactions
                    const isCrypto = isCryptoSymbol(tx.symbol, undefined, tx.name);
                    if (isCrypto) {
                        const targetCurrency = tx.currency || 'EUR';
                        resolvedSymbol = getCryptoTicker(tx.symbol, tx.name, targetCurrency);
                        console.log(`[Import] Transaction for ${tx.symbol} not found in assetMap, resolved as crypto: ${resolvedSymbol}`);
                    } else {
                        resolvedSymbol = tx.symbol;
                        console.warn(`[Import] Transaction for ${tx.symbol} not found in assetMap, using original symbol`);
                    }
                }

                // Try to create transaction, ignore duplicates if externalId exists and matches
                // We use Upsert if we want to update, but usually history is immutable unless explicit update.
                // Since user might re-import corrected file, let's use externalId to prevent duplicates.

                // Ensure externalId is unique-ish globally or per portfolio?
                // Schema: @@unique([portfolioId, externalId])
                // So as long as externalId is consistent from Parser, we are good.

                // Prefer resolved asset name over tx.name (e.g., "Bitcoin" instead of "BTC")
                const transactionName = asset?.resolvedName || tx.name || resolvedSymbol;

                if (tx.externalId) {
                    await prisma.assetTransaction.upsert({
                        where: {
                            portfolioId_externalId: {
                                portfolioId: targetPortfolioId,
                                externalId: tx.externalId
                            }
                        },
                        update: {
                            symbol: resolvedSymbol,
                            name: transactionName,
                            quantity: tx.quantity,
                            price: tx.price,
                            currency: tx.currency,
                            date: new Date(tx.date),
                            type: tx.type,
                            customGroup: customGroupName || null
                        },
                        create: {
                            portfolioId: targetPortfolioId,
                            symbol: resolvedSymbol,
                            name: transactionName,
                            type: tx.type,
                            quantity: tx.quantity,
                            price: tx.price,
                            currency: tx.currency,
                            date: new Date(tx.date),
                            exchange: tx.exchange,
                            platform: tx.platform,
                            customGroup: customGroupName || null,
                            externalId: tx.externalId
                        }
                    });
                } else {
                    // Start of fuzzy matching for duplicates if no external ID
                    // Check if identical transaction exists (same date, same quantity/price/symbol)
                    const existingTx = await prisma.assetTransaction.findFirst({
                        where: {
                            portfolioId: targetPortfolioId,
                            symbol: resolvedSymbol,
                            date: new Date(tx.date),
                            quantity: tx.quantity,
                            price: tx.price,
                            type: tx.type
                        }
                    });

                    if (!existingTx) {
                        await prisma.assetTransaction.create({
                            data: {
                                portfolioId: targetPortfolioId,
                                symbol: resolvedSymbol,
                                name: transactionName,
                                type: tx.type,
                                quantity: tx.quantity,
                                price: tx.price,
                                currency: tx.currency,
                                date: new Date(tx.date),
                                exchange: tx.exchange,
                                platform: tx.platform,
                                customGroup: customGroupName || null
                            }
                        });
                        txAdded++;
                    }
                }
            } catch (error) {
                // If it's a unique constraint violation that wasn't caught by upsert (unlikely for externalId), ignore it
                console.warn(`Failed to save transaction for ${tx.symbol}:`, error);
                errors.push(`Tx Error ${tx.symbol}: ${error}`);
            }
        }
        console.log(`[Import] Processed ${transactions.length} transactions, successfully added ${txAdded}`);
    }

    // Track the import activity
    await trackActivity('PORTFOLIO', 'CREATE', {
        userId: user.id,
        username: user.username,
        details: {
            action: 'BULK_IMPORT',
            totalAssets: assets.length,
            added,
            updated,
            skipped,
            errors: errors.length
        }
    });

    // Revalidate paths
    revalidatePath('/');
    revalidatePath(`/${user.username}`);

    return {
        success: errors.length === 0,
        added,
        updated,
        skipped,
        errors,
        txAdded
    };
}
