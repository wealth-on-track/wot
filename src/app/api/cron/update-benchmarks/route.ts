import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeToMidnight } from '@/lib/yahoo-finance';
import { verifyCronAuth, sanitizeError } from '@/lib/api-security';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

const BENCHMARKS = [
    { symbol: '^GSPC', name: 'S&P 500' },
    { symbol: '^IXIC', name: 'NASDAQ' },
    { symbol: 'XU100.IS', name: 'BIST 100' },
    { symbol: 'GC=F', name: 'Gold' },
    { symbol: 'BTC-USD', name: 'Bitcoin' }
];

async function fetchHistoricalData(symbol: string) {
    // Fetch last 2 years (approx 730 days)
    const end = Math.floor(Date.now() / 1000);
    const start = end - (730 * 24 * 60 * 60);

    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${start}&period2=${end}`;

    try {
        const response = await fetchWithTimeout(url, {
            timeout: 30000, // 30 second timeout
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            console.error(`Failed to fetch ${symbol}: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const result = data.chart?.result?.[0];

        if (!result || !result.timestamp || !result.indicators?.quote?.[0]?.close) {
            return null;
        }

        const timestamps = result.timestamp;
        const closes = result.indicators.quote[0].close;

        return timestamps.map((ts: number, i: number) => ({
            date: new Date(ts * 1000),
            price: closes[i]
        })).filter((item: { date: Date; price: number | null }) => item.price != null);

    } catch (e) {
        console.error(`Error fetching ${symbol}:`, e);
        return null;
    }
}

/**
 * Benchmark Update Cron Job
 *
 * Security:
 * - Requires CRON_SECRET authentication (mandatory in production)
 */
export async function GET(request: NextRequest) {
    // Verify CRON authentication
    const authError = verifyCronAuth(request);
    if (authError) {
        return authError;
    }

    console.log('[Cron] Starting Daily Benchmark Update...');
    const results = [];

    try {
        for (const bench of BENCHMARKS) {
            console.log(`[Cron] Updating ${bench.name} (${bench.symbol})...`);
            const data = await fetchHistoricalData(bench.symbol);

            if (!data || data.length === 0) {
                console.log(`[Cron] No data found for ${bench.symbol}`);
                results.push({ symbol: bench.symbol, status: 'failed', reason: 'no_data' });
                continue;
            }

            console.log(`[Cron] Got ${data.length} data points for ${bench.symbol}. Saving to DB...`);

            const normalizedData = data.map((d: { date: Date; price: number }) => ({
                symbol: bench.symbol,
                date: normalizeToMidnight(d.date),
                price: d.price
            }));

            // 1. Bulk insert (ignoring duplicates)
            await prisma.benchmarkPrice.createMany({
                data: normalizedData,
                skipDuplicates: true,
            });

            // 2. Update last 14 days for data corrections
            const recentData = normalizedData.slice(-14);
            for (const item of recentData) {
                await prisma.benchmarkPrice.upsert({
                    where: {
                        symbol_date: {
                            symbol: item.symbol,
                            date: item.date
                        }
                    },
                    update: { price: item.price },
                    create: item
                });
            }

            results.push({ symbol: bench.symbol, status: 'success', count: data.length });
        }

        return NextResponse.json({ success: true, results });

    } catch (error) {
        const sanitized = sanitizeError(error, 'Benchmark update failed');
        console.error('[Cron] Benchmark update failed:', error);
        return NextResponse.json(
            { success: false, error: sanitized.error, code: sanitized.code },
            { status: sanitized.status }
        );
    }
}
