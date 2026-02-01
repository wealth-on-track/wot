/**
 * 8-Category Asset Classification System
 *
 * This is the single source of truth for asset categorization.
 * All assets in the system belong to exactly one of these 8 categories.
 */

export type AssetCategory =
  | 'BIST'          // Borsa Istanbul stocks
  | 'TEFAS'         // Turkish mutual funds
  | 'US_MARKETS'    // NASDAQ, NYSE, AMEX
  | 'EU_MARKETS'    // European exchanges (Paris, Amsterdam, Frankfurt, Milan, London, Madrid, Lisbon, Swiss)
  | 'CRYPTO'        // Cryptocurrencies
  | 'COMMODITIES'   // Gold, Silver, Oil, etc.
  | 'FX'            // Foreign Exchange pairs (EURUSD, EURTRY, etc.)
  | 'CASH'          // Cash holdings (USD, EUR, TRY, etc.)
  | 'BENCHMARK';    // Performance Benchmarks (Category 9)

/**
 * Legacy type for backward compatibility during migration
 */
export type LegacyAssetType =
  | 'STOCK'
  | 'CRYPTO'
  | 'GOLD'
  | 'BOND'
  | 'FUND'
  | 'CASH'
  | 'COMMODITY'
  | 'CURRENCY'
  | 'ETF'
  | 'TEFAS'
  | 'FON';

/**
 * Exchange definitions for each market category
 */
export const CATEGORY_EXCHANGES: Record<AssetCategory, string[]> = {
  BIST: ['BIST', 'IST', 'Istanbul'],
  TEFAS: ['TEFAS'],
  US_MARKETS: ['NASDAQ', 'NYSE', 'AMEX', 'NYQ', 'NMS', 'NGM'],
  EU_MARKETS: [
    // Euronext Amsterdam
    'AMS', 'XAMS', 'EAM', 'EPA', 'Amsterdam',

    // Euronext Paris
    'PAR', 'XPAR', 'Paris',

    // Deutsche Börse (Frankfurt)
    'FRA', 'XFRA', 'Frankfurt', 'GER', 'XETRA', 'XET', 'DB',

    // Borsa Italiana (Milan)
    'MIL', 'XMIL', 'BIT', 'Milan',

    // London Stock Exchange
    'LSE', 'LON', 'XLON', 'L', 'London',

    // Bolsa de Madrid
    'MAD', 'XMAD', 'BME', 'Madrid',

    // Euronext Lisbon
    'LIS', 'XLIS', 'ENXL', 'Lisbon',

    // SIX Swiss Exchange
    'SWX', 'VTX', 'XSWX', 'Swiss'
  ],
  CRYPTO: [],
  COMMODITIES: ['Forex', 'COMEX', 'NYMEX'],
  FX: ['Forex'],
  CASH: ['Forex'],
  BENCHMARK: []
};

/**
 * Yahoo Finance suffix mapping for each category
 */
export const YAHOO_SUFFIX_MAP: Record<string, string> = {
  // BIST
  'BIST': '.IS',
  'IST': '.IS',

  // EU Markets - Euronext Amsterdam
  'AMS': '.AS',
  'XAMS': '.AS',
  'EAM': '.AS',
  'EPA': '.AS',
  'Amsterdam': '.AS',

  // EU Markets - Euronext Paris
  'PAR': '.PA',
  'XPAR': '.PA',
  'Paris': '.PA',

  // EU Markets - Deutsche Börse (Frankfurt)
  'FRA': '.F',
  'XFRA': '.F',
  'Frankfurt': '.F',
  'GER': '.DE',
  'XETRA': '.DE',
  'XET': '.DE',
  'DB': '.F',

  // EU Markets - Borsa Italiana (Milan)
  'MIL': '.MI',
  'XMIL': '.MI',
  'BIT': '.MI',
  'Milan': '.MI',

  // EU Markets - London Stock Exchange
  'LSE': '.L',
  'LON': '.L',
  'XLON': '.L',
  'L': '.L',
  'London': '.L',

  // EU Markets - Bolsa de Madrid
  'MAD': '.MC',
  'XMAD': '.MC',
  'BME': '.MC',
  'Madrid': '.MC',

  // EU Markets - Euronext Lisbon
  'LIS': '.LS',
  'XLIS': '.LS',
  'ENXL': '.LS',
  'Lisbon': '.LS',

  // EU Markets - SIX Swiss Exchange
  'SWX': '.SW',
  'VTX': '.SW',
  'XSWX': '.SW',
  'Swiss': '.SW'
};

