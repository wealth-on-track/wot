import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding new Cloud Database...');

    // 1. Create dev1 user
    const email = 'dev1@wot.money';
    const username = 'dev1';
    let user = await prisma.user.findFirst({
        where: { email }
    });

    if (!user) {
        console.log(`Creating user ${username}...`);
        const hashedPassword = await bcrypt.hash('password', 10);
        user = await prisma.user.create({
            data: {
                username,
                email,
                password: hashedPassword,
                preferences: JSON.stringify({ defaultViewMode: 'fullscreen' })
            }
        });
        console.log(`✅ User created: ${user.id}`);
    } else {
        console.log(`User ${username} already exists.`);
    }

    // 2. Create Portfolio
    let portfolio = await prisma.portfolio.findUnique({
        where: { userId: user.id }
    });

    if (!portfolio) {
        console.log('Creating portfolio...');
        portfolio = await prisma.portfolio.create({
            data: { userId: user.id }
        });
        console.log(`✅ Portfolio created: ${portfolio.id}`);
    }

    // 3. Inject Soitec Asset
    console.log('Injecting Soitec asset...');
    const asset = await prisma.asset.create({
        data: {
            portfolioId: portfolio.id,
            category: 'EU_MARKETS', // Enum is restored, so use String matching enum
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
    console.log(`✅ Asset created: ${asset.symbol}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
