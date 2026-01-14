
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const email = 'demo@wot.money';
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                portfolio: {
                    include: {
                        assets: true
                    }
                }
            }
        });

        if (!user) {
            console.log(`User ${email} not found.`);
            return;
        }

        console.log(`User: ${user.username}`);
        if (!user.portfolio) {
            console.log('No portfolio found.');
            return;
        }

        console.log('--- Assets ---');
        const vooAsset = user.portfolio.assets.find(a => a.symbol === 'VOO');

        if (vooAsset) {
            console.log('VOO Asset found:', vooAsset);
        } else {
            console.log('VOO Asset NOT found in portfolio.');
            console.log('All Assets:', user.portfolio.assets.map(a => a.symbol).join(', '));
        }

        console.log('--- Price Cache ---');
        const cache = await prisma.priceCache.findUnique({
            where: { symbol: 'VOO' }
        });
        console.log('VOO PriceCache:', cache);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
