/**
 * Quick Category Check Script
 *
 * Shows current distribution of assets by category
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCategories() {
  console.log('📊 Current Asset Distribution by Category\n');
  console.log('='.repeat(60));

  try {
    // Get category counts
    const categoryCounts = await prisma.asset.groupBy({
      by: ['category'],
      _count: true,
      orderBy: {
        _count: {
          category: 'desc'
        }
      }
    });

    // Get total count
    const totalAssets = await prisma.asset.count();

    // Display results
    console.log('Category'.padEnd(20) + 'Count'.padEnd(10) + 'Percentage');
    console.log('-'.repeat(60));

    categoryCounts.forEach(({ category, _count }) => {
      const percentage = (((_count as any) / totalAssets) * 100).toFixed(1);
      const bar = '█'.repeat(Math.floor((_count as any) / 2));
      console.log(
        `${category.padEnd(20)}${(_count as any).toString().padEnd(10)}${percentage}%  ${bar}`
      );
    });

    console.log('-'.repeat(60));
    console.log(`TOTAL: ${totalAssets} assets\n`);

    // Show recent additions
    console.log('📝 Recent Assets (Last 5):\n');
    const recentAssets = await prisma.asset.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        symbol: true,
        category: true,
        type: true,
        exchange: true,
        sector: true,
        country: true,
        createdAt: true
      }
    });

    recentAssets.forEach((asset, idx) => {
      console.log(`${idx + 1}. ${asset.symbol.padEnd(12)} | ${asset.category.padEnd(15)} | ${asset.exchange.padEnd(20)} | ${asset.country}`);
      console.log(`   Type: ${asset.type}, Sector: ${asset.sector}`);
      console.log(`   Added: ${new Date(asset.createdAt).toLocaleString()}\n`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCategories();