/**
 * Default currency for each category
 */
export const CATEGORY_CURRENCY: Record<AssetCategory, string> = {
  BIST: 'TRY',
  TEFAS: 'TRY',
  US_MARKETS: 'USD',
  EU_MARKETS: 'EUR',  // Can be overridden for LSE (GBP), SWX (CHF)
  CRYPTO: 'USD',      // Depends on pair
  COMMODITIES: 'USD', // Can be TRY for GAUTRY/XAGTRY
  FX: 'USD',          // Base currency of pair
  CASH: 'USD',        // Matches symbol
  BENCHMARK: 'USD'    // Default
};

/**
 * ISIN Country Prefix to Category mapping
 * Used for accurate category detection from ISIN codes
 */
export const ISIN_PREFIX_CATEGORY: Record<string, AssetCategory> = {
  // Turkey
  'TR': 'BIST',  // Will be refined to TEFAS if type is FUND

  // United States
  'US': 'US_MARKETS',

  // European Union & EEA countries
  'DE': 'EU_MARKETS',  // Germany
  'FR': 'EU_MARKETS',  // France
  'NL': 'EU_MARKETS',  // Netherlands
  'GB': 'EU_MARKETS',  // United Kingdom
  'IE': 'EU_MARKETS',  // Ireland
  'LU': 'EU_MARKETS',  // Luxembourg
  'IT': 'EU_MARKETS',  // Italy
  'ES': 'EU_MARKETS',  // Spain
  'PT': 'EU_MARKETS',  // Portugal
  'CH': 'EU_MARKETS',  // Switzerland
  'AT': 'EU_MARKETS',  // Austria
  'BE': 'EU_MARKETS',  // Belgium
  'DK': 'EU_MARKETS',  // Denmark
  'FI': 'EU_MARKETS',  // Finland
  'NO': 'EU_MARKETS',  // Norway
  'SE': 'EU_MARKETS',  // Sweden
  'PL': 'EU_MARKETS',  // Poland
  'GR': 'EU_MARKETS',  // Greece
  'CZ': 'EU_MARKETS',  // Czech Republic
  'HU': 'EU_MARKETS',  // Hungary

  // Crypto (some exchanges use XFC prefix)
  'XF': 'CRYPTO',
};

/**
 * Symbol suffix to Category mapping
 * Used for accurate category detection from symbol suffixes
 */
export const SYMBOL_SUFFIX_CATEGORY: Record<string, AssetCategory> = {
  '.IS': 'BIST',      // Borsa Istanbul
  '.DE': 'EU_MARKETS', // Deutsche Börse (Xetra)
  '.F': 'EU_MARKETS',  // Frankfurt
  '.PA': 'EU_MARKETS', // Euronext Paris
  '.AS': 'EU_MARKETS', // Euronext Amsterdam
  '.L': 'EU_MARKETS',  // London Stock Exchange
  '.MI': 'EU_MARKETS', // Borsa Italiana (Milan)
  '.MC': 'EU_MARKETS', // Bolsa de Madrid
  '.LS': 'EU_MARKETS', // Euronext Lisbon
  '.SW': 'EU_MARKETS', // SIX Swiss Exchange
  '.BR': 'EU_MARKETS', // Euronext Brussels
  '.VI': 'EU_MARKETS', // Vienna Stock Exchange
  '.CO': 'EU_MARKETS', // Copenhagen
  '.HE': 'EU_MARKETS', // Helsinki
  '.OL': 'EU_MARKETS', // Oslo
  '.ST': 'EU_MARKETS', // Stockholm
};

