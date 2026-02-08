require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TARGET_EMAIL = 'dev1@wot.money';

async function cleanUser(email) {
    console.log(`\n🔍 Processing user: ${email}...`);
    try {
        const user = await prisma.user.findUnique({
            where: { email },
            include: { Portfolio: true }
        });

        if (!user) {
            console.log(`❌ User not found: ${email}`);
            return;
        }

        if (!user.Portfolio) {
            console.log(`❌ Portfolio not found for: ${email}`);
            return;
        }

        console.log(`✅ Found Portfolio: ${user.Portfolio.id}`);

        // Check counts
        const assetCount = await prisma.asset.count({ where: { portfolioId: user.Portfolio.id } });
        const txCount = await prisma.assetTransaction.count({ where: { portfolioId: user.Portfolio.id } });

        console.log(`📊 Current Status:`);
        console.log(`- Assets: ${assetCount}`);
        console.log(`- Transactions: ${txCount}`);

        if (assetCount > 0 || txCount > 0) {
            console.log('🗑️  Deleting all data...');

            const deletedTx = await prisma.assetTransaction.deleteMany({
                where: { portfolioId: user.Portfolio.id }
            });
            console.log(`✅ Deleted ${deletedTx.count} transactions`);

            const deletedAssets = await prisma.asset.deleteMany({
                where: { portfolioId: user.Portfolio.id }
            });
            console.log(`✅ Deleted ${deletedAssets.count} assets`);

            console.log('\n✨ Cleanup complete! Database is now empty for this user.');
        } else {
            console.log('✨ Already clean.');
        }

    } catch (e) {
        console.error(`❌ Error processing ${email}:`, e);
    }
}

async function main() {
    console.log('🚀 Starting cleanup for dev1@wot.money...');
    await cleanUser(TARGET_EMAIL);
    await prisma.$disconnect();
}

main();
