/**
 * Add Gold and Bitcoin Historical Data
 */

import { PrismaClient } from '@prisma/client';
import {
  fetchHistoricalPrices,
  normalizeToMidnight,
} from '../src/lib/yahoo-finance';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Adding Gold and Bitcoin Data ===\n');

  const symbols = ['GC=F', 'BTC-USD'];
  const DAYS_TO_FETCH = 365; // 1 year

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

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  ❌ Error processing ${symbol}:`, error);
    }
  }

  console.log('\n✅ Gold and Bitcoin data added!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
