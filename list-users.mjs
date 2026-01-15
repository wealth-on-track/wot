import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listUsers() {
    try {
        const users = await prisma.user.findMany({
            select: {
                username: true,
                email: true,
                portfolio: {
                    select: {
                        id: true,
                        _count: {
                            select: {
                                assets: true,
                                snapshots: true
                            }
                        }
                    }
                }
            }
        });

        console.log('=== ALL USERS ===');
        users.forEach(user => {
            console.log(`\nUsername: ${user.username}`);
            console.log(`Email: ${user.email}`);
            console.log(`Portfolio ID: ${user.portfolio?.id || 'N/A'}`);
            console.log(`Assets: ${user.portfolio?._count.assets || 0}`);
            console.log(`Snapshots: ${user.portfolio?._count.snapshots || 0}`);
        });

        console.log(`\nTotal Users: ${users.length}`);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

listUsers();
