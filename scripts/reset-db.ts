import "dotenv/config";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('⚠️  STARTING FULL DATABASE RESET ⚠️');
    console.log('This will delete ALL users, portfolios, assets, and transactions.');

    // Delete in reverse order of dependencies

    console.log('1. Deleting AssetTransactions...');
    await prisma.assetTransaction.deleteMany({});

    console.log('2. Deleting PortfolioSnapshots...');
    await prisma.portfolioSnapshot.deleteMany({});

    console.log('3. Deleting Goals...');
    await prisma.goal.deleteMany({});

    console.log('4. Deleting Assets...');
    await prisma.asset.deleteMany({});

    console.log('5. Deleting Portfolios...');
    await prisma.portfolio.deleteMany({});

    console.log('6. Deleting Users...');
    await prisma.user.deleteMany({});

    console.log('7. Clearing Caches (Price, System Logs, API Usage, etc.)...');
    await prisma.priceCache.deleteMany({});
    await prisma.systemActivityLog.deleteMany({});
    await prisma.apiUsage.deleteMany({});
    await prisma.apiRequestLog.deleteMany({});
    await prisma.benchmarkCache.deleteMany({});
    await prisma.benchmarkPrice.deleteMany({});
    await prisma.exchangeRate.deleteMany({});
    await prisma.assetPriceHistory.deleteMany({});

    console.log('✅ DATABASE RESET COMPLETE.');
}

main()
    .catch((e) => {
        console.error('❌ Reset Failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
