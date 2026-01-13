import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  fetchBatchPrices,
  getAllBenchmarkSymbols,
  normalizeToMidnight,
} from '@/lib/yahoo-finance';

/**
 * Daily Snapshot Cron Job
 *
 * This endpoint is triggered by Vercel Cron every day at 00:00 UTC
 * It performs two tasks:
 * 1. Creates portfolio snapshots for all users
 * 2. Updates benchmark prices
 *
 * Authorization: Vercel Cron Secret
 */
export async function GET(request: Request) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
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
          assets: true,
        },
      });

      console.log(`[CRON] Found ${portfolios.length} portfolios to process`);

      // Get all unique symbols from all portfolios
      const allSymbols = Array.from(
        new Set(
          portfolios.flatMap(p =>
            p.assets.map(a => a.symbol)
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

      // Get exchange rates (assuming you have these cached)
      const exchangeRates = await prisma.exchangeRate.findMany();
      const rateMap = new Map(
        exchangeRates.map(r => [r.currency, r.rate])
      );

      // Create snapshots for each portfolio
      for (const portfolio of portfolios) {
        try {
          // Check if snapshot already exists for today
          const existingSnapshot = await prisma.portfolioSnapshot.findUnique({
            where: {
              portfolioId_date: {
                portfolioId: portfolio.id,
                date: today,
              },
            },
          });

          if (existingSnapshot) {
            console.log(`[CRON] Snapshot already exists for portfolio ${portfolio.id}`);
            continue;
          }

          // Calculate total value in EUR
          let totalValueEUR = 0;

          for (const asset of portfolio.assets) {
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
          const errorMsg = `Failed to create snapshot for portfolio ${portfolio.id}: ${error}`;
          console.error(`[CRON] ${errorMsg}`);
          results.errors.push(errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = `Portfolio snapshot creation failed: ${error}`;
      console.error(`[CRON] ${errorMsg}`);
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

      for (const priceData of benchmarkPrices) {
        try {
          // Check if price already exists for today
          const existingPrice = await prisma.benchmarkPrice.findUnique({
            where: {
              symbol_date: {
                symbol: priceData.symbol,
                date: today,
              },
            },
          });

          if (existingPrice) {
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
          const errorMsg = `Failed to save benchmark price for ${priceData.symbol}: ${error}`;
          console.error(`[CRON] ${errorMsg}`);
          results.errors.push(errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = `Benchmark price update failed: ${error}`;
      console.error(`[CRON] ${errorMsg}`);
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
      results,
    });
  } catch (error) {
    console.error('[CRON] Fatal error in daily snapshot cron job:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