/**
 * Convert legacy type + exchange to new category system
 * Enhanced with ISIN prefix and symbol suffix detection for 100% accuracy
 */
export function getAssetCategory(
  type: LegacyAssetType | string,
  exchange?: string,
  symbol?: string,
  isin?: string
): AssetCategory {
  const upperExchange = exchange?.toUpperCase() || '';
  const upperSymbol = symbol?.toUpperCase() || '';
  const upperIsin = isin?.toUpperCase() || '';

  // ============================================
  // PHASE 1: Explicit Type Checks (Highest Priority)
  // ============================================

  // TEFAS - Explicit check first
  if (type === 'TEFAS' || type === 'FON' || upperExchange === 'TEFAS') {
    return 'TEFAS';
  }

  // CASH - Explicit check
  if (type === 'CASH') {
    return 'CASH';
  }

  // BENCHMARK - Explicit check
  if (type === 'BENCHMARK') {
    return 'BENCHMARK';
  }

  // FX - Currency pairs (check symbol patterns)
  if (type === 'CURRENCY' || upperSymbol.includes('=X') ||
    /^[A-Z]{3}[A-Z]{3}$/.test(upperSymbol) || // EURUSD, USDTRY format
    (upperSymbol.includes('USD') && upperSymbol.includes('TRY')) ||
    (upperSymbol.includes('EUR') && upperSymbol.includes('USD'))) {
    return 'FX';
  }

  // CRYPTO - Check type or symbol patterns
  if (type === 'CRYPTO' || upperSymbol.includes('-USD') || upperSymbol.includes('-EUR') ||
    upperSymbol.includes('-BTC') || upperSymbol.includes('-USDT')) {
    return 'CRYPTO';
  }

  // COMMODITIES - Type check
  if (type === 'GOLD' || type === 'COMMODITY') {
    return 'COMMODITIES';
  }

  // Turkish-specific commodities
  if (upperSymbol === 'GAUTRY' || upperSymbol === 'XAGTRY' || upperSymbol === 'AET') {
    return 'COMMODITIES';
  }

  // ============================================
  // PHASE 2: ISIN Prefix Detection (High Accuracy)
  // ============================================
  if (upperIsin && upperIsin.length >= 2) {
    const isinPrefix = upperIsin.substring(0, 2);
    const isinCategory = ISIN_PREFIX_CATEGORY[isinPrefix];

    if (isinCategory) {
      // Special case: Turkish ISIN with FUND type → TEFAS
      if (isinPrefix === 'TR' && (type === 'FUND' || type === 'ETF' || type === 'FON')) {
        return 'TEFAS';
      }
      return isinCategory;
    }
  }

  // ============================================
  // PHASE 3: Symbol Suffix Detection
  // ============================================
  for (const [suffix, category] of Object.entries(SYMBOL_SUFFIX_CATEGORY)) {
    if (upperSymbol.endsWith(suffix)) {
      return category;
    }
  }

  // ============================================
  // PHASE 4: Exchange-based Detection
  // ============================================

  // BIST - Check exchange
  if (CATEGORY_EXCHANGES.BIST.some(ex => upperExchange.includes(ex))) {
    return 'BIST';
  }

  // EU_MARKETS - Check exchange
  if (CATEGORY_EXCHANGES.EU_MARKETS.some(ex => upperExchange.includes(ex))) {
    return 'EU_MARKETS';
  }

  // US_MARKETS - Check exchange
  if (CATEGORY_EXCHANGES.US_MARKETS.some(ex => upperExchange.includes(ex))) {
    return 'US_MARKETS';
  }

  // ============================================
  // PHASE 5: Type-based Fallback with ISIN hints
  // ============================================

  // FUND type without TEFAS exchange -> determine by ISIN or exchange
  if (type === 'FUND' || type === 'ETF') {
    // Check ISIN for Turkish funds → TEFAS
    if (upperIsin && upperIsin.startsWith('TR')) {
      return 'TEFAS';
    }
    // Check exchange to categorize
    if (CATEGORY_EXCHANGES.BIST.some(ex => upperExchange.includes(ex))) {
      return 'BIST';
    }
    if (CATEGORY_EXCHANGES.EU_MARKETS.some(ex => upperExchange.includes(ex))) {
      return 'EU_MARKETS';
    }
    return 'US_MARKETS'; // Default to US
  }

  // Default: STOCK type
  if (type === 'STOCK' || type === 'BOND') {
    // If no exchange specified, check ISIN first
    if (upperIsin && upperIsin.length >= 2) {
      const isinPrefix = upperIsin.substring(0, 2);
      if (isinPrefix === 'TR') return 'BIST';
      if (ISIN_PREFIX_CATEGORY[isinPrefix] === 'EU_MARKETS') return 'EU_MARKETS';
      if (isinPrefix === 'US') return 'US_MARKETS';
    }

    // If no exchange and no ISIN, default to US
    if (!exchange) {
      return 'US_MARKETS';
    }

    // Already checked BIST and EU above, so must be US
    return 'US_MARKETS';
  }

  // ============================================
  // PHASE 6: Ultimate Fallback
  // ============================================
  // Try ISIN one more time
  if (upperIsin && upperIsin.length >= 2) {
    const isinPrefix = upperIsin.substring(0, 2);
    const isinCategory = ISIN_PREFIX_CATEGORY[isinPrefix];
    if (isinCategory) return isinCategory;
  }

  return 'US_MARKETS';
}

