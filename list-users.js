
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        select: {
            username: true,
            email: true,
            // We generally shouldn't print passwords, but knowing if it's null or a hash format helps
            password: true
        }
    });
    console.log('Users in DB:', users);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
