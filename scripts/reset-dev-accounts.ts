import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_EMAILS = [
    'dev1@wot.money',
    'dev2@wot.money',
    'dev3@wot.money'
];

async function resetDevAccounts() {
    console.log('🚀 Starting reset for:', TARGET_EMAILS.join(', '));

    for (const email of TARGET_EMAILS) {
        try {
            console.log(`\nProcessing ${email}...`);
            const user = await prisma.user.findUnique({
                where: { email },
                include: { Portfolio: true }
            });

            if (!user) {
                console.log(`⚠️  User not found: ${email}`);
                continue;
            }

            if (!user.Portfolio) {
                console.log(`⚠️  Portfolio not found for user: ${email}`);
                continue;
            }

            const portfolioId = user.Portfolio.id;
            console.log(`📦 Portfolio Found: ${portfolioId}`);

            // 1. Delete Transactions
            const txs = await prisma.assetTransaction.deleteMany({
                where: { portfolioId }
            });
            console.log(`   - Deleted ${txs.count} transactions`);

            // 2. Delete Assets
            const assets = await prisma.asset.deleteMany({
                where: { portfolioId }
            });
            console.log(`   - Deleted ${assets.count} assets`);

            // 3. Delete Snapshots (Account Statements history)
            const snapshots = await prisma.portfolioSnapshot.deleteMany({
                where: { portfolioId }
            });
            console.log(`   - Deleted ${snapshots.count} snapshots`);

            // 4. Delete Goals
            const goals = await prisma.goal.deleteMany({
                where: { portfolioId }
            });
            console.log(`   - Deleted ${goals.count} goals`);

            console.log(`✅ Successfully reset ${email}`);

        } catch (error) {
            console.error(`❌ Error processing ${email}:`, error);
        }
    }

    console.log('\n✨ All operations completed.');
}

resetDevAccounts()
    .catch((e) => {
        console.error('Fatal Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
