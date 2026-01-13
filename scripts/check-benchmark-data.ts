import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const symbols = ['^GSPC', '^IXIC', 'XU100.IS', 'GC=F', 'BTC-USD'];

  console.log('\n=== Benchmark Data Check ===\n');

  for (const symbol of symbols) {
    const count = await prisma.benchmarkPrice.count({
      where: { symbol },
    });

    const oldest = await prisma.benchmarkPrice.findFirst({
      where: { symbol },
      orderBy: { date: 'asc' },
    });

    const newest = await prisma.benchmarkPrice.findFirst({
      where: { symbol },
      orderBy: { date: 'desc' },
    });

    console.log(`${symbol}:`);
    console.log(`  Data points: ${count}`);
    if (oldest && newest) {
      console.log(`  Range: ${oldest.date.toISOString().split('T')[0]} → ${newest.date.toISOString().split('T')[0]}`);
    }
    console.log('');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
