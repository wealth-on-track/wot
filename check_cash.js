
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCash() {
    console.log("Checking CASH assets in database...");
    const assets = await prisma.asset.findMany({
        where: { type: 'CASH' }
    });
    console.log(JSON.stringify(assets, null, 2));
}

checkCash()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
