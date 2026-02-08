import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Injecting Soitec into dev1 portfolio...');

    const user = await prisma.user.findFirst({
        where: { username: 'dev1' },
        include: { Portfolio: true }
    });

    if (!user || !user.Portfolio) {
        console.error('User dev1 or portfolio not found!');
        return;
    }

    console.log(`Found portfolio: ${user.Portfolio.id}`);

    // Create Soitec Asset
    const asset = await prisma.asset.create({
        data: {
            portfolioId: user.Portfolio.id,
            category: 'EU_MARKETS',
            type: 'STOCK',
            symbol: 'SOI.PA',
            name: 'Soitec SA',
            quantity: 10,
            buyPrice: 150.0,
            currency: 'EUR',
            exchange: 'Paris',
            sector: 'Technology',
            country: 'France'
        }
    });

    console.log(`✅ Created asset: ${asset.symbol} (ID: ${asset.id})`);
}

main()
    .finally(async () => {
        await prisma.$disconnect();
    });
