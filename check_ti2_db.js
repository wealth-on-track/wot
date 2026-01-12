const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTI2() {
  const assets = await prisma.asset.findMany({
    where: { symbol: { contains: 'TI2', mode: 'insensitive' } },
    select: { id: true, symbol: true, name: true, category: true, type: true }
  });
  console.log('Assets containing TI2:', JSON.stringify(assets, null, 2));

  const priceCache = await prisma.priceCache.findMany({
    where: { symbol: { contains: 'TI2', mode: 'insensitive' } },
    select: { symbol: true, source: true, updatedAt: true }
  });
  console.log('\nPrice cache containing TI2:', JSON.stringify(priceCache, null, 2));

  await prisma.$disconnect();
}

checkTI2();
