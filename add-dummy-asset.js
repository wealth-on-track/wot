const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findUnique({
        where: { username: 'dev1' },
        include: { portfolio: true }
    });

    if (!user || !user.portfolio) {
        console.error('User dev1 not found');
        return;
    }

    console.log(`Adding dummy asset for ${user.username}...`);

    await prisma.asset.create({
        data: {
            portfolioId: user.portfolio.id,
            symbol: 'AAPL',
            name: 'Apple Inc.',
            type: 'STOCK',
            category: 'US_MARKETS',
            quantity: 10,
            buyPrice: 150.00,
            currency: 'USD',
            exchange: 'NASDAQ',
            sector: 'Technology',
            country: 'USA'
        }
    });

    // Add another one
    await prisma.asset.create({
        data: {
            portfolioId: user.portfolio.id,
            symbol: 'BTC-USD',
            name: 'Bitcoin',
            type: 'CRYPTO',
            category: 'CRYPTO',
            quantity: 0.5,
            buyPrice: 40000.00,
            currency: 'USD',
            exchange: 'CRYPTO',
            sector: 'Crypto',
            country: 'Global'
        }
    });

    console.log('Added AAPL and BTC.');
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
