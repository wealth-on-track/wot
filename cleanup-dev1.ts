import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDev1() {
    try {
        // Find dev1 user
        const user = await prisma.user.findUnique({
            where: { username: 'dev1' },
            include: { Portfolio: true }
        });

        if (!user || !user.Portfolio) {
            console.log('❌ dev1 user or portfolio not found');
            return;
        }

        console.log(`✅ Found dev1 user (${user.email})`);
        console.log(`📦 Portfolio ID: ${user.Portfolio.id}`);

        // Delete all transactions
        const deletedTransactions = await prisma.assetTransaction.deleteMany({
            where: { portfolioId: user.Portfolio.id }
        });
        console.log(`🗑️  Deleted ${deletedTransactions.count} transactions`);

        // Delete all assets
        const deletedAssets = await prisma.asset.deleteMany({
            where: { portfolioId: user.Portfolio.id }
        });
        console.log(`🗑️  Deleted ${deletedAssets.count} assets`);

        console.log('✨ Cleanup complete! Ready for fresh import.');
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupDev1();
