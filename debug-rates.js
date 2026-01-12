
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const rates = await prisma.exchangeRate.findMany();
    console.log("Current Exchange Rates in DB:");
    rates.forEach(r => {
        console.log(`${r.currency}: ${r.rate} (Updated: ${r.updatedAt.toISOString()})`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
