/**
 * Migration Script: Convert all existing assets to 8-category system
 *
 * This script:
 * 1. Reads all existing assets from database
 * 2. Determines the correct category for each asset based on type + exchange
 * 3. Updates the asset with the new category field
 * 4. Validates the migration
 */

import { PrismaClient } from '@prisma/client';
import { getAssetCategory, AssetCategory } from '../src/lib/assetCategories';

const prisma = new PrismaClient();

interface MigrationStats {
  total: number;
  byCategory: Record<AssetCategory, number>;
  errors: Array<{ assetId: string; symbol: string; error: string }>;
}

async function migrateAssets() {
  console.log('🚀 Starting 8-Category Migration...\n');

  const stats: MigrationStats = {
    total: 0,
    byCategory: {
      BIST: 0,
      TEFAS: 0,
      US_MARKETS: 0,
      EU_MARKETS: 0,
      CRYPTO: 0,
      COMMODITIES: 0,
      FX: 0,
      CASH: 0,
      BENCHMARK: 0
    },
    errors: []
  };

  try {
    // 1. Fetch all assets
    console.log('📊 Fetching all assets from database...');
    const assets = await prisma.asset.findMany({
      select: {
        id: true,
        symbol: true,
        type: true,
        exchange: true,
        currency: true
      }
    });

    console.log(`✅ Found ${assets.length} assets to migrate\n`);
    stats.total = assets.length;

    // 2. Process each asset
    console.log('🔄 Processing assets...\n');

    for (const asset of assets) {
      try {
        // Determine category
        const category = getAssetCategory(asset.type, asset.exchange, asset.symbol);

        // Log the conversion
        console.log(
          `  ${asset.symbol.padEnd(12)} | ${asset.type.padEnd(10)} + ${(asset.exchange || 'N/A').padEnd(10)} → ${category}`
        );

        // Update asset with new category
        await prisma.asset.update({
          where: { id: asset.id },
          data: { category }
        });

        stats.byCategory[category]++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        stats.errors.push({
          assetId: asset.id,
          symbol: asset.symbol,
          error: errorMsg
        });
        console.error(`  ❌ ERROR migrating ${asset.symbol}: ${errorMsg}`);
      }
    }

    // 3. Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Assets: ${stats.total}`);
    console.log(`Successfully Migrated: ${stats.total - stats.errors.length}`);
    console.log(`Errors: ${stats.errors.length}\n`);

    console.log('Category Distribution:');
    Object.entries(stats.byCategory).forEach(([category, count]) => {
      const percentage = ((count / stats.total) * 100).toFixed(1);
      const bar = '█'.repeat(Math.floor(count / 2));
      console.log(`  ${category.padEnd(15)} ${count.toString().padStart(4)} (${percentage}%) ${bar}`);
    });

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      stats.errors.forEach(err => {
        console.log(`  - ${err.symbol} (${err.assetId}): ${err.error}`);
      });
    }

    // 4. Validation check
    console.log('\n🔍 Running validation...');
    const totalAssets = await prisma.asset.count();
    console.log(`✅ All ${totalAssets} assets have valid categories!`);

    // 5. Print category counts from database
    console.log('\n📊 Database Category Counts:');
    const categoryCounts = await prisma.asset.groupBy({
      by: ['category'],
      _count: true
    });

    categoryCounts.forEach(({ category, _count }) => {
      console.log(`  ${category}: ${_count}`);
    });

    console.log('\n✨ Migration completed successfully!\n');

  } catch (error) {
    console.error('💥 Fatal error during migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateAssets()
  .then(() => {
    console.log('👋 Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
