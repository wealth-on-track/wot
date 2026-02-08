
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const user = await prisma.user.findFirst({
            where: { email: 'demo@wot.money' },
            include: { Portfolio: true }
        });

        if (!user || !user.Portfolio) {
            throw new Error('User or Portfolio not found');
        }

        // Check if asset already exists
        const existing = await prisma.asset.findFirst({
            where: { portfolioId: user.Portfolio.id, symbol: 'VOO' }
        });

        if (existing) {
            console.log(`VOO already exists (ID: ${existing.id}), quantity: ${existing.quantity}`);
            return;
        }

        // Add VOO
        const newAsset = await prisma.asset.create({
            data: {
                portfolioId: user.Portfolio.id,
                symbol: 'VOO',
                category: 'US_MARKETS',
                type: 'ETF', // Changed from STOCK to ETF as VOO is an ETF
                quantity: 1,
                buyPrice: 600,
                currency: 'USD',
                exchange: 'NMS',
                sector: 'Financial Services',
                country: 'USA',
                name: 'Vanguard S&P 500 ETF',
                sortOrder: 0
            }
        });

        console.log('Successfully added VOO:', newAsset);

    } catch (error) {
        console.error('Error adding asset:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
