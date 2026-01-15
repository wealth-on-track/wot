import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDemoData() {
    try {
        const user = await prisma.user.findUnique({
            where: { username: 'demo' },
            include: {
                portfolio: {
                    include: {
                        snapshots: {
                            orderBy: { date: 'desc' },
                            take: 10
                        },
                        assets: true
                    }
                }
            }
        });

        console.log('=== DEMO USER DATA ===');
        console.log('Username:', user?.username);
        console.log('Portfolio ID:', user?.portfolio?.id);
        console.log('Assets Count:', user?.portfolio?.assets.length);
        console.log('Snapshots Count:', user?.portfolio?.snapshots.length);
        console.log('\nRecent Snapshots:');
        user?.portfolio?.snapshots.forEach(s => {
            console.log(`  ${s.date.toISOString().split('T')[0]}: €${s.totalValue.toFixed(2)}`);
        });

        if (user?.portfolio?.snapshots.length === 0) {
            console.log('\n⚠️  NO SNAPSHOTS FOUND! This is the problem.');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDemoData();
