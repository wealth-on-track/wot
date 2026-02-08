const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteAllAssetsForDev3() {
    try {
        console.log('Finding dev3 user...');

        // Find dev3 user
        const user = await prisma.user.findUnique({
            where: { username: 'dev3' },
            include: { Portfolio: true }
        });

        if (!user) {
            console.log('❌ User dev3 not found');
            return;
        }

        if (!user.portfolio) {
            console.log('❌ No portfolio found for dev3');
            return;
        }

        const portfolioId = user.portfolio.id;
        console.log(`✓ Found dev3 portfolio: ${portfolioId}`);

        // Delete all transactions first (due to foreign key constraints)
        console.log('\nDeleting transactions...');
        const deletedTransactions = await prisma.assetTransaction.deleteMany({
            where: { portfolioId }
        });
        console.log(`✓ Deleted ${deletedTransactions.count} transactions`);

        // Delete all assets
        console.log('\nDeleting assets...');
        const deletedAssets = await prisma.asset.deleteMany({
            where: { portfolioId }
        });
        console.log(`✓ Deleted ${deletedAssets.count} assets`);

        console.log('\n✅ All assets and transactions deleted for dev3');
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

deleteAllAssetsForDev3();
