const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugAssetValues() {
  console.log('=== Debugging Asset Values ===\n');

  const assets = await prisma.asset.findMany({
    select: {
      id: true,
      symbol: true,
      quantity: true,
      buyPrice: true,
      type: true
    },
    take: 3
  });

  console.log('Sample assets from database:\n');
  assets.forEach(a => {
    console.log(`${a.symbol}:`);
    console.log(`  quantity: ${a.quantity} (type: ${typeof a.quantity})`);
    console.log(`  buyPrice: ${a.buyPrice} (type: ${typeof a.buyPrice})`);
    console.log(`  type: ${a.type}`);
    console.log('');
  });

  await prisma.$disconnect();
}

debugAssetValues().catch(console.error);
