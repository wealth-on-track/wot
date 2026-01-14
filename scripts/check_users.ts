
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const userCount = await prisma.user.count();
        const users = await prisma.user.findMany({
            select: {
                username: true,
                email: true,
            },
        });

        console.log(`User Count: ${userCount}`);
        console.log('Users:');
        users.forEach((user) => {
            console.log(`- ${user.username} (${user.email})`);
        });
    } catch (error) {
        console.error('Error fetching users:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
