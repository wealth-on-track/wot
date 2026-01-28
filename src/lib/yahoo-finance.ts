/**
 * Yahoo Finance API Service
 * Lightweight wrapper for fetching real-time and historical price data
 */

interface YahooQuoteResponse {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice: number;
        currency: string;
        symbol: string;
      };
      timestamp: number[];
      indicators: {
        quote: Array<{
          close: number[];
        }>;
      };
    }>;
    error: null | { code: string; description: string };
  };
}

interface PriceData {
  symbol: string;
  price: number;
  currency: string;
  date: Date;
}

interface HistoricalData {
  symbol: string;
  prices: Array<{
    date: Date;
    price: number;
  }>;
}

/**
 * Fetch current price for a single symbol
 */
import { unstable_cache } from 'next/cache';

/**
 * Fetch current price for a single symbol (Cached)
 */
export const fetchCurrentPrice = unstable_cache(
  async (symbol: string): Promise<PriceData | null> => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        console.error(`Yahoo Finance API error for ${symbol}: ${response.status}`);
        return null;
      }

      const data: YahooQuoteResponse = await response.json();

      if (data.chart.error) {
        console.error(`Yahoo Finance error for ${symbol}:`, data.chart.error);
        return null;
      }

      const result = data.chart.result[0];
      if (!result || !result.meta) {
        return null;
      }

      return {
        symbol,
        price: result.meta.regularMarketPrice,
        currency: result.meta.currency || 'USD',
        date: new Date(),
      };
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error);
      return null;
    }
  },
  ['yahoo-price'],
  { revalidate: 300 } // Cache for 5 minutes
);

/**
 * Fetch current prices for multiple symbols in batch
 */
export async function fetchBatchPrices(symbols: string[]): Promise<PriceData[]> {
  const results = await Promise.allSettled(
    symbols.map(symbol => fetchCurrentPrice(symbol))
  );

  return results
    .filter((result): result is PromiseFulfilledResult<PriceData | null> =>
      result.status === 'fulfilled' && result.value !== null
    )
    .map(result => result.value!);
}

/**
 * Fetch historical prices for a symbol (Cached)
 * @param symbol - Yahoo Finance symbol (e.g., '^GSPC', 'AAPL')
 * @param days - Number of days of history to fetch
 */
export const fetchHistoricalPrices = unstable_cache(
  async (
    symbol: string,
    days: number
  ): Promise<HistoricalData | null> => {
    try {
      // Use a fixed period end time (nearest hour) to improve cache hit rates
      // rather than Date.now() which changes every millisecond
      const now = Math.floor(Date.now() / 1000);
      const period2 = now - (now % 3600);
      const period1 = period2 - (days * 24 * 60 * 60);

      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        console.error(`Yahoo Finance API error for ${symbol}: ${response.status}`);
        return null;
      }

      const data: YahooQuoteResponse = await response.json();

      if (data.chart.error) {
        console.error(`Yahoo Finance error for ${symbol}:`, data.chart.error);
        return null;
      }

      const result = data.chart.result[0];
      if (!result || !result.timestamp || !result.indicators.quote[0].close) {
        return null;
      }

      const timestamps = result.timestamp;
      const closePrices = result.indicators.quote[0].close;

      const prices = timestamps
        .map((timestamp, index) => ({
          date: new Date(timestamp * 1000),
          price: closePrices[index],
        }))
        .filter(item => item.price !== null && !isNaN(item.price));

      return {
        symbol,
        prices,
      };
    } catch (error) {
      console.error(`Error fetching historical prices for ${symbol}:`, error);
      return null;
    }
  },
  ['yahoo-history'],
  { revalidate: 3600 } // Cache history for 1 hour
);

/**
 * Normalize date to midnight UTC
 */
export function normalizeToMidnight(date: Date): Date {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Get benchmark symbols mapping
 */
export const BENCHMARK_SYMBOLS: Record<string, string> = {
  'SPX': '^GSPC',        // S&P 500
  'IXIC': '^IXIC',       // NASDAQ
  'XU100.IS': 'XU100.IS', // BIST 100
  'GOLD': 'GC=F',        // Gold Futures
  'BTC': 'BTC-USD',      // Bitcoin
};

/**
 * Get all benchmark symbols as array
 */
export function getAllBenchmarkSymbols(): string[] {
  return Object.values(BENCHMARK_SYMBOLS);
}
