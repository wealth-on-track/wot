
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    // Password must be at least 6 characters for Zod validation in auth.ts
    const hashedPassword = await bcrypt.hash('test1234', 10);

    const user = await prisma.user.update({
        where: { username: 'test1' },
        data: { password: hashedPassword }
    });

    console.log(`Password for user '${user.username}' has been reset to 'test1234'.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