/**
 * Convert new category back to legacy type (for backward compatibility)
 */
export function categoryToLegacyType(category: AssetCategory): LegacyAssetType {
  switch (category) {
    case 'BIST':
    case 'US_MARKETS':
    case 'EU_MARKETS':
      return 'STOCK';
    case 'TEFAS':
      return 'FUND';
    case 'CRYPTO':
      return 'CRYPTO';
    case 'COMMODITIES':
      return 'COMMODITY';
    case 'FX':
      return 'CURRENCY';
    case 'CASH':
      return 'CASH';
    case 'BENCHMARK':
      return 'STOCK'; // Treat as stock for legacy systems
  }
}

/**
 * Get Yahoo Finance search symbol for a given category and symbol
 */
export function getYahooSearchSymbol(category: AssetCategory, symbol: string, exchange?: string): string {
  switch (category) {
    case 'BIST':
      return `${symbol}.IS`;

    case 'EU_MARKETS':
      if (exchange && YAHOO_SUFFIX_MAP[exchange]) {
        return `${symbol}${YAHOO_SUFFIX_MAP[exchange]}`;
      }
      return symbol; // Fallback to raw symbol

    case 'US_MARKETS':
    case 'CRYPTO':
    case 'FX':
      return symbol; // Use as-is

    case 'COMMODITIES':
      // Special handling for Turkish commodities
      if (symbol === 'GAUTRY') return 'GC=F'; // Gold futures
      if (symbol === 'XAGTRY') return 'SI=F'; // Silver futures
      return symbol;

    case 'TEFAS':
      return symbol; // TEFAS doesn't use Yahoo

    case 'CASH':
      return symbol; // Cash doesn't need price lookup

    case 'BENCHMARK':
      return symbol; // Use as-is
  }
}

/**
 * Determine if a category should use Yahoo Finance
 */
export function shouldUseYahoo(category: AssetCategory): boolean {
  return category !== 'TEFAS' && category !== 'CASH';
}

/**
 * Get default metadata for a category
 */
