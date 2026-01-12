const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkCommodityMetadata() {
  console.log('=== Checking Commodity Metadata ===\n');

  // Check all commodities
  const commodities = await prisma.asset.findMany({
    where: {
      OR: [
        { category: 'COMMODITIES' },
        { type: 'COMMODITY' },
        { type: 'GOLD' },
        { symbol: { contains: 'GAUTRY' } },
        { symbol: { contains: 'XAGTRY' } },
        { symbol: { contains: 'XAU' } },
        { symbol: { contains: 'XAG' } }
      ]
    },
    select: {
      symbol: true,
      type: true,
      category: true,
      currency: true,
      exchange: true,
      country: true,
      sector: true
    }
  });

  console.log(`Found ${commodities.length} commodity-related assets:\n`);
  commodities.forEach(c => {
    console.log(`${c.symbol}:`);
    console.log(`  Category: ${c.category}`);
    console.log(`  Type: ${c.type}`);
    console.log(`  Currency: ${c.currency}`);
    console.log(`  Exchange: ${c.exchange || 'NULL'}`);
    console.log(`  Country: ${c.country || 'NULL'}`);
    console.log(`  Sector: ${c.sector || 'NULL'}`);
    console.log('');
  });

  await prisma.$disconnect();
}

checkCommodityMetadata().catch(console.error);
