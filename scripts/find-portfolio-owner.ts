import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const portfolioId = 'cmjggr2z60001rz2eqkn8hfdw';
    console.log(`Searching for owner of portfolio: ${portfolioId}`);

    const portfolio = await prisma.portfolio.findUnique({
        where: { id: portfolioId },
        include: { user: true }
    });

    if (portfolio && portfolio.user) {
        console.log(`✅ Portfolio owned by: ${portfolio.user.username} (${portfolio.user.email})`);
    } else {
        console.log('❌ Portfolio or user not found.');

        // Alternative: Find ANY user to inject Soitec if needed
        const anyUser = await prisma.user.findFirst({ include: { portfolio: true } });
        console.log('Alternative user for injection:', anyUser?.username);
    }
}

main()
    .finally(async () => {
        await prisma.$disconnect();
    });
