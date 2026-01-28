import "dotenv/config";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Soitec ticker fix...');

    // 1. Update Asset table
    const assetUpdate = await prisma.asset.updateMany({
        where: { symbol: 'SOIT.PA' },
        data: { symbol: 'SOI.PA' }
    });
    console.log(`✅ Updated ${assetUpdate.count} records in Asset table.`);

    // 2. Update AssetTransaction table
    const txUpdate = await prisma.assetTransaction.updateMany({
        where: { symbol: 'SOIT.PA' },
        data: { symbol: 'SOI.PA' }
    });
    console.log(`✅ Updated ${txUpdate.count} records in AssetTransaction table.`);

    // 3. Update PriceCache table
    const cacheUpdate = await prisma.priceCache.updateMany({
        where: { symbol: 'SOIT.PA' },
        data: { symbol: 'SOI.PA' }
    });
    console.log(`✅ Updated ${cacheUpdate.count} records in PriceCache table.`);

    // 4. Update AssetPriceHistory table
    const historyUpdate = await prisma.assetPriceHistory.updateMany({
        where: { symbol: 'SOIT.PA' },
        data: { symbol: 'SOI.PA' }
    });
    console.log(`✅ Updated ${historyUpdate.count} records in AssetPriceHistory table.`);

    console.log('✨ Soitec ticker fix complete.');
}

main()
    .catch((e) => {
        console.error('❌ Error fixing Soitec ticker:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
