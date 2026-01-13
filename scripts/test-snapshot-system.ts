/**
 * Test Snapshot System
 *
 * This script tests and visualizes the snapshot system
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== 📊 Snapshot System Test ===\n');

  // 1. Check Portfolio Snapshots
  console.log('1️⃣  Portfolio Snapshots:\n');

  const portfolios = await prisma.portfolio.findMany({
    include: {
      user: true,
      snapshots: {
        orderBy: { date: 'desc' },
        take: 5,
      },
    },
  });

  for (const portfolio of portfolios) {
    console.log(`👤 User: ${portfolio.user.username}`);
    console.log(`📁 Portfolio ID: ${portfolio.id}`);
    console.log(`📸 Snapshots: ${portfolio.snapshots.length > 0 ? portfolio.snapshots.length : 'No snapshots yet'}`);

    if (portfolio.snapshots.length > 0) {
      console.log('   Recent snapshots:');
      portfolio.snapshots.forEach((snapshot, idx) => {
        const date = snapshot.date.toISOString().split('T')[0];
        const value = snapshot.totalValue.toFixed(2);
        console.log(`   ${idx + 1}. ${date}: €${value}`);
      });

      // Calculate change if we have multiple snapshots
      if (portfolio.snapshots.length >= 2) {
        const latest = portfolio.snapshots[0];
        const previous = portfolio.snapshots[1];
        const change = latest.totalValue - previous.totalValue;
        const changePercent = (change / previous.totalValue) * 100;
        const arrow = change >= 0 ? '📈' : '📉';
        console.log(`   ${arrow} Change: €${change.toFixed(2)} (${changePercent.toFixed(2)}%)`);
      }
    }
    console.log('');
  }

  // 2. Check Benchmark Prices
  console.log('\n2️⃣  Benchmark Prices:\n');

  const benchmarks = ['^GSPC', '^IXIC', '^DJI', 'XU100.IS', '^FTSE', '^GDAXI'];

  for (const symbol of benchmarks) {
    const prices = await prisma.benchmarkPrice.findMany({
      where: { symbol },
      orderBy: { date: 'desc' },
      take: 5,
    });

    console.log(`📊 ${symbol}:`);
    console.log(`   Data points: ${prices.length}`);

    if (prices.length > 0) {
      console.log('   Recent prices:');
      prices.forEach((price, idx) => {
        const date = price.date.toISOString().split('T')[0];
        console.log(`   ${idx + 1}. ${date}: $${price.price.toFixed(2)}`);
      });

      // Calculate change
      if (prices.length >= 2) {
        const latest = prices[0];
        const previous = prices[1];
        const change = latest.price - previous.price;
        const changePercent = (change / previous.price) * 100;
        const arrow = change >= 0 ? '📈' : '📉';
        console.log(`   ${arrow} Daily change: $${change.toFixed(2)} (${changePercent.toFixed(2)}%)`);
      }
    }
    console.log('');
  }

  // 3. Summary Statistics
  console.log('\n3️⃣  System Statistics:\n');

  const totalSnapshots = await prisma.portfolioSnapshot.count();
  const totalBenchmarkPrices = await prisma.benchmarkPrice.count();

  console.log(`📸 Total Portfolio Snapshots: ${totalSnapshots}`);
  console.log(`📊 Total Benchmark Prices: ${totalBenchmarkPrices}`);

  // Get date range
  const oldestSnapshot = await prisma.portfolioSnapshot.findFirst({
    orderBy: { date: 'asc' },
  });

  const newestSnapshot = await prisma.portfolioSnapshot.findFirst({
    orderBy: { date: 'desc' },
  });

  if (oldestSnapshot && newestSnapshot) {
    const oldest = oldestSnapshot.date.toISOString().split('T')[0];
    const newest = newestSnapshot.date.toISOString().split('T')[0];
    console.log(`📅 Snapshot date range: ${oldest} → ${newest}`);
  }

  const oldestBenchmark = await prisma.benchmarkPrice.findFirst({
    orderBy: { date: 'asc' },
  });

  const newestBenchmark = await prisma.benchmarkPrice.findFirst({
    orderBy: { date: 'desc' },
  });

  if (oldestBenchmark && newestBenchmark) {
    const oldest = oldestBenchmark.date.toISOString().split('T')[0];
    const newest = newestBenchmark.date.toISOString().split('T')[0];
    console.log(`📅 Benchmark date range: ${oldest} → ${newest}`);
  }

  // 4. Test: What will happen tomorrow?
  console.log('\n4️⃣  Tomorrow\'s Snapshot Simulation:\n');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  console.log(`📅 Tomorrow: ${tomorrow.toISOString().split('T')[0]}`);
  console.log('✅ When cron runs at 00:00:');
  console.log('   1. Fetch current prices for all assets');
  console.log('   2. Calculate total value for each portfolio in EUR');
  console.log('   3. Create snapshot with date = tomorrow');
  console.log('   4. Fetch closing prices for all benchmarks');
  console.log('   5. Save benchmark prices with date = tomorrow');
  console.log('\n   Then users can see:');
  console.log('   - Portfolio performance: Compare today vs yesterday/week/month');
  console.log('   - Benchmark comparison: See how portfolio performs vs S&P500, NASDAQ, etc.');

  console.log('\n✅ All tests completed!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
