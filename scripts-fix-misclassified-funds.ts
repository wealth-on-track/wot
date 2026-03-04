import { PrismaClient } from '@prisma/client';
import { getAssetCategory, getCategoryDefaults } from './src/lib/assetCategories';

const prisma = new PrismaClient();

(async () => {
  const rows = await prisma.asset.findMany({
    where: {
      category: 'TEFAS',
      NOT: { exchange: 'TEFAS' },
      OR: [
        { isin: null },
        { isin: { not: { startsWith: 'TR' } } }
      ]
    }
  });

  let fixed = 0;
  for (const a of rows) {
    const newCategory = getAssetCategory(a.type as any, a.exchange || '', a.symbol, a.isin || undefined);
    if (newCategory === 'TEFAS') continue;

    const defaults = getCategoryDefaults(newCategory, a.symbol);
    const newCountry = (a.country === 'Turkey' || a.country === 'Europe') ? defaults.country : a.country;

    await prisma.asset.update({
      where: { id: a.id },
      data: {
        category: newCategory as any,
        country: newCountry,
        sector: a.sector === 'Fund' ? defaults.sector : a.sector,
      }
    });
    fixed++;
  }

  console.log(JSON.stringify({ scanned: rows.length, fixed }, null, 2));
  await prisma.$disconnect();
})();
