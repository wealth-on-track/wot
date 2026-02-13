import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    fetchBatchPrices,
    getAllBenchmarkSymbols,
    normalizeToMidnight,
} from '@/lib/yahoo-finance';
import { verifyCronAuth, sanitizeError } from '@/lib/api-security';

/**
 * Daily Snapshot Cron Job
 *
 * This endpoint is triggered by Vercel Cron every day at 00:00 UTC
 * It performs two tasks:
 * 1. Creates portfolio snapshots for all users
 * 2. Updates benchmark prices
 *
 * Security:
 * - Requires CRON_SECRET authentication (mandatory in production)
 * - Rate limited by Vercel Cron
 */
export async function GET(request: NextRequest) {
    try {
        // Verify CRON authentication
        const authError = verifyCronAuth(request);
        if (authError) {
            return authError;
        }

        const today = normalizeToMidnight(new Date());
        const results = {
            portfolioSnapshots: 0,
            benchmarkPrices: 0,
            errors: [] as string[],
        };

        // ========================================
        // STEP 1: Create Portfolio Snapshots
        // ========================================
        console.log('[CRON] Starting portfolio snapshot creation...');

        try {
            // Fetch all portfolios with their assets
            const portfolios = await prisma.portfolio.findMany({
                include: {
                    Asset: true,
                },
            });

            console.log(`[CRON] Found ${portfolios.length} portfolios to process`);

            // Get all unique symbols from all portfolios
            const allSymbols = Array.from(
                new Set(
                    portfolios.flatMap(p =>
                        p.Asset.map(a => a.symbol)
                    )
                )
            );

            console.log(`[CRON] Fetching prices for ${allSymbols.length} unique symbols...`);

            // Fetch all prices in batch
            const priceData = await fetchBatchPrices(allSymbols);
            const priceMap = new Map(
                priceData.map(p => [p.symbol, p.price])
            );

            console.log(`[CRON] Successfully fetched ${priceData.length} prices`);

            // Get exchange rates
            const exchangeRates = await prisma.exchangeRate.findMany();
            const rateMap = new Map(
                exchangeRates.map(r => [r.currency, r.rate])
            );

            // Batch check existing snapshots to avoid N+1 queries
            const portfolioIds = portfolios.map(p => p.id);
            const existingSnapshots = await prisma.portfolioSnapshot.findMany({
                where: {
                    portfolioId: { in: portfolioIds },
                    date: today,
                },
                select: { portfolioId: true },
            });
            const existingSnapshotIds = new Set(existingSnapshots.map(s => s.portfolioId));

            // Create snapshots for each portfolio
            for (const portfolio of portfolios) {
                try {
                    // Skip if snapshot already exists
                    if (existingSnapshotIds.has(portfolio.id)) {
                        console.log(`[CRON] Snapshot already exists for portfolio ${portfolio.id}`);
                        continue;
                    }

                    // Calculate total value in EUR
                    let totalValueEUR = 0;

                    for (const asset of portfolio.Asset) {
                        const currentPrice = priceMap.get(asset.symbol);
                        if (!currentPrice) {
                            console.warn(`[CRON] No price found for ${asset.symbol}`);
                            continue;
                        }

                        let valueInEUR = asset.quantity * currentPrice;

                        // Convert to EUR if needed
                        if (asset.currency !== 'EUR') {
                            const rate = rateMap.get(asset.currency);
                            if (rate) {
                                valueInEUR = valueInEUR / rate;
                            } else {
                                console.warn(`[CRON] No exchange rate found for ${asset.currency}`);
                            }
                        }

                        totalValueEUR += valueInEUR;
                    }

                    // Create snapshot
                    await prisma.portfolioSnapshot.create({
                        data: {
                            portfolioId: portfolio.id,
                            date: today,
                            totalValue: totalValueEUR,
                        },
                    });

                    results.portfolioSnapshots++;
                    console.log(`[CRON] Created snapshot for portfolio ${portfolio.id}: €${totalValueEUR.toFixed(2)}`);
                } catch (error) {
                    const errorMsg = `Failed to create snapshot for portfolio ${portfolio.id}`;
                    console.error(`[CRON] ${errorMsg}:`, error);
                    results.errors.push(errorMsg);
                }
            }
        } catch (error) {
            const errorMsg = 'Portfolio snapshot creation failed';
            console.error(`[CRON] ${errorMsg}:`, error);
            results.errors.push(errorMsg);
        }

        // ========================================
        // STEP 2: Update Benchmark Prices
        // ========================================
        console.log('[CRON] Starting benchmark price updates...');

        try {
            const benchmarkSymbols = getAllBenchmarkSymbols();
            console.log(`[CRON] Fetching prices for ${benchmarkSymbols.length} benchmarks...`);

            const benchmarkPrices = await fetchBatchPrices(benchmarkSymbols);

            // Batch check existing benchmark prices
            const existingBenchmarks = await prisma.benchmarkPrice.findMany({
                where: {
                    symbol: { in: benchmarkSymbols },
                    date: today,
                },
                select: { symbol: true },
            });
            const existingBenchmarkSymbols = new Set(existingBenchmarks.map(b => b.symbol));

            for (const priceData of benchmarkPrices) {
                try {
                    // Skip if price already exists
                    if (existingBenchmarkSymbols.has(priceData.symbol)) {
                        console.log(`[CRON] Benchmark price already exists for ${priceData.symbol}`);
                        continue;
                    }

                    // Create new benchmark price
                    await prisma.benchmarkPrice.create({
                        data: {
                            symbol: priceData.symbol,
                            date: today,
                            price: priceData.price,
                        },
                    });

                    results.benchmarkPrices++;
                    console.log(`[CRON] Saved benchmark price for ${priceData.symbol}: ${priceData.price}`);
                } catch (error) {
                    const errorMsg = `Failed to save benchmark price for ${priceData.symbol}`;
                    console.error(`[CRON] ${errorMsg}:`, error);
                    results.errors.push(errorMsg);
                }
            }
        } catch (error) {
            const errorMsg = 'Benchmark price update failed';
            console.error(`[CRON] ${errorMsg}:`, error);
            results.errors.push(errorMsg);
        }

        // ========================================
        // Return Results
        // ========================================
        console.log('[CRON] Daily snapshot cron job completed');
        console.log(`[CRON] Portfolio snapshots created: ${results.portfolioSnapshots}`);
        console.log(`[CRON] Benchmark prices saved: ${results.benchmarkPrices}`);
        console.log(`[CRON] Errors: ${results.errors.length}`);

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            results: {
                portfolioSnapshots: results.portfolioSnapshots,
                benchmarkPrices: results.benchmarkPrices,
                errorCount: results.errors.length,
            },
        });
    } catch (error) {
        const sanitized = sanitizeError(error, 'Cron job failed');
        console.error('[CRON] Fatal error:', error);
        return NextResponse.json(
            { success: false, error: sanitized.error, code: sanitized.code },
            { status: sanitized.status }
        );
    }
}
