
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const email = 'demo@wot.money';
        const user = await prisma.user.findFirst({
            where: { email },
            include: {
                portfolio: {
                    include: {
                        assets: true
                    }
                }
            }
        });

        if (!user || !user.portfolio) {
            console.log('User or Portfolio not found');
            return;
        }

        const voo = user.portfolio.assets.find(a => a.symbol === 'VOO');
        if (!voo) {
            console.log('VOO Asset NOT found!');
        } else {
            console.log('VOO Asset Found:', JSON.stringify(voo, null, 2));
        }

        const priceCache = await prisma.priceCache.findUnique({
            where: { symbol: 'VOO' }
        });
        console.log('VOO Price Cache:', JSON.stringify(priceCache, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
