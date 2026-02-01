import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
    // Get user's portfolio
    const user = await prisma.user.findFirst({
        include: {
            portfolio: {
                include: {
                    assets: {
                        where: { symbol: { contains: 'XRP', mode: 'insensitive' } }
                    }
                }
            }
        }
    });

    console.log('User portfolio assets with XRP:', JSON.stringify(user?.portfolio?.assets, null, 2));

    // Get XRP transactions
    const xrpTransactions = await prisma.assetTransaction.findMany({
        where: {
            portfolioId: user?.portfolio?.id,
            symbol: { contains: 'XRP', mode: 'insensitive' }
        },
        orderBy: { date: 'asc' }
    });

    console.log('\nXRP Transactions count:', xrpTransactions.length);
    console.log('XRP Transactions symbols:', [...new Set(xrpTransactions.map(t => t.symbol))]);

    await prisma.$disconnect();
}

test();
