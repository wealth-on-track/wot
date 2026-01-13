/**
 * Populate Initial Data Script
 *
 * This script populates the database with:
 * 1. Historical benchmark prices (past 1 year)
 * 2. Portfolio snapshots for existing portfolios
 *
 * Usage: npx tsx scripts/populate-initial-data.ts
 */

import { PrismaClient } from '@prisma/client';
import {
  getAllBenchmarkSymbols,
  fetchHistoricalPrices,
  normalizeToMidnight,
  fetchBatchPrices,
} from '../src/lib/yahoo-finance';

const prisma = new PrismaClient();

async function populateBenchmarkPrices() {
  console.log('\n=== Populating Benchmark Prices ===\n');

  const symbols = getAllBenchmarkSymbols();
  const DAYS_TO_FETCH = 365; // 1 year of history

  console.log(`Fetching ${DAYS_TO_FETCH} days of historical data for ${symbols.length} benchmarks...`);

  for (const symbol of symbols) {
    console.log(`\nProcessing ${symbol}...`);

    try {
      const historicalData = await fetchHistoricalPrices(symbol, DAYS_TO_FETCH);

      if (!historicalData || historicalData.prices.length === 0) {
        console.error(`  ❌ No data found for ${symbol}`);
        continue;
      }

      console.log(`  ✓ Fetched ${historicalData.prices.length} data points`);

      let inserted = 0;
      let skipped = 0;

      for (const pricePoint of historicalData.prices) {
        try {
          const normalizedDate = normalizeToMidnight(pricePoint.date);

          // Check if already exists
          const existing = await prisma.benchmarkPrice.findUnique({
            where: {
              symbol_date: {
                symbol,
                date: normalizedDate,
              },
            },
          });

          if (existing) {
            skipped++;
            continue;
          }

          // Insert new price
          await prisma.benchmarkPrice.create({
            data: {
              symbol,
              date: normalizedDate,
              price: pricePoint.price,
            },
          });

          inserted++;
        } catch (error) {
          console.error(`  ❌ Error inserting price for ${symbol} on ${pricePoint.date}:`, error);
        }
      }

      console.log(`  ✓ Inserted: ${inserted}, Skipped: ${skipped}`);

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  ❌ Error processing ${symbol}:`, error);
    }
  }

  console.log('\n✅ Benchmark prices population completed!\n');
}

async function populatePortfolioSnapshots() {
  console.log('\n=== Populating Portfolio Snapshots ===\n');

  // Fetch all portfolios with assets
  const portfolios = await prisma.portfolio.findMany({
    include: {
      assets: true,
    },
  });

  console.log(`Found ${portfolios.length} portfolios to process`);

  if (portfolios.length === 0) {
    console.log('No portfolios found. Skipping snapshot creation.');
    return;
  }

  // Get all unique symbols
  const allSymbols = Array.from(
    new Set(
      portfolios.flatMap(p =>
        p.assets.map(a => a.symbol)
      )
    )
  );

  console.log(`Fetching current prices for ${allSymbols.length} unique symbols...`);

  // Fetch all current prices
  const priceData = await fetchBatchPrices(allSymbols);
  const priceMap = new Map(
    priceData.map(p => [p.symbol, p.price])
  );

  console.log(`Successfully fetched ${priceData.length} prices`);

  // Get exchange rates
  const exchangeRates = await prisma.exchangeRate.findMany();
  const rateMap = new Map(
    exchangeRates.map(r => [r.currency, r.rate])
  );

  const today = normalizeToMidnight(new Date());

  // Create snapshots
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
        console.log(`  ⚠️  Snapshot already exists for portfolio ${portfolio.id}`);
        continue;
      }

      // Calculate total value in EUR
      let totalValueEUR = 0;

      for (const asset of portfolio.assets) {
        const currentPrice = priceMap.get(asset.symbol);
        if (!currentPrice) {
          console.warn(`  ⚠️  No price found for ${asset.symbol}, using buy price`);
          // Fallback to buy price
          let valueInEUR = asset.quantity * asset.buyPrice;
          if (asset.currency !== 'EUR') {
            const rate = rateMap.get(asset.currency);
            if (rate) {
              valueInEUR = valueInEUR / rate;
            }
          }
          totalValueEUR += valueInEUR;
          continue;
        }

        let valueInEUR = asset.quantity * currentPrice;

        // Convert to EUR if needed
        if (asset.currency !== 'EUR') {
          const rate = rateMap.get(asset.currency);
          if (rate) {
            valueInEUR = valueInEUR / rate;
          } else {
            console.warn(`  ⚠️  No exchange rate found for ${asset.currency}`);
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

      console.log(`  ✓ Created snapshot for portfolio ${portfolio.id}: €${totalValueEUR.toFixed(2)}`);
    } catch (error) {
      console.error(`  ❌ Error creating snapshot for portfolio ${portfolio.id}:`, error);
    }
  }

  console.log('\n✅ Portfolio snapshots population completed!\n');
}

async function main() {
  console.log('\n🚀 Starting Initial Data Population...\n');

  try {
    // Step 1: Populate benchmark prices
    await populateBenchmarkPrices();

    // Step 2: Create portfolio snapshots
    await populatePortfolioSnapshots();

    console.log('\n✅ All data population completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Fatal error during data population:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
