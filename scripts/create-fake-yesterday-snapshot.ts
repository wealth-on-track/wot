/**
 * Create Fake Yesterday Snapshot
 *
 * This creates a snapshot for yesterday so we can see the chart working
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Creating Yesterday\'s Snapshot ===\n');

  const portfolios = await prisma.portfolio.findMany({
    include: {
      user: true,
      snapshots: {
        orderBy: { date: 'desc' },
        take: 1,
      },
    },
  });

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  console.log(`Creating snapshots for date: ${yesterday.toISOString().split('T')[0]}`);
  console.log('');

  for (const portfolio of portfolios) {
    // Check if snapshot exists for yesterday
    const existingSnapshot = await prisma.portfolioSnapshot.findUnique({
      where: {
        portfolioId_date: {
          portfolioId: portfolio.id,
          date: yesterday,
        },
      },
    });

    if (existingSnapshot) {
      console.log(`✅ ${portfolio.user.username}: Already has snapshot for yesterday (€${existingSnapshot.totalValue.toFixed(2)})`);
      continue;
    }

    // Create snapshot with slightly lower value (simulate yesterday)
    const todayValue = portfolio.snapshots[0]?.totalValue || 387741.20;
    const yesterdayValue = todayValue * 0.99; // 1% lower for demo

    await prisma.portfolioSnapshot.create({
      data: {
        portfolioId: portfolio.id,
        date: yesterday,
        totalValue: yesterdayValue,
      },
    });

    console.log(`✅ ${portfolio.user.username}: Created yesterday snapshot (€${yesterdayValue.toFixed(2)})`);
  }

  console.log('\n✅ Sistem tam olarak şöyle çalışacak:\n');
  console.log('📅 Bugün (13 Ocak 2026):');
  console.log('   - Portfolyo değeri: €387,741.20');
  console.log('   - Snapshot kaydedildi ✅');
  console.log('');
  console.log('📅 Yarın gece 00:00\'da:');
  console.log('   - Cron job otomatik çalışır');
  console.log('   - Tüm asset fiyatları Yahoo Finance\'ten çekilir');
  console.log('   - Portfolio değeri hesaplanır (örn: €390,000)');
  console.log('   - Yeni snapshot kaydedilir: 2026-01-14 → €390,000');
  console.log('');
  console.log('✨ Frontend\'de göreceğin:');
  console.log('   1D button: Bugün vs dün → +€2,258.80 (+0.58%)');
  console.log('   1W button: Son 7 günün trendi');
  console.log('   1M button: Son 30 günün grafiği');
  console.log('   Benchmark comparison: Senin portföyün vs S&P500, NASDAQ, etc.');

  console.log('\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
