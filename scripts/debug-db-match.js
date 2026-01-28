
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking for Poisoned Asset Links ---');

    // Look for assets with the WisdomTree ISIN
    const poisonedAssets = await prisma.asset.findMany({
        where: { isin: 'IE00BLRPRL42' },
        select: { id: true, symbol: true, name: true, customGroup: true, portfolioId: true }
    });

    console.log(`Found ${poisonedAssets.length} assets with ISIN IE00BLRPRL42:`);
    poisonedAssets.forEach(a => {
        console.log(`- [${a.symbol}] Name: '${a.name}', Group: '${a.customGroup || 'Main'}'`);
    });

    // Look for PHAG.L to see if it has the wrong ISIN
    const phagAssets = await prisma.asset.findMany({
        where: { symbol: 'PHAG.L' },
        select: { id: true, isin: true, name: true, customGroup: true }
    });

    console.log(`\nFound ${phagAssets.length} assets with Symbol PHAG.L:`);
    phagAssets.forEach(a => {
        console.log(`- [${a.symbol}] ISIN: '${a.isin}', Name: '${a.name}', Group: '${a.customGroup || 'Main'}'`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
