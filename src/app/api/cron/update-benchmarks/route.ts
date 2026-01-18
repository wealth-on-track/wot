import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeToMidnight } from '@/lib/yahoo-finance';

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
    // Fetch last 2 years (approx 730 days) to be safe for 1Y/YTD charts
    const end = Math.floor(Date.now() / 1000);
    const start = end - (730 * 24 * 60 * 60);

    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${start}&period2=${end}`;

    try {
        const response = await fetch(url, {
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
        })).filter((item: any) => item.price != null);

    } catch (e) {
        console.error(`Error fetching ${symbol}:`, e);
        return null;
    }
}

export async function GET() {
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

            // Batch create/update
            // Since we can't do massive "upsertMany" easily in Prisma without raw SQL or loops
            // We'll use a transaction with individual upserts or delete/create for range
            // For simplicity and robustness, let's just upsert the last 30 days individually
            // AND doing a full seed if it's the first time?
            // Actually, "createMany" with "skipDuplicates" is best for history, but updates won't happen.
            // But history doesn't change much. Only today/yesterday changes.

            // Strategy: 
            // 1. Delete records for this symbol in the date range to avoid conflicts? No, risky.
            // 2. Loop and upsert. A bit slow but safe for 730 records x 5 assets = 3500 ops.
            //    Prisma transaction can handle it.

            // Optimization: Filter out dates that already exist? 
            // Let's just createMany with skipDuplicates for bulk history
            // And then upsert the last 5 days to ensure latest data is correct.

            const normalizedData = data.map((d: any) => ({
                symbol: bench.symbol,
                date: normalizeToMidnight(d.date),
                price: d.price
            }));

            // 1. Try to bulk insert everything (ignoring duplicates)
            // This fills in any missing history efficiently
            await prisma.benchmarkPrice.createMany({
                data: normalizedData,
                skipDuplicates: true,
            });

            // 2. Explicitly update the last 14 days to catch any data corrections/adjustments
            // (Yahoo sometimes updates recent closes)
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

    } catch (error: any) {
        console.error('[Cron] Benchmark update failed:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
