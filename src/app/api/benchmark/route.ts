import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const symbol = searchParams.get('symbol');
        const start = searchParams.get('start');
        const end = searchParams.get('end');

        // Use period if provided, otherwise derive it (standard periods: 1D, 1W, 1M, YTD, 1Y, ALL)
        // Since the frontend fetches by date range, we might need to rely on the requested range 
        // OR simply cache by the requested range key. 
        // Ideally, we should pass the 'period' param from the frontend to make caching deterministic.
        // Let's check headers or infer period. For now, let's cache by symbol + 'start-end' key if period is missing,
        // but better to add 'period' to params in fetchBenchmarkData first? 
        // Actually, let's look at how fetchBenchmarkData constructs this. 
        // It calculates dates. It doesn't pass 'period'. 
        // To properly cache by period (which is cleaner), we should ideally send 'period' from frontend.
        // However, to avoid frontend changes right now if possible, we can use a composite key or just cache the latest request.
        // BUT, the schema I proposed uses 'period'. 
        // Let's modify the frontend `src/lib/benchmarkApi.ts` to pass `period` OR infer it here?
        // Inferring is risky. Let's assume we can add `period` param to the URL.
        const period = searchParams.get('period') || 'CUSTOM';

        if (!symbol || !start || !end) {
            return NextResponse.json(
                { error: 'Missing required parameters: symbol, start, end' },
                { status: 400 }
            );
        }

        // 1. Check Cache
        if (period !== 'CUSTOM') {
            const cached = await prisma.benchmarkCache.findUnique({
                where: {
                    symbol_period: {
                        symbol,
                        period
                    }
                }
            });

            if (cached) {
                const now = new Date();
                const currentHour = now.getHours();

                // Rule 1: Night Freeze (00:00 - 08:00)
                // If it's night time, we don't update, just return what we have (even if old)
                // Assuming we want to save API calls during inactive hours
                const isNightTime = currentHour >= 0 && currentHour < 8;

                if (isNightTime) {
                    console.log(`[BenchmarkCache] NIGHT FREEZE for ${symbol} (${period}) - Returning cached data`);
                    return NextResponse.json({ data: cached.data }, { status: 200 });
                }

                // Rule 2: Hourly Update at xx:00
                // We only use cache if it belongs to the CURRENT hour of the CURRENT day
                const cacheDate = new Date(cached.updatedAt);
                const isSameHour = cacheDate.getHours() === currentHour;
                const isSameDay = cacheDate.getDate() === now.getDate();
                const isSameMonth = cacheDate.getMonth() === now.getMonth();
                const isSameYear = cacheDate.getFullYear() === now.getFullYear();

                if (isSameYear && isSameMonth && isSameDay && isSameHour) {
                    console.log(`[BenchmarkCache] HIT for ${symbol} (${period}) - Fresh for this hour`);
                    return NextResponse.json({ data: cached.data }, { status: 200 });
                }

                console.log(`[BenchmarkCache] STALE for ${symbol} (${period}) - New hour, fetching fresh data...`);
            } else {
                console.log(`[BenchmarkCache] MISS for ${symbol} (${period})`);
            }
        }

        const startDate = new Date(start);
        const endDate = new Date(end);

        // 2. Fetch from Yahoo Finance
        // Use direct Yahoo Finance Chart API (more reliable than library)
        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${Math.floor(startDate.getTime() / 1000)}&period2=${Math.floor(endDate.getTime() / 1000)}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*'
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            // If fetch fails, try to return stale cache if available
            if (period !== 'CUSTOM') {
                const cached = await prisma.benchmarkCache.findUnique({
                    where: { symbol_period: { symbol, period } }
                });
                if (cached) {
                    console.warn(`[BenchmarkCache] Fetch failed, returning STALE data for ${symbol}`);
                    return NextResponse.json({ data: cached.data }, { status: 200 });
                }
            }

            return NextResponse.json(
                { error: 'Failed to fetch data from Yahoo Finance' },
                { status: response.status }
            );
        }

        const responseData = await response.json();
        const result = responseData.chart?.result?.[0];

        if (!result || !result.timestamp || !result.indicators?.quote?.[0]?.close) {
            return NextResponse.json(
                { error: 'No data found for the given symbol and period' },
                { status: 404 }
            );
        }

        const timestamps = result.timestamp;
        const closes = result.indicators.quote[0].close;

        // Transform data to our format
        const data = timestamps
            .map((ts: number, idx: number) => ({
                date: new Date(ts * 1000).toISOString(),
                value: closes[idx]
            }))
            .filter((item: any) => item.value != null && !isNaN(item.value));

        // 3. Update Cache
        if (period !== 'CUSTOM' && data.length > 0) {
            await prisma.benchmarkCache.upsert({
                where: {
                    symbol_period: {
                        symbol,
                        period
                    }
                },
                update: {
                    data: data,
                    updatedAt: new Date()
                },
                create: {
                    symbol,
                    period,
                    data: data
                }
            });
            console.log(`[BenchmarkCache] UPDATED for ${symbol} (${period})`);
        }

        return NextResponse.json({ data }, { status: 200 });
    } catch (error) {
        console.error('Error fetching benchmark data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch benchmark data', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
