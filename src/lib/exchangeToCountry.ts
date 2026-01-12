/**
 * Exchange to Country Mapping
 *
 * Derives country information from stock exchange suffixes or exchange names.
 * Used as fallback when Yahoo Finance doesn't provide country metadata.
 */

/**
 * Exchange name to country mapping
 */
const EXCHANGE_TO_COUNTRY: Record<string, string> = {
  // Europe
  'AMS': 'Netherlands',
  'AMSTERDAM': 'Netherlands',
  'EPA': 'France',
  'PAR': 'France',
  'PARIS': 'France',
  'FRA': 'Germany',
  'XETRA': 'Germany',
  'FRANKFURT': 'Germany',
  'LSE': 'United Kingdom',
  'LON': 'United Kingdom',
  'LONDON': 'United Kingdom',
  'MIL': 'Italy',
  'MILAN': 'Italy',
  'BME': 'Spain',
  'MADRID': 'Spain',
  'SWX': 'Switzerland',
  'SWISS': 'Switzerland',
  'VIE': 'Austria',
  'VIENNA': 'Austria',
  'OSL': 'Norway',
  'OSLO': 'Norway',
  'CPH': 'Denmark',
  'COPENHAGEN': 'Denmark',
  'HEL': 'Finland',
  'HELSINKI': 'Finland',
  'STO': 'Sweden',
  'STOCKHOLM': 'Sweden',
  'BIST': 'Turkey',
  'ISTANBUL': 'Turkey',

  // Americas
  'NYSE': 'United States',
  'NASDAQ': 'United States',
  'NYQ': 'United States',
  'NMS': 'United States',
  'TSX': 'Canada',
  'TORONTO': 'Canada',
  'BVMF': 'Brazil',
  'SAO': 'Brazil',
  'BMV': 'Mexico',
  'MEXICO': 'Mexico',

  // Asia
  'TSE': 'Japan',
  'TOKYO': 'Japan',
  'HKSE': 'Hong Kong',
  'HKG': 'Hong Kong',
  'SSE': 'China',
  'SHANGHAI': 'China',
  'SZSE': 'China',
  'SHENZHEN': 'China',
  'NSE': 'India',
  'BSE': 'India',
  'MUMBAI': 'India',
  'KRX': 'South Korea',
  'KOREA': 'South Korea',
  'TWSE': 'Taiwan',
  'TAIPEI': 'Taiwan',
  'SGX': 'Singapore',
  'SINGAPORE': 'Singapore',

  // Middle East & Africa
  'TADAWUL': 'Saudi Arabia',
  'SAUDI': 'Saudi Arabia',
  'JSE': 'South Africa',
  'JOHANNESBURG': 'South Africa',
};

/**
 * Symbol suffix to country mapping
 * Common format: SYMBOL.SUFFIX (e.g., AAPL.AS, THYAO.IS)
 */
const SUFFIX_TO_COUNTRY: Record<string, string> = {
  // Europe
  'AS': 'Netherlands',      // Euronext Amsterdam
  'PA': 'France',           // Euronext Paris
  'DE': 'Germany',          // Frankfurt/XETRA
  'F': 'Germany',           // Frankfurt
  'L': 'United Kingdom',    // London Stock Exchange
  'MI': 'Italy',            // Milan
  'MC': 'Spain',            // Madrid
  'SW': 'Switzerland',      // Swiss Exchange
  'VI': 'Austria',          // Vienna
  'OL': 'Norway',           // Oslo
  'CO': 'Denmark',          // Copenhagen
  'HE': 'Finland',          // Helsinki
  'ST': 'Sweden',           // Stockholm
  'IS': 'Turkey',           // Istanbul (BIST)

  // Americas
  'TO': 'Canada',           // Toronto
  'SA': 'Brazil',           // São Paulo
  'MX': 'Mexico',           // Mexico

  // Asia
  'T': 'Japan',             // Tokyo
  'HK': 'Hong Kong',        // Hong Kong
  'SS': 'China',            // Shanghai
  'SZ': 'China',            // Shenzhen
  'NS': 'India',            // NSE India
  'BO': 'India',            // BSE India
  'KS': 'South Korea',      // Korea
  'KQ': 'South Korea',      // KOSDAQ
  'TW': 'Taiwan',           // Taiwan
  'SI': 'Singapore',        // Singapore

  // Middle East & Africa
  'SR': 'Saudi Arabia',     // Tadawul
  'JO': 'South Africa',     // Johannesburg
};

/**
 * Get country from exchange name or symbol suffix
 *
 * @param exchange - Exchange name from API (e.g., "NYSE", "BIST")
 * @param symbol - Stock symbol with possible suffix (e.g., "INGA.AS")
 * @returns Country name or undefined if no match
 *
 * @example
 * getCountryFromExchange("NYSE") → "United States"
 * getCountryFromExchange(undefined, "INGA.AS") → "Netherlands"
 * getCountryFromExchange("BIST", "THYAO.IS") → "Turkey"
 */
export function getCountryFromExchange(
  exchange?: string,
  symbol?: string
): string | undefined {
  // Strategy 1: Try exchange name first
  if (exchange) {
    const upperExchange = exchange.toUpperCase().trim();

    // Direct match
    if (EXCHANGE_TO_COUNTRY[upperExchange]) {
      return EXCHANGE_TO_COUNTRY[upperExchange];
    }

    // Partial match (exchange name contains key)
    for (const [key, country] of Object.entries(EXCHANGE_TO_COUNTRY)) {
      if (upperExchange.includes(key)) {
        return country;
      }
    }
  }

  // Strategy 2: Try symbol suffix
  if (symbol) {
    const parts = symbol.split('.');
    if (parts.length === 2) {
      const suffix = parts[1].toUpperCase().trim();
      if (SUFFIX_TO_COUNTRY[suffix]) {
        return SUFFIX_TO_COUNTRY[suffix];
      }
    }
  }

  // No match found
  return undefined;
}