export function getCategoryDefaults(category: AssetCategory, symbol?: string): {
  sector: string;
  country: string;
  currency: string;
  exchange?: string;
} {
  switch (category) {
    case 'BIST':
      return { sector: 'Unknown', country: 'Turkey', currency: 'TRY', exchange: 'BIST' };

    case 'TEFAS':
      return { sector: 'Fund', country: 'Turkey', currency: 'TRY', exchange: 'TEFAS' };

    case 'US_MARKETS':
      return { sector: 'Unknown', country: 'United States', currency: 'USD', exchange: undefined };

    case 'EU_MARKETS':
      // Country depends on exchange, default to Europe
      return { sector: 'Unknown', country: 'Europe', currency: 'EUR', exchange: undefined };

    case 'CRYPTO':
      // Crypto pairs: BTC-USD, ETH-EUR, etc.
      // Extract quote currency from symbol (e.g., BTC-EUR -> EUR)
      // Default to USD if no quote currency can be determined
      let cryptoCurrency = 'USD'; // Default to USD (most common quote currency)
      if (symbol && symbol.includes('-')) {
        const parts = symbol.split('-');
        if (parts.length === 2 && parts[1].length <= 4) {
          cryptoCurrency = parts[1].toUpperCase(); // Quote currency (USD, EUR, etc.)
        }
      }
      return { sector: 'Crypto', country: 'Crypto', currency: cryptoCurrency, exchange: 'Crypto' };

    case 'COMMODITIES':
      // All commodities: Country = Commodity, Sector = Commodity
      // Currency: TRY for Turkish commodities, USD for international
      let commodityCurrency = 'USD'; // Default to USD (international standard)
      if (symbol) {
        const upperSymbol = symbol.toUpperCase();
        if (upperSymbol === 'GAUTRY' || upperSymbol === 'XAGTRY' || upperSymbol.endsWith('TRY')) {
          commodityCurrency = 'TRY'; // Turkish commodity pricing
        } else if (upperSymbol === 'XAU' || upperSymbol.startsWith('XAU')) {
          commodityCurrency = 'XAU'; // Gold in ounces
        } else if (upperSymbol === 'XAG' || upperSymbol.startsWith('XAG')) {
          commodityCurrency = 'XAG'; // Silver in ounces
        }
      }

      return {
        sector: 'Commodity',
        country: 'Commodity',  // Keep as Commodity for grouping
        currency: commodityCurrency,
        exchange: 'Commodity'
      };

    case 'FX':
      return { sector: 'Currency', country: 'Global', currency: 'USD', exchange: undefined };

    case 'CASH':
      let country = 'Global';
      if (symbol === 'USD') country = 'United States'; // Changed from 'USA'
      else if (symbol === 'EUR') country = 'Europe';
      else if (symbol === 'TRY') country = 'Turkey';
      else if (symbol === 'GBP') country = 'United Kingdom';

      return {
        sector: 'Cash',
        country,
        currency: symbol || 'USD',
        exchange: undefined
      };

    case 'BENCHMARK':
      return { sector: 'Index', country: 'Global', currency: 'USD', exchange: undefined };
  }
}

/**
 * Category display names for UI
 */
export const CATEGORY_DISPLAY_NAMES: Record<AssetCategory, string> = {
  BIST: 'Borsa Istanbul',
  TEFAS: 'TEFAS Funds',
  US_MARKETS: 'US Markets',
  EU_MARKETS: 'European Markets',
  CRYPTO: 'Cryptocurrencies',
  COMMODITIES: 'Commodities',
  FX: 'Foreign Exchange',
  CASH: 'Cash Holdings',
  BENCHMARK: 'Performance Benchmarks'
};

/**
 * Category colors for UI
 */
export const CATEGORY_COLORS: Record<AssetCategory, string> = {
  BIST: '#E74C3C',        // Red
  TEFAS: '#3498DB',       // Blue
  US_MARKETS: '#2ECC71',  // Green
  EU_MARKETS: '#9B59B6',  // Purple
  CRYPTO: '#F39C12',      // Orange
  COMMODITIES: '#E67E22', // Dark Orange
  FX: '#1ABC9C',          // Teal
  CASH: '#95A5A6',        // Gray
  BENCHMARK: '#607D8B'    // Blue Grey
};
