
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Deleting ASML entries from PriceCache...");
    const res = await prisma.priceCache.deleteMany({
        where: {
            symbol: {
                contains: 'ASML',
                mode: 'insensitive'
            }
        }
    });
    console.log("Deleted count:", res.count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
