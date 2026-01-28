import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const username = 'demo_empty';
    const email = 'demo_empty@wot.money';

    console.log(`Creating empty user ${username}...`);

    let user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
        const hashedPassword = await bcrypt.hash('password', 10);
        user = await prisma.user.create({
            data: {
                username,
                email,
                password: hashedPassword,
                preferences: JSON.stringify({ defaultViewMode: 'fullscreen' })
            }
        });
    }

    let portfolio = await prisma.portfolio.findUnique({ where: { userId: user.id } });
    if (!portfolio) {
        portfolio = await prisma.portfolio.create({ data: { userId: user.id } });
    }

    // Ensure no assets
    await prisma.asset.deleteMany({ where: { portfolioId: portfolio.id } });
    await prisma.assetTransaction.deleteMany({ where: { portfolioId: portfolio.id } });

    console.log(`✅ User ${username} ready with EMPTY portfolio.`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
