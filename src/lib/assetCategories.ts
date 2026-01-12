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
    'PAR', 'Paris',           // Euronext Paris
    'AMS', 'Amsterdam',        // Euronext Amsterdam
    'FRA', 'Frankfurt', 'GER', 'XETRA',  // Deutsche Börse
    'MIL', 'Milan',            // Borsa Italiana
    'LSE', 'LON', 'London',    // London Stock Exchange
    'MAD', 'Madrid',           // Bolsa de Madrid
    'LIS', 'Lisbon',           // Euronext Lisbon
    'SWX', 'Swiss', 'VTX'      // SIX Swiss Exchange
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

  // EU Markets
  'PAR': '.PA',
  'Paris': '.PA',
  'AMS': '.AS',
  'Amsterdam': '.AS',
  'FRA': '.F',
  'Frankfurt': '.F',
  'GER': '.DE',
  'XETRA': '.DE',
  'MIL': '.MI',
  'Milan': '.MI',
  'LSE': '.L',
  'LON': '.L',
  'London': '.L',
  'MAD': '.MC',
  'Madrid': '.MC',
  'LIS': '.LS',
  'Lisbon': '.LS',
  'SWX': '.SW',
  'Swiss': '.SW',
  'VTX': '.SW'
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
 * Convert legacy type + exchange to new category system
 */
export function getAssetCategory(
  type: LegacyAssetType | string,
  exchange?: string,
  symbol?: string
): AssetCategory {
  const upperExchange = exchange?.toUpperCase() || '';
  const upperSymbol = symbol?.toUpperCase() || '';

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

  // FX - Currency pairs
  if (type === 'CURRENCY' || upperSymbol.includes('=X') ||
    (upperSymbol.includes('USD') && upperSymbol.includes('TRY')) ||
    (upperSymbol.includes('EUR') && upperSymbol.includes('USD'))) {
    return 'FX';
  }

  // CRYPTO
  if (type === 'CRYPTO') {
    return 'CRYPTO';
  }

  // COMMODITIES
  if (type === 'GOLD' || type === 'COMMODITY') {
    return 'COMMODITIES';
  }

  // Turkish-specific commodities
  if (upperSymbol === 'GAUTRY' || upperSymbol === 'XAGTRY' || upperSymbol === 'AET') {
    return 'COMMODITIES';
  }

  // BIST - Check exchange
  if (CATEGORY_EXCHANGES.BIST.some(ex => upperExchange.includes(ex))) {
    return 'BIST';
  }

  // EU_MARKETS - Check exchange
  if (CATEGORY_EXCHANGES.EU_MARKETS.some(ex => upperExchange.includes(ex))) {
    return 'EU_MARKETS';
  }

  // US_MARKETS - Check exchange or default for stocks
  if (CATEGORY_EXCHANGES.US_MARKETS.some(ex => upperExchange.includes(ex))) {
    return 'US_MARKETS';
  }

  // FUND type without TEFAS exchange -> could be US/EU mutual fund
  if (type === 'FUND' || type === 'ETF') {
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
    // If no exchange specified, default to US
    if (!exchange) {
      return 'US_MARKETS';
    }

    // Already checked BIST and EU above, so must be US
    return 'US_MARKETS';
  }

  // Fallback
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
} {
  switch (category) {
    case 'BIST':
      return { sector: 'UNKNOWN', country: 'Turkey', currency: 'TRY' };

    case 'TEFAS':
      return { sector: 'Fund', country: 'Turkey', currency: 'TRY' };

    case 'US_MARKETS':
      return { sector: 'UNKNOWN', country: 'USA', currency: 'USD' };

    case 'EU_MARKETS':
      // Country depends on exchange, default to Europe
      return { sector: 'UNKNOWN', country: 'Europe', currency: 'EUR' };

    case 'CRYPTO':
      // Crypto pairs: BTC-USD, ETH-EUR, etc.
      // Extract quote currency from symbol (e.g., BTC-EUR -> EUR)
      let cryptoCurrency = 'USD'; // Default
      if (symbol && symbol.includes('-')) {
        const parts = symbol.split('-');
        if (parts.length === 2) {
          cryptoCurrency = parts[1]; // Quote currency (USD, EUR, etc.)
        }
      }
      return { sector: 'Crypto', country: 'Global', currency: cryptoCurrency };

    case 'COMMODITIES':
      // All commodities: Country = Global, Sector = Commodity
      // Currency: TRY for GAUTRY/XAGTRY, XAU/XAG for ounce-based, USD for others
      let commodityCurrency = 'USD';
      if (symbol === 'GAUTRY') commodityCurrency = 'TRY';
      else if (symbol === 'XAGTRY') commodityCurrency = 'TRY';
      else if (symbol === 'XAU') commodityCurrency = 'XAU';
      else if (symbol === 'XAG') commodityCurrency = 'XAG';

      return {
        sector: 'Commodity',
        country: 'Global',  // Always Global for all commodities
        currency: commodityCurrency
      };

    case 'FX':
      return { sector: 'Currency', country: 'Global', currency: 'USD' };

    case 'CASH':
      let country = 'Global';
      if (symbol === 'USD') country = 'USA';
      else if (symbol === 'EUR') country = 'Europe';
      else if (symbol === 'TRY') country = 'Turkey';
      else if (symbol === 'GBP') country = 'United Kingdom';

      return {
        sector: 'Cash',
        country,
        currency: symbol || 'USD'
      };

    case 'BENCHMARK':
      return { sector: 'Index', country: 'Global', currency: 'USD' };
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
