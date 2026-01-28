import "dotenv/config";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Checking DB Connection...');
    try {
        const userCount = await prisma.user.count();
        console.log(`✅ Success! User count: ${userCount}`);

        const users = await prisma.user.findMany({ select: { username: true, email: true } });
        console.log('👤 Users found:', users);

        const soitecAssets = await prisma.asset.findMany({
            where: { symbol: { in: ['SOI.PA', 'SOIT.PA'] } }
        });
        console.log('📦 Soitec assets in DB:', soitecAssets);

    } catch (e: any) {
        console.error('❌ DB Error:', e.message);
        if (e.code) console.error('Error Code:', e.code);
    }
}

main()
    .finally(async () => {
        await prisma.$disconnect();
    });
