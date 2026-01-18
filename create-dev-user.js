const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const email = 'dev1@wot.money';
    const username = 'dev1';
    const password = 'wot123456';

    console.log(`Checking for existing user ${username}...`);

    // Clean up existing
    const existingUser = await prisma.user.findFirst({
        where: {
            OR: [
                { email },
                { username }
            ]
        }
    });

    if (existingUser) {
        console.log(`Found existing user (ID: ${existingUser.id}), deleting...`);
        // Delete related data first
        const portfolio = await prisma.portfolio.findUnique({ where: { userId: existingUser.id } });
        if (portfolio) {
            await prisma.asset.deleteMany({ where: { portfolioId: portfolio.id } });
            await prisma.goal.deleteMany({ where: { portfolioId: portfolio.id } });
            await prisma.portfolioSnapshot.deleteMany({ where: { portfolioId: portfolio.id } });
            await prisma.assetTransaction.deleteMany({ where: { portfolioId: portfolio.id } }).catch(() => { });
            await prisma.portfolio.delete({ where: { id: portfolio.id } });
        }
        await prisma.user.delete({ where: { id: existingUser.id } });
        console.log('Deleted existing user.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: {
            email,
            username,
            password: hashedPassword,
            portfolio: {
                create: {
                    isPublic: true
                }
            }
        }
    });

    console.log(`Created user: ${user.username} (${user.email})`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
