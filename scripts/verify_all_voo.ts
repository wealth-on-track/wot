
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const users = await prisma.user.findMany({
            include: {
                portfolio: {
                    include: {
                        assets: true
                    }
                }
            }
        });

        console.log(`Found ${users.length} users.`);

        for (const user of users) {
            console.log(`\nUser: ${user.username} (${user.email})`);
            if (!user.portfolio) {
                console.log('  No portfolio');
                continue;
            }
            const voo = user.portfolio.assets.find(a => a.symbol === 'VOO');
            if (voo) {
                console.log('  HAS VOO ASSET:', JSON.stringify(voo, null, 2));
            } else {
                console.log('  No VOO asset.');
                // Limit output
                const symbols = user.portfolio.assets.map(a => a.symbol).join(', ');
                console.log(`  Assets: ${symbols}`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
