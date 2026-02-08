import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const targetEmails = ['dev1@wot.money', 'dev2@wot.money', 'dev3@wot.money'];

async function main() {
    console.log('Starting data reset for users:', targetEmails.join(', '));

    for (const email of targetEmails) {
        console.log(`\n--- Processing ${email} ---`);

        const user = await prisma.user.findUnique({
            where: { email },
            include: { Portfolio: true }
        });

        if (!user) {
            console.warn(`User ${email} not found. Skipping.`);
            continue;
        }

        const userId = user.id;
        const portfolioId = user.Portfolio?.id;

        if (portfolioId) {
            // Delete Assets
            const assetsResult = await prisma.asset.deleteMany({ where: { portfolioId } });
            console.log(`Deleted ${assetsResult.count} Assets.`);

            // Delete Transactions
            const txResult = await prisma.assetTransaction.deleteMany({ where: { portfolioId } });
            console.log(`Deleted ${txResult.count} Transactions.`);

            // Delete Goals
            const goalsResult = await prisma.goal.deleteMany({ where: { portfolioId } });
            console.log(`Deleted ${goalsResult.count} Goals.`);

            // Delete Snapshots
            const snapshotsResult = await prisma.portfolioSnapshot.deleteMany({ where: { portfolioId } });
            console.log(`Deleted ${snapshotsResult.count} Snapshots.`);
        } else {
            console.warn(`Portfolio for ${email} not found.`);
        }

        // Delete Logs
        const activityLogsResult = await prisma.systemActivityLog.deleteMany({ where: { userId } });
        console.log(`Deleted ${activityLogsResult.count} System Activity Logs.`);

        const apiLogsResult = await prisma.apiRequestLog.deleteMany({ where: { userId } });
        console.log(`Deleted ${apiLogsResult.count} API Request Logs.`);

        // Reset Preferences
        await prisma.user.update({
            where: { id: userId },
            data: { preferences: {} }
        });
        console.log(`Reset user preferences.`);
    }

    console.log('\nReset complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
