import { PrismaClient } from '@prisma/client';

const candidates = [
    "postgres://ardaak@localhost:5432/postgres",
    "postgres://postgres:postgres@localhost:5432/postgres",
    "postgres://postgres:password@localhost:5432/postgres",
    "postgres://postgres@localhost:5432/postgres",
    "postgres://ardaak:postgres@localhost:5432/postgres"
];

async function main() {
    for (const url of candidates) {
        console.log(`\nTesting: ${url}`);
        const prisma = new PrismaClient({ datasources: { db: { url } } });
        try {
            await prisma.$connect();
            console.log('✅ SUCCESS! Connected with:', url);

            const result = await prisma.$queryRaw`SELECT datname FROM pg_database;`;
            console.log('Databases:', result);

            await prisma.$disconnect();
            return; // Exit on first success
        } catch (e: any) {
            console.log('❌ Failed:', e.message.split('\n')[0]); // Key error line only
            await prisma.$disconnect();
        }
    }
    console.log('\n❌ All candidates failed.');
}

main()
    .finally(async () => {
    });
