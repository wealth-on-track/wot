import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { getMarketPrice } from '../src/services/marketData';

const prisma = new PrismaClient();

async function main() {
    console.log('🧪 Testing ISIN Self-Healing Logic...');

    const TEST_USER = 'isin_tester';
    const TEST_SYMBOL = 'BAD_SOIT';
    const TEST_ISIN = 'FR0013227113'; // Soitec ISIN

    // 1. Setup: Clean up previous test data
    const existingUser = await prisma.user.findFirst({ where: { username: TEST_USER } });
    if (existingUser) {
        await prisma.user.delete({ where: { id: existingUser.id } });
    }

    // 2. Create User & Portfolio
    const user = await prisma.user.create({
        data: {
            username: TEST_USER,
            email: 'isintest@wot.money',
            password: 'hash',
            portfolio: {
                create: {}
            }
        },
        include: { portfolio: true }
    });
    const portfolioId = user.portfolio!.id;

    // 3. Inject "Broken" Asset (Bad Symbol, Good ISIN)
    console.log(`Injecting broken asset: Symbol=${TEST_SYMBOL}, ISIN=${TEST_ISIN}`);
    const asset = await prisma.asset.create({
        data: {
            portfolioId,
            symbol: TEST_SYMBOL,
            isin: TEST_ISIN,
            name: 'Broken Soitec',
            quantity: 5,
            buyPrice: 100,
            currency: 'EUR',
            type: 'STOCK',
            category: 'EU_MARKETS',
            exchange: 'PARIS',
            country: 'France',
            sector: 'Tech'
        }
    });

    console.log(`✅ Asset created with ID: ${asset.id}`);

    // 4. Trigger Market Price Fetch
    console.log('Triggering getMarketPrice()...');
    const result = await getMarketPrice(TEST_SYMBOL, 'STOCK', 'PARIS', true, TEST_USER);

    // 5. Verification
    console.log('---------------------------------------------------');
    console.log('Result:', result);

    const updatedAsset = await prisma.asset.findUnique({ where: { id: asset.id } });
    console.log('Updated Asset Symbol in DB:', updatedAsset?.symbol);

    if (updatedAsset?.symbol === 'SOI.PA' && result && result.price > 0) {
        console.log('✅ SUCCESS: Asset self-healed to SOI.PA and price fetched!');
    } else {
        console.error('❌ FAILURE: Asset did not heal or price missing.');
        process.exit(1);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
