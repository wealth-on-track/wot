const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Use direct connection from Env
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    }
});

async function main() {
    console.log('🔄 Starting Demo User Reset...');

    // 1. DELETE OLD DEMO USER
    const oldEmail = 'demo@wealthontrack.com';
    const oldUser = await prisma.user.findUnique({ where: { email: oldEmail } });

    if (oldUser) {
        console.log(`🗑️  Found old user ${oldEmail}, deleting...`);

        // Delete portfolio first (to avoid constraint errors if cascade is missing)
        await prisma.asset.deleteMany({ where: { portfolio: { userId: oldUser.id } } }).catch(() => { });
        await prisma.goal.deleteMany({ where: { portfolio: { userId: oldUser.id } } }).catch(() => { });
        await prisma.portfolioSnapshot.deleteMany({ where: { portfolio: { userId: oldUser.id } } }).catch(() => { });
        await prisma.portfolio.deleteMany({ where: { userId: oldUser.id } }).catch(() => { });

        // Delete user
        await prisma.user.delete({ where: { id: oldUser.id } });
        console.log('✅ Old user deleted.');
    } else {
        console.log('ℹ️  Old user not found, skipping delete.');
    }

    // Check if username 'demo' is still taken (by someone else?)
    const existingUsername = await prisma.user.findUnique({ where: { username: 'demo' } });
    if (existingUsername) {
        console.log('🗑️  Username "demo" is taken by another email, deleting that too...');
        await prisma.asset.deleteMany({ where: { portfolio: { userId: existingUsername.id } } }).catch(() => { });
        await prisma.goal.deleteMany({ where: { portfolio: { userId: existingUsername.id } } }).catch(() => { });
        await prisma.portfolioSnapshot.deleteMany({ where: { portfolio: { userId: existingUsername.id } } }).catch(() => { });
        await prisma.portfolio.deleteMany({ where: { userId: existingUsername.id } }).catch(() => { });
        await prisma.user.delete({ where: { id: existingUsername.id } });
        console.log('✅ Username "demo" freed.');
    }

    // 2. CREATE NEW USER
    const newEmail = 'demo@wot.money';
    const password = '123456';
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log(`🆕 Creating new user ${newEmail}...`);

    const newUser = await prisma.user.create({
        data: {
            email: newEmail,
            username: 'demo',
            password: hashedPassword,
        },
    });

    console.log(`✅ User created. ID: ${newUser.id}`);

    // 3. CREATE PORTFOLIO
    await prisma.portfolio.create({
        data: {
            userId: newUser.id,
        }
    });

    console.log('✅ Portfolio created.');
    console.log(`🎉 Demo Reset Complete! Login: ${newEmail} / ${password}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
