import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Clearing cache for VOO...');
    // Force delete any cache entry for VOO so it retries with new logic
    const deleted = await prisma.priceCache.deleteMany({
        where: {
            symbol: { in: ['VOO', 'VOO.US', 'VOO.PCX'] }
        }
    });
    console.log(`Deleted ${deleted.count} entries. Cache cleared!`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
