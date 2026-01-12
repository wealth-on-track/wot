const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testSystemRules() {
  console.log('=== Testing 8-Category System Rules ===\n');

  // Test 1: Category distribution
  console.log('1. CATEGORY DISTRIBUTION:');
  const categoryGroups = await prisma.asset.groupBy({
    by: ['category'],
    _count: true
  });
  categoryGroups.forEach(g => {
    console.log(`   ${g.category}: ${g._count} assets`);
  });

  // Test 2: Assets that would be filtered out
  console.log('\n2. PRICE UPDATE FILTER (should exclude TEFAS, CASH):');
  const allAssets = await prisma.asset.count();
  const updateableAssets = await prisma.asset.count({
    where: {
      AND: [
        { category: { not: 'TEFAS' } },
        { category: { not: 'CASH' } }
      ]
    }
  });
  console.log(`   Total assets: ${allAssets}`);
  console.log(`   Updateable via Yahoo: ${updateableAssets}`);
  console.log(`   Filtered out: ${allAssets - updateableAssets}`);

  // Test 3: TEFAS specific
  console.log('\n3. TEFAS ASSETS (should use TEFAS API, not Yahoo):');
  const tefasAssets = await prisma.asset.findMany({
    where: { category: 'TEFAS' },
    select: { symbol: true, name: true }
  });
  console.log(`   Count: ${tefasAssets.length}`);
  tefasAssets.forEach(a => {
    console.log(`   - ${a.symbol}: ${a.name}`);
  });

  // Test 4: CASH specific
  console.log('\n4. CASH ASSETS (should have fixed price 1.0, no API update):');
  const cashAssets = await prisma.asset.findMany({
    where: { category: 'CASH' },
    select: { symbol: true, currency: true }
  });
  console.log(`   Count: ${cashAssets.length}`);
  cashAssets.forEach(a => {
    console.log(`   - ${a.symbol} (${a.currency})`);
  });

  // Test 5: Metadata completeness
  console.log('\n5. METADATA COMPLETENESS (sector, country):');
  const allAssetsList = await prisma.asset.findMany({
    select: { sector: true, country: true }
  });
  const withMetadata = allAssetsList.filter(a => a.sector && a.country).length;
  console.log(`   Assets with metadata: ${withMetadata}/${allAssets}`);
  console.log(`   Missing metadata: ${allAssets - withMetadata}`);

  await prisma.$disconnect();
}

testSystemRules().catch(console.error);
