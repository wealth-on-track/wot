import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Finding user dev1...');
    const user = await prisma.user.findFirst({
        where: {
            username: 'dev1'
        },
        include: { portfolio: true }
    });

    if (!user) {
        console.log('User dev1 not found. Trying to find by email dev1...');
        // Fallback
        const userByEmail = await prisma.user.findFirst({
            where: { email: { startsWith: 'dev1' } },
            include: { portfolio: true }
        });
        if (!userByEmail) {
            console.log('User dev1 not found.');
            return;
        }
        console.log(`Found user by email: ${userByEmail.username}`);
        await wipe(userByEmail);
        return;
    }

    await wipe(user);
}

async function wipe(user: any) {
    if (!user.portfolio) {
        console.log('User has no portfolio.');
        return;
    }

    const portfolioId = user.portfolio.id;
    console.log(`Wiping data for portfolio ${portfolioId} (${user.username})...`);

    // Delete Transactions
    const deleteTx = await prisma.assetTransaction.deleteMany({
        where: { portfolioId: portfolioId }
    });
    console.log(`Deleted ${deleteTx.count} transactions.`);

    // Delete Assets
    const deleteAssets = await prisma.asset.deleteMany({
        where: { portfolioId: portfolioId }
    });
    console.log(`Deleted ${deleteAssets.count} assets.`);

    console.log('Wipe complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
