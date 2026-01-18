/**
 * Benchmark API Service
 * Fetches historical data for benchmark assets (Gold, NASDAQ, S&P500, BIST100, Bitcoin)
 */

export interface BenchmarkDataPoint {
    date: string; // ISO date string
    value: number;
    change?: number; // % change from previous point
}

export interface BenchmarkAsset {
    id: string;
    name: string;
    symbol: string;
    color: string;
}

export const BENCHMARK_ASSETS: BenchmarkAsset[] = [
    { id: 'SPX', name: 'S&P 500', symbol: '^GSPC', color: '#0088FE' },
    { id: 'IXIC', name: 'NASDAQ', symbol: '^IXIC', color: '#00C805' },
    { id: 'BIST100', name: 'BIST 100', symbol: 'XU100.IS', color: '#FF4444' },
    { id: 'GOLD', name: 'Gold', symbol: 'GC=F', color: '#FFD700' },
    { id: 'BTC', name: 'Bitcoin', symbol: 'BTC-USD', color: '#F7931A' },
];

/**
 * Fetch historical data for a benchmark asset
 * Uses Yahoo Finance API
 */
export async function fetchBenchmarkData(
    symbol: string,
    period: '1D' | '1W' | '1M' | 'YTD' | '1Y' | 'ALL',
    specificDate?: string // Optional: Force a specific date for 1D (YYYY-MM-DD)
): Promise<BenchmarkDataPoint[]> {
    try {
        // Calculate date range based on period
        const now = new Date();
        let startDate = new Date();
        let endDate = new Date(); // Default to now

        if (specificDate && period === '1D') {
            // Force specific date logic
            startDate = new Date(specificDate);
            startDate.setHours(0, 0, 0, 0);

            endDate = new Date(specificDate);
            endDate.setHours(23, 59, 59, 999);
        } else {
            switch (period) {
                case '1D':
                    startDate.setDate(now.getDate() - 1);
                    break;
                case '1W':
                    startDate.setDate(now.getDate() - 7);
                    break;
                case '1M':
                    startDate.setMonth(now.getMonth() - 1);
                    break;
                case 'YTD':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    break;
                case '1Y':
                    startDate.setFullYear(now.getFullYear() - 1);
                    break;
                case 'ALL':
                    startDate.setFullYear(now.getFullYear() - 5); // 5 years max
                    break;
            }
        }

        // Call our API endpoint with period parameter
        let url = `/api/benchmark?symbol=${encodeURIComponent(symbol)}&start=${startDate.toISOString()}&end=${endDate.toISOString()}&period=${period}`;

        if (specificDate) {
            url += '&forceDate=true';
        }

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch benchmark data: ${response.statusText}`);
        }

        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error('Error fetching benchmark data:', error);
        return [];
    }
}

/**
 * Calculate percentage change between two values
 */
export function calculateChange(current: number, previous: number): number {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
}

/**
 * Normalize data to percentage change from start
 */
export function normalizeToPercentage(data: BenchmarkDataPoint[]): BenchmarkDataPoint[] {
    if (data.length === 0) return [];

    // Find first valid (non-null, non-zero) value
    const firstValidPoint = data.find(p => p.value != null && p.value > 0);
    if (!firstValidPoint) return data; // Return as-is if no valid data

    const firstValue = firstValidPoint.value;

    return data.map(point => ({
        ...point,
        change: point.value != null ? calculateChange(point.value, firstValue) : 0
    }));
}
