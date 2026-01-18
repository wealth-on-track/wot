import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeToMidnight } from '@/lib/yahoo-finance';

export const dynamic = 'force-dynamic';

/**
 * GET /api/benchmark
 *
 * Hybrid approach for benchmark data:
 * 1. Historical data (>= 1 day old) → Fetch from BenchmarkPrice database
 * 2. Current day (intraday) → Fetch from Yahoo Finance real-time
 *
 * This minimizes API calls while keeping current data fresh
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const symbol = searchParams.get('symbol');
        const start = searchParams.get('start');
        const end = searchParams.get('end');
        const period = searchParams.get('period') || 'CUSTOM';

        if (!symbol || !start || !end) {
            return NextResponse.json(
                { error: 'Missing required parameters: symbol, start, end' },
                { status: 400 }
            );
        }

        const startDate = normalizeToMidnight(new Date(start));
        const endDate = normalizeToMidnight(new Date(end));
        const today = normalizeToMidnight(new Date());

        // ========================================
        // STEP 1: Fetch historical data from database
        // ========================================
        const historicalPrices = await prisma.benchmarkPrice.findMany({
            where: {
                symbol,
                date: {
                    gte: startDate,
                    lt: today, // Only historical (not today)
                },
            },
            orderBy: {
                date: 'asc',
            },
        });

        console.log(`[Benchmark] Found ${historicalPrices.length} historical prices for ${symbol}`);

        // Transform to standard format
        const historicalData = historicalPrices.map(p => ({
            date: p.date.toISOString(),
            value: p.price,
        }));

        // ========================================
        // STEP 2: Check if we need current day data
        // ========================================
        let needsCurrentDay = false;
        const now = new Date();

        // If end date is today or in the future, and current time is during market hours
        if (endDate >= today) {
            needsCurrentDay = true;
        }

        // ========================================
        // STEP 3: Fetch current day from Yahoo Finance if needed
        // ========================================
        // ========================================
        // STEP 3: Fetch current day from Yahoo Finance if needed
        // ========================================
        let currentDayData: Array<{ date: string; value: number }> = [];

        if (needsCurrentDay) {
            // Check if we have cached intraday data (for 1D period only)
            if (period === '1D') {
                const forceDate = searchParams.get('forceDate') === 'true';

                // Skip cache if forcing date
                if (forceDate) {
                    console.log(`[Benchmark] Fetching FORCED 1D data (1h interval) for ${symbol} on date ${startDate.toISOString().split('T')[0]}`);

                    // Yahoo Finance limitation: Hourly data is only available for recent dates
                    // Strategy: Fetch a 5-day window around the target date to maximize chances of getting hourly data

                    const targetDate = new Date(startDate);
                    targetDate.setHours(0, 0, 0, 0);

                    // Fetch 2 days before and 2 days after to ensure we get the target day
                    const fetchStart = new Date(targetDate);
                    fetchStart.setDate(fetchStart.getDate() - 2);

                    const fetchEnd = new Date(targetDate);
                    fetchEnd.setDate(fetchEnd.getDate() + 3);

                    // Fetch with 5-day range and 1h interval
                    const allData = await fetchFromYahooFinance(symbol, undefined, undefined, '1h', '5d');

                    // Filter to only the target date
                    currentDayData = allData.filter(point => {
                        const pointDate = new Date(point.date).toISOString().split('T')[0];
                        const targetDateStr = targetDate.toISOString().split('T')[0];
                        return pointDate === targetDateStr;
                    });

                    console.log(`[Benchmark] Received ${currentDayData.length} data points for forced date (filtered from ${allData.length} total)`);
                } else {
                    const cached = await prisma.benchmarkCache.findUnique({
                        where: { symbol_period: { symbol, period: '1D' } },
                    });

                    const cacheAge = cached ? Date.now() - cached.updatedAt.getTime() : Infinity;
                    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

                    if (cached && cacheAge < CACHE_TTL) {
                        console.log(`[Benchmark] Using cached 1D data for ${symbol}`);
                        currentDayData = cached.data as Array<{ date: string; value: number }>;
                    } else {
                        console.log(`[Benchmark] Fetching real-time 1D data (1h interval) for ${symbol}`);
                        // 'range=1d' returns the last active trading session
                        currentDayData = await fetchFromYahooFinance(symbol, undefined, undefined, '1h', '1d');

                        // Update cache
                        if (currentDayData.length > 0) {
                            await prisma.benchmarkCache.upsert({
                                where: { symbol_period: { symbol, period: '1D' } },
                                update: { data: currentDayData, updatedAt: new Date() },
                                create: { symbol, period: '1D', data: currentDayData },
                            });
                        }
                    }
                }
            } else {
                // For longer periods, just get today's latest price
                console.log(`[Benchmark] Fetching today's price for ${symbol}`);
                const latestPrice = await fetchLatestPrice(symbol);
                if (latestPrice) {
                    currentDayData = [{
                        date: now.toISOString(),
                        value: latestPrice,
                    }];
                }
            }
        }

        // ========================================
        // STEP 4: Combine historical + current day
        // ========================================
        const combinedData = [...historicalData, ...currentDayData];

        console.log(`[Benchmark] Returning ${combinedData.length} data points for ${symbol} (${historicalData.length} historical + ${currentDayData.length} current)`);

        return NextResponse.json({
            data: combinedData,
            source: {
                historical: historicalPrices.length,
                realtime: currentDayData.length,
            }
        }, { status: 200 });

    } catch (error) {
        console.error('Error fetching benchmark data:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch benchmark data',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

/**
 * Fetch intraday data from Yahoo Finance
 */
async function fetchFromYahooFinance(
    symbol: string,
    start?: Date,
    end?: Date,
    interval: string = '1d',
    range?: string
): Promise<Array<{ date: string; value: number }>> {
    try {
        let url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}`;

        if (range) {
            url += `&range=${range}`;
        } else if (start && end) {
            url += `&period1=${Math.floor(start.getTime() / 1000)}&period2=${Math.floor(end.getTime() / 1000)}`;
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            console.error(`Yahoo Finance API error for ${symbol}: ${response.status}`);
            return [];
        }

        const responseData = await response.json();
        const result = responseData.chart?.result?.[0];

        if (!result || !result.timestamp || !result.indicators?.quote?.[0]?.close) {
            return [];
        }

        const timestamps = result.timestamp;
        const closes = result.indicators.quote[0].close;

        return timestamps
            .map((ts: number, idx: number) => ({
                date: new Date(ts * 1000).toISOString(),
                value: closes[idx],
            }))
            .filter((item: any) => item.value != null && !isNaN(item.value));
    } catch (error) {
        console.error(`Error fetching from Yahoo Finance for ${symbol}:`, error);
        return [];
    }
}

/**
 * Fetch latest price from Yahoo Finance
 */
async function fetchLatestPrice(symbol: string): Promise<number | null> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });

        if (!response.ok) return null;

        const data = await response.json();
        const result = data.chart?.result?.[0];

        if (!result?.meta?.regularMarketPrice) return null;

        return result.meta.regularMarketPrice;
    } catch (error) {
        console.error(`Error fetching latest price for ${symbol}:`, error);
        return null;
    }
}
