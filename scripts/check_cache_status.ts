
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking cache status...');
    const symbols = ['TAVHL.IS', 'AAPL', 'RYGYO.IS', 'ASML.AS'];

    for (const symbol of symbols) {
        const cached = await prisma.priceCache.findUnique({
            where: { symbol }
        });

        if (cached) {
            console.log(`[${symbol}] Found in DB:`);
            console.log(`  Source: ${cached.source}`);
            console.log(`  UpdatedAt: ${cached.updatedAt.toLocaleString()}`);
            console.log(`  TradeTime: ${cached.tradeTime ? cached.tradeTime.toLocaleString() : 'N/A'}`);
            console.log(`  Price: ${cached.previousClose}`);
        } else {
            console.log(`[${symbol}] NOT found in DB.`);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
