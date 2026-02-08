
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanUpUser() {
    const email = 'dev2@wot.money';
    console.log(`Finding user ${email}...`);

    const user = await prisma.user.findUnique({
        where: { email },
        include: { Portfolio: true }
    });

    if (!user) {
        console.error('User not found!');
        return;
    }

    if (!user.Portfolio) {
        console.error('User has no portfolio!');
        return;
    }

    const portfolioId = user.Portfolio.id;
    console.log(`Found portfolio: ${portfolioId}`);

    // Delete Transactions (Closed Positions / History)
    const { count: txCount } = await prisma.assetTransaction.deleteMany({
        where: { portfolioId }
    });
    console.log(`Deleted ${txCount} transactions.`);

    // Delete Assets (Open Positions)
    const { count: assetCount } = await prisma.asset.deleteMany({
        where: { portfolioId }
    });
    console.log(`Deleted ${assetCount} assets.`);

    console.log('Cleanup complete.');
}

cleanUpUser()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
