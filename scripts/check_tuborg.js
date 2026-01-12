
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Recent Logs (Search/Price) ---');
    // Check for Tuborg or TBORG in params
    const logs = await prisma.apiRequestLog.findMany({
        where: {
            OR: [
                { params: { contains: 'Tuborg' } },
                { params: { contains: 'TBORG' } }
            ]
        },
        orderBy: { createdAt: 'desc' },
        take: 5
    });
    console.log(JSON.stringify(logs, null, 2));

    console.log('--- Price Cache (TBORG) ---');
    const cache = await prisma.priceCache.findMany({
        where: { symbol: { contains: 'TBORG' } },
        take: 1
    });
    console.log(JSON.stringify(cache, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
